import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { Skeleton } from '../../Primitives';
import type { Agendamento } from '../../../../types/agendamento';
import type { ColunasKanban, ItemKanban, KanbanColunaId, OSAtendimento } from '../../../../types/atendimento';
import { AlertaClientesNaoAvisados } from '../AlertaClientesNaoAvisados';
import { mecanicoDoItem, primeiroNome } from '../Desktop/CartaoOS';
import { IcCalendario } from '../Desktop/icones';
import { CartaoMobile } from './CartaoMobile';
import '../Desktop/atendimento.css';
import './atendimentoMobile.css';

interface Props {
  colunas: ColunasKanban;
  agendamentos: Agendamento[];
  loading: boolean;
  erro: string | null;
  clientesNaoAvisados: OSAtendimento[];
  proximoAgendamento: Agendamento | null;
  qtdPecasPorOrdem: Record<string, number>;
  possivelRetornoPorOrdem: Record<string, boolean>;
  onVoltar: () => void;
  onAbrirOS: (ordem: OSAtendimento) => void;
  onContinuarChecklist: (ordem: OSAtendimento) => void;
  onPecaChegou: (ordemId: string) => void;
  onIniciarAtendimento: (agendamento: Agendamento) => void;
  onVerClientesNaoAvisados?: () => void;
}

// No celular quem está trabalhando vem primeiro: Em execução, Fila, Aguardando peça, Pronto.
const SECOES: { id: KanbanColunaId; titulo: string }[] = [
  { id: 'em_execucao', titulo: 'Em execução' },
  { id: 'fila',        titulo: 'Fila' },
  { id: 'bloqueado',   titulo: 'Aguardando peça' },
  { id: 'concluido',   titulo: 'Pronto para entregar' },
];

const LIMITE_POR_SECAO = 5;

type Escopo = 'todos' | 'meus';

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const IcVoltar = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export function AtendimentoMobile({
  colunas, agendamentos, loading, erro, clientesNaoAvisados, proximoAgendamento,
  qtdPecasPorOrdem, possivelRetornoPorOrdem,
  onVoltar, onAbrirOS, onContinuarChecklist, onPecaChegou, onIniciarAtendimento, onVerClientesNaoAvisados,
}: Props) {
  const { user } = useAuth();
  const [escopo, setEscopo] = useState<Escopo>('todos');
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  // Os tempos dos cartões ("há 1 h 20") se atualizam sozinhos a cada minuto.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // OS -> agendamento que a originou (previsão de duração, serviço e mecânico).
  const vinculados = useMemo(() => {
    const mapa = new Map<string, Agendamento>();
    for (const a of agendamentos) if (a.ordemServicoId) mapa.set(a.ordemServicoId, a);
    return mapa;
  }, [agendamentos]);

  const meuNome = primeiroNome(user?.nome);
  const filtraMeus = escopo === 'meus' && !!meuNome;

  const itensDaSecao = (id: KanbanColunaId): ItemKanban[] => {
    const itens = colunas[id];
    if (!filtraMeus) return itens;
    return itens.filter(item => {
      const m = mecanicoDoItem(item, item.tipo === 'os' ? vinculados.get(item.ordem.id) : undefined);
      return !!m && semAcento(m) === semAcento(meuNome!);
    });
  };

  const secoes = SECOES
    .map(s => ({ ...s, itens: itensDaSecao(s.id) }))
    .filter(s => s.itens.length > 0);

  const proximo = proximoAgendamento;

  return (
    <div className="atm-page">
      <header className="atm-topo">
        <div className="atm-barra">
          <button type="button" className="atm-voltar" onClick={onVoltar} aria-label="Voltar para a Visão Geral">
            {IcVoltar}
          </button>
          <div className="atm-barra__titulos">
            <h1 className="atm-titulo">Atendimento</h1>
            <p className="atm-subtitulo">Quem está com cada carro e há quanto tempo</p>
          </div>
        </div>

        <div className="atm-seg-linha">
          <div className="atm-segmentado" role="group" aria-label="Quais carros mostrar">
            <button type="button" className="atm-segmentado__item" aria-pressed={escopo === 'todos'} onClick={() => setEscopo('todos')}>
              Todos
            </button>
            <button type="button" className="atm-segmentado__item" aria-pressed={escopo === 'meus'} onClick={() => setEscopo('meus')}>
              Só os meus
            </button>
          </div>
        </div>
      </header>

      {erro && <div className="atm-erro" role="alert">{erro}</div>}

      {!loading && proximo && (
        <div className="atm-faixa">
          <div className="at-proximo">
            {IcCalendario}
            <span>
              Próximo agendamento: <strong>{proximo.horaInicio}</strong> · {proximo.cliente} · {proximo.veiculo}
            </span>
          </div>
        </div>
      )}

      <div className="atm-faixa atm-faixa--alerta">
        <AlertaClientesNaoAvisados clientes={clientesNaoAvisados} onAbrirOS={onAbrirOS} onVerMais={onVerClientesNaoAvisados} />
      </div>

      {loading ? (
        <section className="atm-secao" aria-busy="true" aria-label="Carregando">
          <div className="atm-carregando">
            <Skeleton h={160} r={8} />
            <Skeleton h={160} r={8} />
          </div>
        </section>
      ) : secoes.length === 0 ? (
        <div className="atm-vazio">
          <strong>{filtraMeus ? 'Nenhum carro seu aqui' : 'Nenhum carro no atendimento agora'}</strong>
          <span>{filtraMeus ? 'Os carros com você aparecem aqui' : 'Quando uma OS entrar na fila, ela aparece aqui'}</span>
        </div>
      ) : (
        secoes.map(secao => {
          const excede = secao.itens.length > LIMITE_POR_SECAO;
          const aberta = !!expandidas[secao.id];
          const visiveis = excede && !aberta ? secao.itens.slice(0, LIMITE_POR_SECAO) : secao.itens;
          return (
            <section key={secao.id} className="atm-secao" aria-label={secao.titulo}>
              <h2 className="atm-secao__titulo">{secao.titulo} · {secao.itens.length}</h2>
              <div>
                {visiveis.map(item => (
                  <CartaoMobile
                    key={item.tipo === 'agendamento' ? `ag-${item.agendamento.id}` : `os-${item.ordem.id}`}
                    item={item}
                    coluna={secao.id}
                    agora={agora}
                    vinculado={item.tipo === 'os' ? vinculados.get(item.ordem.id) : undefined}
                    qtdPecas={item.tipo === 'os' ? qtdPecasPorOrdem[item.ordem.id] : undefined}
                    possivelRetorno={item.tipo === 'os' ? possivelRetornoPorOrdem[item.ordem.id] : undefined}
                    onVerOS={onAbrirOS}
                    onContinuarChecklist={onContinuarChecklist}
                    onPecaChegou={onPecaChegou}
                    onIniciarAtendimento={onIniciarAtendimento}
                  />
                ))}
              </div>
              {excede && (
                <button
                  type="button"
                  className="atm-vermais"
                  aria-expanded={aberta}
                  onClick={() => setExpandidas(e => ({ ...e, [secao.id]: !aberta }))}
                >
                  {aberta ? 'Mostrar menos' : `Ver mais ${secao.itens.length - LIMITE_POR_SECAO}`}
                </button>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}