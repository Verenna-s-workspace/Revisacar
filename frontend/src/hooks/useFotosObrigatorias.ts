import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import { comprimirImagem } from '../utils/imagem';
import {
  exigeFotosObrigatorias, fotosEditaveis, fotosObrigatoriasVazias, validarMotivo,
  type FotosObrigatorias, type SlotFoto,
} from '../utils/fotos_obrigatorias';
import type { Photo } from '../types';

/**
 * Estado das 5 fotos obrigatórias da entrada. Vive dentro de `useOrdemServico` (uma instância no
 * App, compartilhada pelas etapas), pra o bloqueio valer na tela de fotos, nas abas e no
 * "Próxima etapa" do encerramento.
 *
 *  fonte: 'inicial' (OS ainda sem id) · 'carregando' · 'ok' · 'erro' (rede/servidor) ·
 *         'indisponivel' (ordens_fotos.sql não rodado: a regra não vale e a tela cai no modo antigo)
 */
export type FonteFotos = 'inicial' | 'carregando' | 'ok' | 'erro' | 'indisponivel';

interface Falha { dataUrl: string; blob: Blob }

const SEM_SCRIPT = 'ordens_fotos.sql';
const dataUrlDeBase64 = (b64: string) => `data:image/jpeg;base64,${b64}`;

