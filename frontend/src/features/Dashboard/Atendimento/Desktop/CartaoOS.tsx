import { statusAntesDaExecucao, statusEmExecucao } from '../../../../utils/ordem_status';
import { momentoConclusao } from '../../../../utils/atendimento_utils';
import type { ReactNode } from 'react';
import type { Agendamento } from '../../../../types/agendamento';
import type { ItemKanban, KanbanColunaId, OSAtendimento } from '../../../../types/atendimento';
import { PlacaMercosul } from '../../PlacaMercosul';
import { mecanicoDaOrdem } from '../../Ordens/ordensUtils';
import { IcAlerta, IcPacote, IcPessoa, IcRelogio } from './icones';
import { statusDoCartao } from './statusCartao';
import { decorridoMs, duracaoCurta, previsaoEmMinutos } from './tempo';

const DIA_MS = 86_400_000;

export function primeiroNome(nome?: string | null): string | null {
  const n = (nome ?? '').trim();
  return n ? n.split(/\s+/)[0] : null;
}

/** Quem está com o carro: mecânico do agendamento ligado à OS, ou o técnico gravado na OS. */
export function mecanicoDoItem(item: ItemKanban, vinculado?: Agendamento): string | null {
  if (item.tipo === 'agendamento') return primeiroNome(item.agendamento.mecanico);
  return primeiroNome(vinculado?.mecanico) ?? mecanicoDaOrdem(item.ordem);
}

interface CartaoProps {
  item: ItemKanban;
  coluna: KanbanColunaId;
  /** Date.now() atualizado a cada minuto pela tela. */
  agora: number;
  /** Agendamento que originou a OS (dá a previsão de duração, o serviço e o mecânico). */
  vinculado?: Agendamento;
  qtdPecas?: number;
  possivelRetorno?: boolean;
  onAbrir: (ordem: OSAtendimento) => void;
  onIniciarAtendimento: (agendamento: Agendamento) => void;
}

const PRIORIDADE = { vip: 'VIP', garantia: 'Garantia' } as const;

function Meta({ tom = 'neutro', icone, children }: { tom?: 'neutro' | 'aviso' | 'critico'; icone: ReactNode; children: ReactNode }) {
  return (
    <span className={`at-meta at-meta--${tom}`}>
      {icone}
      <span className="at-meta__txt">{children}</span>
    </span>
  );
}

