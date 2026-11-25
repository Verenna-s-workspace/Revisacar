import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../utils/api';
import { mensagemDoErro } from '../../../utils/api_erro';
import { DEFAULT_HORA_ABERTURA, DEFAULT_HORA_FECHAMENTO } from '../../../utils/agenda';
import {
  donoDaCopiaLocal, podeEditarConfiguracoes, salvarOficinaConfig, sincronizarOficinaConfig,
} from '../../../utils/oficina_config';
import type { OficinaConfig } from '../../../utils/oficina_config';

// Sem nada salvo neste navegador, os campos começam vazios (nome e CNPJ vêm da
// conta logada) — antes vinham dados de exemplo que pareciam ser da oficina.
const WORKSHOP_DEFAULTS: OficinaConfig = {
  nome: '',
  cnpj: '',
  telefone: '',
  email: '',
  endereco: '',
  valorHora: 0,
  horaAbertura: DEFAULT_HORA_ABERTURA,
  horaFechamento: DEFAULT_HORA_FECHAMENTO,
};

// Campos editáveis (o CNPJ é o login da conta e não muda por aqui).
const CAMPOS_EDITAVEIS = ['nome', 'telefone', 'email', 'endereco', 'valorHora', 'horaAbertura', 'horaFechamento'] as const;

/** Estado inicial: cópia local (se for desta oficina) mesclada com os padrões. */
function lerEstadoInicial(user: ReturnType<typeof useAuth>['user']): OficinaConfig {
  // Só a conta do dono é a oficina; no login de funcionário `nome` é o da pessoa.
  const dono = user && user.tipo !== 'funcionario';
  const padrao: OficinaConfig = { ...WORKSHOP_DEFAULTS, nome: dono ? user.nome : '', cnpj: dono ? user.doc ?? '' : '' };
  const saved = localStorage.getItem('oficina_config');
  if (!saved) return padrao;
  try {
    const local = JSON.parse(saved);
    // Cópia de outra oficina (computador compartilhado) não aparece aqui nem por um instante;
    // a antiga (CNPJ de exemplo) aparece pra pessoa conferir — e só vai ao servidor se ela salvar.
    return donoDaCopiaLocal(local, user?.doc) === 'outra' ? padrao : { ...padrao, ...local };
  } catch {
    return padrao;
  }
}

/**
 * Dados da oficina (Configurações): estado, sincronização com o servidor, salvar e descartar.
 * Compartilhado pelas seções "Dados da oficina" e "Horário de funcionamento", que editam o mesmo
 * conjunto e salvam juntas — por isso o estado vive na página e não em cada seção.
 */
export function useOficinaConfig() {
  const { user } = useAuth();
  const podeEditar = podeEditarConfiguracoes(user);

  const [workshop, setWorkshop] = useState<OficinaConfig>(() => lerEstadoInicial(user));
  // Último estado "confirmado" (do servidor, da cópia local ou do último salvar): é pra onde o Descartar volta.
  const [original, setOriginal] = useState<OficinaConfig>(workshop);

  // O servidor é a fonte (migração 0005); o estado acima, da cópia local, só evita a tela vazia
  // enquanto ele responde. Sem resposta (rede/servidor), fica a cópia local.
  const [carregandoServidor, setCarregandoServidor] = useState(true);
  useEffect(() => {
    let vivo = true;
    sincronizarOficinaConfig(podeEditar).then(servidor => {
      if (!vivo) return;
      if (servidor) {
        const { salvo, atualizadoEm: _em, ...dados } = servidor;
        // Salvo no servidor: vale o servidor. Ainda não: fica o que a tela mostrava (cópia local
        // desta oficina ou antiga), só com o CNPJ e o nome da conta quando faltam.
        const aplicar = (atual: OficinaConfig): OficinaConfig =>
          salvo ? dados : { ...atual, cnpj: dados.cnpj, nome: atual.nome || dados.nome };
        setWorkshop(aplicar);
        setOriginal(aplicar);
      }
      setCarregandoServidor(false);
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvou, setSalvou] = useState(false);
  const [horarioTentouSalvar, setHorarioTentouSalvar] = useState(false);

  const horarioInvalido = workshop.horaFechamento <= workshop.horaAbertura;
  const erroFechamento = horarioTentouSalvar && horarioInvalido ? 'Deve ser depois do horário de abertura.' : undefined;
  const alterado = CAMPOS_EDITAVEIS.some(campo => workshop[campo] !== original[campo]);

  const limparAvisos = () => { setSalvou(false); setErroSalvar(null); };

  const atualizar = (patch: Partial<OficinaConfig>) => {
    setWorkshop(atual => ({ ...atual, ...patch }));
    limparAvisos();
  };

  const descartar = () => {
    setWorkshop(original);
    setHorarioTentouSalvar(false);
    limparAvisos();
  };

  const salvar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (horarioInvalido) {
      // O campo com o erro fica na seção "Horário de funcionamento": avisa também aqui, onde a pessoa clicou.
      setHorarioTentouSalvar(true);
      setSalvou(false);
      setErroSalvar('Corrija o horário de funcionamento antes de salvar.');
      return;
    }
    setErroSalvar(null);
    setSalvando(true);
    try {
      const { cnpj: _cnpj, ...dados } = workshop;   // CNPJ é o login da conta: o servidor não troca
      const resposta = await api.salvarConfigOficina(dados);
      const { salvo: _s, atualizadoEm: _em, ...confirmado } = resposta;
      setWorkshop(confirmado);
      setOriginal(confirmado);
      setHorarioTentouSalvar(false);
      try { salvarOficinaConfig(confirmado); } catch { /* cópia local é só cache */ }
      setSalvou(true);
      setTimeout(() => setSalvou(false), 3000);
    } catch (erro) {
      setErroSalvar(mensagemDoErro(erro, 'Não foi possível salvar os dados da oficina. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  return {
    workshop, original, atualizar, descartar, salvar, limparAvisos,
    alterado, podeEditar, salvando, carregandoServidor, salvou, erroSalvar,
    horarioInvalido, erroFechamento,
  };
}

export type OficinaConfigState = ReturnType<typeof useOficinaConfig>;