export function useFotosObrigatorias(orderId: string | null, ordemStatus: string | null) {
  const [dados, setDados] = useState<FotosObrigatorias | null>(null);
  const [fonte, setFonte] = useState<FonteFotos>('inicial');
  const [erroGeral, setErroGeral] = useState('');
  const [miniaturas, setMiniaturas] = useState<Partial<Record<SlotFoto, string>>>({});
  const [ocupados, setOcupados] = useState<Partial<Record<SlotFoto, boolean>>>({});
  const [erros, setErros] = useState<Partial<Record<SlotFoto, string>>>({});
  const [falhas, setFalhas] = useState<Partial<Record<SlotFoto, Falha>>>({});
  const geracao = useRef(0);               // descarta resposta de uma OS/consulta que já foi trocada
  const falhasRef = useRef(falhas);
  falhasRef.current = falhas;

  const marcar = <T,>(setter: React.Dispatch<React.SetStateAction<Partial<Record<SlotFoto, T>>>>, slot: SlotFoto, valor: NoInfer<T> | undefined) =>
    setter((prev) => {
      const next = { ...prev };
      if (valor === undefined) delete next[slot]; else next[slot] = valor;
      return next;
    });

  const aplicar = useCallback((resposta: FotosObrigatorias) => {
    const { itens, total, resolvidas, completo, faltam } = resposta;
    setDados({ itens, total, resolvidas, completo, faltam });
  }, []);

  // Baixa a miniatura das fotos que o servidor já tem e ainda não temos na tela.
  const buscarMiniaturas = useCallback(async (resposta: FotosObrigatorias, minha: number) => {
    const faltando = resposta.itens.filter((i) => i.situacao === 'foto' && i.path);
    await Promise.all(faltando.map(async (item) => {
      try {
        const r = await api.baixarFoto(item.path as string);
        if (geracao.current !== minha) return;
        setMiniaturas((prev) => (prev[item.slot] ? prev : { ...prev, [item.slot]: dataUrlDeBase64(r.data) }));
      } catch (e) {
        console.error(`Erro ao carregar a foto de ${item.slot}:`, e);
      }
    }));
  }, []);

  const carregar = useCallback(async () => {
    const minha = ++geracao.current;
    if (!orderId) {
      setDados(null); setFonte('inicial'); setErroGeral('');
      setMiniaturas({}); setOcupados({}); setErros({}); setFalhas({});
      return;
    }
    setFonte('carregando');
    setErroGeral('');
    try {
      const resposta = (await api.fotosObrigatorias(orderId)) as FotosObrigatorias;
      if (geracao.current !== minha) return;
      aplicar(resposta);
      setFonte('ok');
      void buscarMiniaturas(resposta, minha);
    } catch (e) {
      if (geracao.current !== minha) return;
      const texto = e instanceof Error ? e.message : '';
      if (texto.includes(SEM_SCRIPT)) {
        setFonte('indisponivel');
        setErroGeral(mensagemDoErro(e, 'As fotos obrigatórias ainda não existem no banco.'));
      } else {
        setFonte('erro');
        setErroGeral(mensagemDoErro(e, 'Não foi possível carregar as fotos obrigatórias.'));
      }
    }
  }, [orderId, aplicar, buscarMiniaturas]);

  // Trocou de OS (abrir outra, nova OS, primeiro salvamento): começa do zero e consulta.
  useEffect(() => {
    setMiniaturas({}); setOcupados({}); setErros({}); setFalhas({});
    void carregar();
  }, [carregar]);

  const enviarBlob = useCallback(async (slot: SlotFoto, blob: Blob, dataUrl: string): Promise<boolean> => {
    if (!orderId) return false;
    marcar(setOcupados, slot, true);
    marcar(setErros, slot, undefined);
    try {
      const resposta = (await api.enviarFotoObrigatoria(orderId, slot, blob)) as FotosObrigatorias;
      aplicar(resposta);
      marcar(setMiniaturas, slot, dataUrl);
      marcar(setFalhas, slot, undefined);
      setFonte('ok');
      return true;
    } catch (e) {
      // Guarda a foto já comprimida para "Tentar de novo" sem precisar fotografar outra vez.
      marcar(setFalhas, slot, { dataUrl, blob });
      marcar(setErros, slot, mensagemDoErro(e, 'Não foi possível enviar a foto. Verifique a internet e tente de novo.'));
      return false;
    } finally {
      marcar(setOcupados, slot, undefined);
    }
  }, [orderId, aplicar]);

  /** Recebe a foto da câmera (data URL), comprime e envia. Tirar de novo substitui a anterior. */
  const tirarFoto = useCallback(async (slot: SlotFoto, foto: Photo): Promise<boolean> => {
    marcar(setOcupados, slot, true);
    marcar(setErros, slot, undefined);
    try {
      const { blob, dataUrl } = await comprimirImagem(foto.src);
      return await enviarBlob(slot, blob, dataUrl);
    } catch (e) {
      marcar(setErros, slot, mensagemDoErro(e, 'Não foi possível preparar a foto. Tire de novo.'));
      return false;
    } finally {
      marcar(setOcupados, slot, undefined);
    }
  }, [enviarBlob]);

  const reenviar = useCallback(async (slot: SlotFoto): Promise<boolean> => {
    const falha = falhasRef.current[slot];
    if (!falha) return false;
    return enviarBlob(slot, falha.blob, falha.dataUrl);
  }, [enviarBlob]);

  /** "Não consigo tirar esta foto": registra o motivo e conta como resolvido. */
  const pular = useCallback(async (slot: SlotFoto, motivoBruto: string): Promise<boolean> => {
    if (!orderId) return false;
    const valido = validarMotivo(motivoBruto);
    if (!valido.ok) { marcar(setErros, slot, valido.erro); return false; }
    marcar(setOcupados, slot, true);
    marcar(setErros, slot, undefined);
    try {
      const resposta = (await api.pularFotoObrigatoria(orderId, slot, valido.motivo)) as FotosObrigatorias;
      aplicar(resposta);
      marcar(setMiniaturas, slot, undefined);
      marcar(setFalhas, slot, undefined);
      setFonte('ok');
      return true;
    } catch (e) {
      marcar(setErros, slot, mensagemDoErro(e, 'Não foi possível registrar o motivo. Tente de novo.'));
      return false;
    } finally {
      marcar(setOcupados, slot, undefined);
    }
  }, [orderId, aplicar]);

  const exigida = exigeFotosObrigatorias(ordemStatus);
  const somenteLeitura = !fotosEditaveis(ordemStatus);
  const resumo = dados ?? fotosObrigatoriasVazias();
  // Pode seguir: OS que já passou da entrada, script ainda não rodado (modo antigo) ou as 5 resolvidas.
  const liberado = !exigida || fonte === 'indisponivel' || (fonte === 'ok' && !!dados?.completo);

  /** Fotos já enviadas, na ordem fixa, com o nome do item — para o relatório PDF. */
  const fotosParaPdf = useMemo<Photo[]>(
    () => resumo.itens
      .filter((i) => i.situacao === 'foto' && miniaturas[i.slot])
      .map((i) => ({ src: miniaturas[i.slot] as string, name: i.rotulo, path: i.path })),
    [resumo, miniaturas],
  );

  return {
    resumo, fonte, erroGeral, miniaturas, ocupados, erros, falhas,
    exigida, somenteLeitura, liberado, fotosParaPdf,
    carregar, tirarFoto, reenviar, pular,
  };
}

export type FotosObrigatoriasEstado = ReturnType<typeof useFotosObrigatorias>;
