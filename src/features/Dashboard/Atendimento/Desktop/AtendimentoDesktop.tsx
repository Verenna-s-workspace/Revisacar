import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import type { Agendamento } from '../../../../types/agendamento';
import type { ColunasKanban, ItemKanban, KanbanColunaId, OSAtendimento } from '../../../../types/atendimento';
import { CartaoOS, mecanicoDoItem, primeiroNome } from './CartaoOS';
import { AlertaClientesNaoAvisados } from '../AlertaClientesNaoAvisados';
import './atendimento.css';
import { ColunaAtendimento } from './ColunaAtendimento';
import { IcCalendario } from './icones';

interface Props {
  colunas: ColunasKanban;
  agendamentos: Agendamento[];
  loading: boolean;
  erro: string | null;
  clientesNaoAvisados: OSAtendimento[];
  proximoAgendamento: Agendamento | null;
  qtdPecasPorOrdem: Record<string, number>;
  possivelRetornoPorOrdem: Record<string, boolean>;
  onAbrirOS: (ordem: OSAtendimento) => void;
  onIniciarAtendimento: (agendamento: Agendamento) => void;
  onVerClientesNaoAvisados?: () => void;
}

// Organização do quadro: 4 colunas, cada uma com a sua cor.
// (os ids são os mesmos de sempre — a derivação das colunas não mudou)
const COLUNAS: { id: KanbanColunaId; titulo: string; cor: string; vazio: string }[] = [
  { id: 'fila',        titulo: 'Fila',                 cor: '#8458F0', vazio: 'Nenhum carro na fila.' },
  { id: 'em_execucao', titulo: 'Em execução',          cor: '#3469EC', vazio: 'Nenhum carro em execução.' },
  { id: 'bloqueado',   titulo: 'Aguardando peça',      cor: '#EA580C', vazio: 'Nenhum carro parado.' },
  { id: 'concluido',   titulo: 'Pronto para entregar', cor: '#1E9C5B', vazio: 'Os carros prontos hoje aparecem aqui.' },
];

type Escopo = 'todos' | 'meus';

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function AtendimentoDesktop({
  colunas, agendamentos, loading, erro, clientesNaoAvisados, proximoAgendamento,
  qtdPecasPorOrdem, possivelRetornoPorOrdem, onAbrirOS, onIniciarAtendimento, onVerClientesNaoAvisados,
}: Props) {
  const { user } = useAuth();
  const [escopo, setEscopo] = useState<Escopo>('todos');

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

  const chaveItem = (item: ItemKanban) => (item.tipo === 'agendamento' ? `ag-${item.agendamento.id}` : `os-${item.ordem.id}`);

  const itensDaColuna = (id: KanbanColunaId): ItemKanban[] => {
    const itens = colunas[id];
    if (!filtraMeus) return itens;
    return itens.filter(item => {
      const m = mecanicoDoItem(item, item.tipo === 'os' ? vinculados.get(item.ordem.id) : undefined);
      return !!m && semAcento(m) === semAcento(meuNome!);
    });
  };

  const proximo = proximoAgendamento;

  return (
    <div className="at-page">
      <header className="at-header">
        <div className="at-header__titulos">
          <h1 className="at-titulo">Atendimento</h1>
          <p className="at-subtitulo">Quem está com cada carro e há quanto tempo</p>
        </div>

        <div className="at-header__acoes">
          {!loading && proximo && (
            <div className="at-proximo" title="Próximo agendamento de hoje">
              {IcCalendario}
              <span>
                Próximo agendamento: <strong>{proximo.horaInicio}</strong> · {proximo.cliente} · {proximo.veiculo}
              </span>
            </div>
          )}
          <div className="at-segmentado" role="group" aria-label="Quais carros mostrar">
            <button type="button" className="at-segmentado__item" aria-pressed={escopo === 'todos'} onClick={() => setEscopo('todos')}>
              Todos
            </button>
            <button type="button" className="at-segmentado__item" aria-pressed={escopo === 'meus'} onClick={() => setEscopo('meus')}>
              Só os meus
            </button>
          </div>
        </div>
      </header>

      {erro && <div className="at-erro" role="alert">{erro}</div>}

      <AlertaClientesNaoAvisados clientes={clientesNaoAvisados} onAbrirOS={onAbrirOS} onVerMais={onVerClientesNaoAvisados} />

      <div className="at-quadro">
        {COLUNAS.map(col => {
          const itens = itensDaColuna(col.id);
          return (
            <ColunaAtendimento
              key={col.id}
              titulo={col.titulo}
              cor={col.cor}
              total={itens.length}
              loading={loading}
              textoVazio={filtraMeus ? 'Nenhum carro seu aqui.' : col.vazio}
              cartoes={itens.map(item => (
                <CartaoOS
                  key={chaveItem(item)}
                  item={item}
                  coluna={col.id}
                  agora={agora}
                  vinculado={item.tipo === 'os' ? vinculados.get(item.ordem.id) : undefined}
                  qtdPecas={item.tipo === 'os' ? qtdPecasPorOrdem[item.ordem.id] : undefined}
                  possivelRetorno={item.tipo === 'os' ? possivelRetornoPorOrdem[item.ordem.id] : undefined}
                  onAbrir={onAbrirOS}
                  onIniciarAtendimento={onIniciarAtendimento}
                />
              ))}
            />
          );
        })}
      </div>
    </div>
  );
}
