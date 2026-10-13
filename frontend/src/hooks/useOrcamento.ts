import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import {
  fusoDoNavegador, itemVazio, itensDoOrcamento, itensParaPayload, lerNumero, LIMITES,
  mesmosItens, numeroParaCampo, validarItens, versaoAtual, type ErrosItens,
} from '../utils/orcamento_utils';
import type { EstoqueItem } from '../types/estoque';
import type { ServicoItem } from '../types/servico';
import type { CanalAprovacao, ItemRascunho, Orcamento, TipoItemOrcamento } from '../types/orcamento';

interface Opcoes {
  /** OS aberta. Sem id (OS ainda não salva) o hook fica parado. */
  ordemId: string | null;
  /** financeiro.ver_margem — controla se o custo é lido/enviado. */
  podeVerCusto: boolean;
  podeEditar: boolean;
}

type Acao = 'criando' | 'salvando' | 'enviando' | 'aprovando' | 'recusando';

/**
 * Orçamento da OS: versões vindas do servidor + o rascunho em edição.
 *
 * - O servidor é a fonte da verdade: depois de qualquer operação a versão devolvida
 *   substitui a da lista, e o rascunho em edição é refeito a partir dela.
 * - Edição local só existe pro RASCUNHO; versões enviadas/aprovadas/recusadas são
 *   somente leitura (editar uma enviada = criar uma nova versão).
 * - Falha de operação não perde o que foi digitado: o erro aparece em `erroAcao`.
 * - Só a resposta da ÚLTIMA carga vale (trocar de OS rápido não mistura versões).
 */