export function CartaoOS({ item, coluna, agora, vinculado, qtdPecas, possivelRetorno, onAbrir, onIniciarAtendimento }: CartaoProps) {
  const mecanico = mecanicoDoItem(item, vinculado);
  const mecanicoMeta = (
    <Meta icone={IcPessoa}>{mecanico ?? 'Sem mecânico'}</Meta>
  );

  // ── Agendamento de hoje que ainda não virou OS ──────────────────────────────
  if (item.tipo === 'agendamento') {
    const { agendamento: ag } = item;
    return (
      <article className="at-cartao">
        <div className="at-cartao__topo">
          <PlacaMercosul placa={ag.placa} />
          <span className="at-pill at-pill--agendado">Agendado · {ag.horaInicio}</span>
        </div>
        <div className="at-cartao__linha-titulo">
          <h3 className="at-cartao__titulo">{[ag.veiculo, ag.cliente].filter(Boolean).join(' · ')}</h3>
        </div>
        {ag.titulo && <p className="at-cartao__detalhe">{ag.titulo}</p>}
        <div className="at-cartao__metas">{mecanicoMeta}</div>
        <button type="button" className="at-btn at-btn--bloco" onClick={() => onIniciarAtendimento(ag)}>
          Iniciar atendimento
        </button>
      </article>
    );
  }

  // ── OS de verdade ────────────────────────────────────────────────────────────
  const { ordem } = item;
  const st = statusDoCartao(ordem.status);
  const emExecucao = statusEmExecucao(ordem.status) || (statusAntesDaExecucao(ordem.status) && !!ordem.iniciadoEm);

  let tempo: JSX.Element | null = null;
  let progresso: { pct: number; estourou: boolean; atual: number; previsto: number } | null = null;

  if (coluna === 'fila') {
    const ms = decorridoMs(ordem.created_at, agora);
    if (ms !== null) {
      tempo = (
        <Meta icone={IcRelogio} tom={ms >= DIA_MS ? 'aviso' : 'neutro'}>
          {ordem.status === 'rascunho' ? 'na fila há ' : 'há '}{duracaoCurta(ms)}
        </Meta>
      );
    }
  } else if (coluna === 'em_execucao' && emExecucao) {
    const ms = decorridoMs(ordem.iniciadoEm, agora);
    const previsto = vinculado ? previsaoEmMinutos(vinculado.horaInicio, vinculado.horaFim) : null;
    if (ms !== null) {
      tempo = (
        <Meta icone={IcRelogio}>
          há {duracaoCurta(ms)}{previsto ? ` · prev. ${duracaoCurta(previsto * 60000)}` : ''}
        </Meta>
      );
      if (previsto) {
        const atual = ms / 60000;
        progresso = { pct: Math.min(100, (atual / previsto) * 100), estourou: atual > previsto, atual, previsto };
      }
    }
  } else if (coluna === 'bloqueado') {
    const ms = decorridoMs(ordem.updated_at, agora);
    if (ms !== null) tempo = <Meta icone={IcRelogio} tom="critico">parada há {duracaoCurta(ms)}</Meta>;
  } else if (coluna === 'concluido') {
    const ms = decorridoMs(momentoConclusao(ordem), agora);
    if (ms !== null) tempo = <Meta icone={IcRelogio}>concluída há {duracaoCurta(ms)}</Meta>;
  }

  const chips = [
    ordem.prioridade ? { chave: 'p', texto: PRIORIDADE[ordem.prioridade], tom: ordem.prioridade === 'vip' ? 'aviso' : 'ok' } : null,
    possivelRetorno ? { chave: 'r', texto: 'Possível retorno', tom: 'critico' } : null,
    qtdPecas ? { chave: 'i', texto: `${qtdPecas} ${qtdPecas === 1 ? 'item' : 'itens'}`, tom: 'neutro', icone: IcPacote } : null,
  ].filter((c): c is { chave: string; texto: string; tom: string; icone?: ReactNode } => !!c);

  const abrir = () => onAbrir(ordem);

  return (
    <article
      className={`at-cartao at-cartao--${coluna} at-cartao--clicavel`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir OS ${ordem.os_num} de ${ordem.cliente}`}
      onClick={abrir}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
      }}
    >
      <div className="at-cartao__topo">
        <PlacaMercosul placa={ordem.placa} />
        <span className={`at-pill at-pill--${st.tom}`}>{st.rotulo}</span>
      </div>

      <div className="at-cartao__linha-titulo">
        <h3 className="at-cartao__titulo">{[ordem.modelo, ordem.cliente].filter(Boolean).join(' · ')}</h3>
        <span className="at-cartao__os">#{ordem.os_num}</span>
      </div>

      {coluna === 'em_execucao' && vinculado?.titulo && <p className="at-cartao__detalhe">{vinculado.titulo}</p>}

      {coluna === 'bloqueado' && ordem.motivoBloqueio && (
        <div className="at-motivo" role="note">
          <span className="at-motivo__icone">{IcAlerta}</span>
          <span><strong>Motivo:</strong> {ordem.motivoBloqueio}</span>
        </div>
      )}

      {chips.length > 0 && (
        <div className="at-cartao__chips">
          {chips.map(c => (
            <span key={c.chave} className={`at-chip at-chip--${c.tom}`}>
              {c.icone}
              {c.texto}
            </span>
          ))}
        </div>
      )}

      <div className="at-cartao__metas">
        {tempo}
        {mecanicoMeta}
      </div>

      {progresso && (
        <div
          className="at-progresso"
          role="progressbar"
          aria-label="Tempo gasto em relação ao previsto"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso.pct)}
        >
          <div
            className={`at-progresso__barra${progresso.estourou ? ' at-progresso__barra--estourou' : ''}`}
            style={{ width: `${progresso.pct}%` }}
          />
        </div>
      )}
    </article>
  );
}