export function useOrcamento({ ordemId, podeVerCusto, podeEditar }: Opcoes) {
  const [versoes, setVersoes] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  /** Aviso (não é erro): envio/aprovação deu certo mas o PDF/assinatura não foi guardado agora. */
  const [avisoPdf, setAvisoPdf] = useState<string | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);

  // Rascunho em edição.
  const [itens, setItens] = useState<ItemRascunho[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [validadeDias, setValidadeDias] = useState('7');
  const [mostrarErros, setMostrarErros] = useState(false);

  // Estoque e Catálogo (só pra escolher; digitar livre continua valendo).
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [servicos, setServicos] = useState<ServicoItem[]>([]);
  const [catalogosCarregados, setCatalogosCarregados] = useState(false);

  const ultimaCarga = useRef(0);

  const atual = useMemo(() => versaoAtual(versoes), [versoes]);
  const rascunho = atual?.status === 'rascunho' ? atual : null;

  /** Refaz o formulário de edição a partir de uma versão do servidor. */
  const sincronizar = useCallback((v: Orcamento | null) => {
    if (v?.status === 'rascunho') {
      setItens(itensDoOrcamento(v));
      setObservacoes(v.observacoes);
      setValidadeDias(String(v.validadeDias));
    } else {
      setItens([]);
      setObservacoes('');
      setValidadeDias('7');
    }
    setMostrarErros(false);
  }, []);

  const carregar = useCallback(async () => {
    if (!ordemId) {
      setVersoes([]);
      sincronizar(null);
      return;
    }
    const carga = ++ultimaCarga.current;
    setCarregando(true);
    setErro(null);
    try {
      const lista: Orcamento[] = await api.listarOrcamentos(ordemId, fusoDoNavegador());
      if (carga !== ultimaCarga.current) return;
      const versoesDaOS = Array.isArray(lista) ? lista : [];
      setVersoes(versoesDaOS);
      sincronizar(versaoAtual(versoesDaOS));
    } catch (e) {
      if (carga !== ultimaCarga.current) return;
      setVersoes([]);
      sincronizar(null);
      setErro(mensagemDoErro(e, 'Não foi possível carregar o orçamento.'));
    } finally {
      if (carga === ultimaCarga.current) setCarregando(false);
    }
  }, [ordemId, sincronizar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Estoque e Catálogo: falha aqui não trava o orçamento (cargo sem permissão, rede…).
  useEffect(() => {
    let vivo = true;
    Promise.allSettled([api.listarEstoque(), api.listarServicos()]).then(([e, s]) => {
      if (!vivo) return;
      if (e.status === 'fulfilled' && Array.isArray(e.value)) setEstoque(e.value);
      if (s.status === 'fulfilled') {
        const lista = Array.isArray(s.value) ? s.value : s.value?.servicos;
        if (Array.isArray(lista)) setServicos(lista);
      }
      setCatalogosCarregados(true);
    });
    return () => { vivo = false; };
  }, []);

  /** Troca uma versão na lista pela devolvida pelo servidor (ou a acrescenta). */
  const aplicarVersao = useCallback((nova: Orcamento) => {
    setVersoes(prev => {
      const sem = prev.filter(v => v.id !== nova.id);
      let lista = [...sem, nova];
      // Enviar uma versão torna as ativas anteriores "substituidas" no servidor.
      if (nova.status === 'enviado') {
        lista = lista.map(v =>
          v.id !== nova.id && (v.status === 'enviado' || v.status === 'aprovado') ? { ...v, status: 'substituido' as const } : v);
      }
      return lista.sort((a, b) => b.versao - a.versao);
    });
  }, []);

  // ── Edição do rascunho ────────────────────────────────────────────────────

  const adicionarItem = useCallback((tipo: TipoItemOrcamento) => {
    setItens(prev => [...prev, itemVazio(tipo)]);
  }, []);

  const adicionarItens = useCallback((novos: ItemRascunho[]) => {
    if (novos.length) setItens(prev => [...prev, ...novos]);
  }, []);

  const substituirItens = useCallback((lista: ItemRascunho[]) => setItens(lista), []);

  const atualizarItem = useCallback((chave: string, patch: Partial<ItemRascunho>) => {
    setItens(prev => prev.map(i => (i.chave === chave ? { ...i, ...patch } : i)));
  }, []);

  const removerItem = useCallback((chave: string) => {
    setItens(prev => prev.filter(i => i.chave !== chave));
  }, []);

  const errosItens: ErrosItens = useMemo(() => validarItens(itens), [itens]);
  const diasValidos = (() => {
    const n = lerNumero(validadeDias);
    return n != null && Number.isInteger(n) && n >= 1 && n <= 90 ? n : null;
  })();
  const observacoesLongas = observacoes.length > LIMITES.observacoes;

  /** Há alteração ainda não salva no rascunho? */
  const sujo = useMemo(() => {
    if (!rascunho) return false;
    return (
      !mesmosItens(itens, itensDoOrcamento(rascunho)) ||
      observacoes.trim() !== (rascunho.observacoes ?? '').trim() ||
      validadeDias.trim() !== numeroParaCampo(rascunho.validadeDias)
    );
  }, [rascunho, itens, observacoes, validadeDias]);

  const formularioValido = Object.keys(errosItens).length === 0 && diasValidos != null && !observacoesLongas;

  // ── Operações ─────────────────────────────────────────────────────────────

  /** Roda uma operação marcando `acao` e guardando a mensagem de erro; devolve o resultado ou null. */
  const executar = useCallback(async <T,>(qual: Acao, padrao: string, fn: () => Promise<T>): Promise<T | null> => {
    setAcao(qual);
    setErroAcao(null);
    setAvisoPdf(null);
    try {
      return await fn();
    } catch (e) {
      setErroAcao(mensagemDoErro(e, padrao));
      return null;
    } finally {
      setAcao(null);
    }
  }, []);

  /** Grava o rascunho como está na tela. Devolve a versão salva ou null (erro em `erroAcao`). */
  const salvar = useCallback(async (): Promise<Orcamento | null> => {
    if (!rascunho || !podeEditar) return null;
    if (!formularioValido) {
      setMostrarErros(true);
      setErroAcao('Corrija os campos destacados antes de salvar.');
      return null;
    }
    const salvo = await executar('salvando', 'Não foi possível salvar o orçamento.', async () => {
      const corpo = {
        validadeDias: diasValidos,
        observacoes: observacoes.trim(),
        itens: itensParaPayload(itens, podeVerCusto),
      };
      return (await api.atualizarOrcamento(rascunho.id, corpo)) as Orcamento;
    });
    if (salvo) {
      aplicarVersao(salvo);
      sincronizar(salvo);
    }
    return salvo;
  }, [rascunho, podeEditar, formularioValido, executar, diasValidos, observacoes, itens, podeVerCusto, aplicarVersao, sincronizar]);

  /**
   * Cria o rascunho da próxima versão (o servidor copia os itens da anterior).
   * `pecasIniciais` só é usado quando o rascunho nasce vazio (1ª versão): é o
   * pré-preenchimento vindo do diagnóstico.
   */
  const criarRascunho = useCallback(async (pecasIniciais: ItemRascunho[] = []): Promise<Orcamento | null> => {
    if (!ordemId || !podeEditar) return null;
    const criado = await executar('criando', 'Não foi possível criar o orçamento.', async () => {
      let v = (await api.criarVersaoOrcamento(ordemId)) as Orcamento;
      if (v.itens.length === 0 && pecasIniciais.length > 0) {
        v = (await api.atualizarOrcamento(v.id, {
          itens: itensParaPayload(pecasIniciais, podeVerCusto),
        })) as Orcamento;
      }
      return v;
    });
    if (criado) {
      aplicarVersao(criado);
      sincronizar(criado);
    } else {
      // Se o POST passou e o PATCH falhou o rascunho existe no servidor: relê pra não ficar fora de sincronia.
      carregar();
    }
    return criado;
  }, [ordemId, podeEditar, executar, podeVerCusto, aplicarVersao, sincronizar, carregar]);

  /** Salva (se preciso) e envia ao cliente. Devolve o status da OS depois do envio, ou null. */
  const avisarPdf = useCallback((v: Orcamento) => {
    if (v.assinaturaSalva === false) {
      setAvisoPdf('A aprovação foi registrada, mas a assinatura não pôde ser guardada agora. O PDF sai sem ela.');
    } else if (v.pdfGerado === false) {
      setAvisoPdf('Registrado, mas o PDF não pôde ser guardado agora. Ele será gerado na hora ao baixar.');
    }
  }, []);

  const enviar = useCallback(async (): Promise<string | null> => {
    if (!rascunho || !podeEditar) return null;
    if (sujo || mostrarErros) {
      const salvo = await salvar();
      if (!salvo) return null;
    } else if (!formularioValido) {
      setMostrarErros(true);
      setErroAcao('Corrija os campos destacados antes de enviar.');
      return null;
    }
    const enviado = await executar('enviando', 'Não foi possível enviar o orçamento.', async () =>
      (await api.enviarOrcamento(rascunho.id, fusoDoNavegador())) as Orcamento);
    if (!enviado) {
      // 409 por mudança de estado: relê o que o servidor tem.
      carregar();
      return null;
    }
    aplicarVersao(enviado);
    sincronizar(enviado);
    avisarPdf(enviado);
    return enviado.osStatus ?? 'pendente_aprovacao';
  }, [rascunho, podeEditar, sujo, mostrarErros, formularioValido, salvar, executar, aplicarVersao, sincronizar, carregar, avisarPdf]);

  const aprovar = useCallback(async (canal: CanalAprovacao, observacao: string, assinatura: string | null = null): Promise<string | null> => {
    if (!atual || atual.status !== 'enviado' || !podeEditar) return null;
    const v = await executar('aprovando', 'Não foi possível registrar a aprovação.', async () =>
      (await api.aprovarOrcamento(atual.id, { canal, observacao: observacao.trim(), assinatura }, fusoDoNavegador())) as Orcamento);
    if (!v) {
      carregar();
      return null;
    }
    aplicarVersao(v);
    avisarPdf(v);
    return v.osStatus ?? 'aprovada';
  }, [atual, podeEditar, executar, aplicarVersao, carregar, avisarPdf]);

  const recusar = useCallback(async (motivo: string): Promise<string | null> => {
    if (!atual || (atual.status !== 'enviado' && atual.status !== 'aprovado') || !podeEditar) return null;
    const v = await executar('recusando', 'Não foi possível registrar a recusa.', async () =>
      (await api.recusarOrcamento(atual.id, { motivo: motivo.trim() })) as Orcamento);
    if (!v) {
      carregar();
      return null;
    }
    aplicarVersao(v);
    return v.osStatus ?? 'recusada';
  }, [atual, podeEditar, executar, aplicarVersao, carregar]);

  /** Descarta as alterações não salvas e volta ao que o servidor tem. */
  const descartarAlteracoes = useCallback(() => {
    sincronizar(rascunho);
    setErroAcao(null);
  }, [rascunho, sincronizar]);

  return {
    versoes, atual, rascunho,
    carregando, erro, erroAcao, setErroAcao, avisoPdf, acao,
    recarregar: carregar,

    // rascunho em edição
    itens, observacoes, setObservacoes, validadeDias, setValidadeDias,
    adicionarItem, adicionarItens, substituirItens, atualizarItem, removerItem,
    errosItens, mostrarErros, formularioValido, sujo, diasValidos, observacoesLongas,
    podeVerCusto,

    // catálogos
    estoque, servicos, catalogosCarregados,

    // operações
    criarRascunho, salvar, enviar, aprovar, recusar, descartarAlteracoes,
  };
}
