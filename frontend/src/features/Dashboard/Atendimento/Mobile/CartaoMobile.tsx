import type { ReactNode } from 'react';
import { statusAntesDaExecucao, statusEmExecucao } from '../../../../utils/ordem_status';
import { momentoConclusao } from '../../../../utils/atendimento_utils';
import type { Agendamento } from '../../../../types/agendamento';
import type { ItemKanban, KanbanColunaId, OSAtendimento } from '../../../../types/atendimento';
import { PlacaMercosul } from '../../PlacaMercosul';
import { mecanicoDoItem } from '../Desktop/CartaoOS';
import { IcAlerta, IcPacote, IcPessoa, IcRelogio } from '../Desktop/icones';
import { statusDoCartao } from '../Desktop/statusCartao';
import { decorridoMs, duracaoCurta, previsaoEmMinutos } from '../Desktop/tempo';

const DIA_MS = 86_400_000;
const PRIORIDADE = { vip: 'VIP', garantia: 'Garantia' } as const;

interface Props {
  item: ItemKanban;
  coluna: KanbanColunaId;
  /** Date.now() atualizado a cada minuto pela tela. */
  agora: number;
  /** Agendamento que originou a OS (dá a previsão de duração, o serviço e o mecânico). */
  vinculado?: Agendamento;
  qtdPecas?: number;
  possivelRetorno?: boolean;
  onVerOS: (ordem: OSAtendimento) => void;
  /** "Iniciar" / "Concluir": abre o checklist da OS (marca como iniciada se ainda não era). */
  onContinuarChecklist: (ordem: OSAtendimento) => void;
  onPecaChegou: (ordemId: string) => void;
  onIniciarAtendimento: (agendamento: Agendamento) => void;
}

function Meta({ tom = 'neutro', icone, children }: { tom?: 'neutro' | 'aviso' | 'critico'; icone: ReactNode; children: ReactNode }) {
  return (
    <span className={`at-meta at-meta--${tom}`}>
      {icone}
      <span className="at-meta__txt">{children}</span>
    </span>
  );
}

export function CartaoMobile({
  item, coluna, agora, vinculado, qtdPecas, possivelRetorno,
  onVerOS, onContinuarChecklist, onPecaChegou, onIniciarAtendimento,
}: Props) {
  const mecanico = mecanicoDoItem(item, vinculado);
  const mecanicoMeta = <Meta icone={IcPessoa}>{mecanico ?? 'Sem mecânico'}</Meta>;

  // ── Agendamento de hoje que ainda não virou OS ──────────────────────────────
  if (item.tipo === 'agendamento') {
    const { agendamento: ag } = item;
    return (
      <article className="atm-cartao">
        <div className="atm-cartao__topo">
          <PlacaMercosul placa={ag.placa} />
          <span className="atm-cartao__os" />
          <span className="at-pill at-pill--agendado">Agendado · {ag.horaInicio}</span>
        </div>
        <h3 className="atm-cartao__titulo">{[ag.veiculo, ag.cliente].filter(Boolean).join(' · ')}</h3>
        <div className="atm-cartao__metas">
          {ag.titulo && <Meta icone={IcRelogio}>{ag.titulo}</Meta>}
          {mecanicoMeta}
        </div>
        <div className="atm-acoes">
          <button type="button" className="atm-btn atm-btn--bloco" onClick={() => onIniciarAtendimento(ag)}>
            Iniciar atendimento
          </button>
        </div>
      </article>
    );
  }

  // ── OS de verdade ────────────────────────────────────────────────────────────
  const { ordem } = item;
  const st = statusDoCartao(ordem.status);
  const emExecucao = statusEmExecucao(ordem.status) || (statusAntesDaExecucao(ordem.status) && !!ordem.iniciadoEm);
  const servico = vinculado?.titulo ?? null;

  let tempoTexto: string | null = null;
  let tempoTom: 'neutro' | 'aviso' | 'critico' = 'neutro';
  let progresso: { pct: number; estourou: boolean } | null = null;

  if (coluna === 'fila') {
    const ms = decorridoMs(ordem.created_at, agora);
    if (ms !== null) {
      tempoTexto = `${ordem.status === 'rascunho' ? 'na fila há ' : 'há '}${duracaoCurta(ms)}`;
      if (ms >= DIA_MS) tempoTom = 'aviso';
    }
  } else if (coluna === 'em_execucao' && emExecucao) {
    const ms = decorridoMs(ordem.iniciadoEm, agora);
    const previsto = vinculado ? previsaoEmMinutos(vinculado.horaInicio, vinculado.horaFim) : null;
    if (ms !== null) {
      tempoTexto = `há ${duracaoCurta(ms)}${previsto ? ` · prev. ${duracaoCurta(previsto * 60000)}` : ''}`;
      if (previsto) {
        const atual = ms / 60000;
        progresso = { pct: Math.min(100, (atual / previsto) * 100), estourou: atual > previsto };
      }
    }
  } else if (coluna === 'bloqueado') {
    const ms = decorridoMs(ordem.updated_at, agora);
    if (ms !== null) { tempoTexto = `parada há ${duracaoCurta(ms)}`; tempoTom = 'critico'; }
  } else if (coluna === 'concluido') {
    const ms = decorridoMs(momentoConclusao(ordem), agora);
    if (ms !== null) tempoTexto = `concluída há ${duracaoCurta(ms)}`;
  }

  const detalhe = [servico, tempoTexto].filter(Boolean).join(' · ');

  const chips: { chave: string; texto: string; tom: string; icone?: ReactNode }[] = [];
  if (ordem.prioridade) chips.push({ chave: 'p', texto: PRIORIDADE[ordem.prioridade], tom: ordem.prioridade === 'vip' ? 'aviso' : 'ok' });
  if (possivelRetorno) chips.push({ chave: 'r', texto: 'Possível retorno', tom: 'critico' });
  if (qtdPecas) chips.push({ chave: 'i', texto: `${qtdPecas} ${qtdPecas === 1 ? 'item' : 'itens'}`, tom: 'neutro', icone: IcPacote });

  return (
    <article className={`atm-cartao atm-cartao--${coluna}`}>
      <div className="atm-cartao__topo">
        <PlacaMercosul placa={ordem.placa} />
        <span className="atm-cartao__os">#{ordem.os_num}</span>
        <span className={`at-pill at-pill--${st.tom}`}>{st.rotulo}</span>
      </div>

      <h3 className="atm-cartao__titulo">{[ordem.modelo, ordem.cliente].filter(Boolean).join(' · ')}</h3>

      {coluna === 'bloqueado' && ordem.motivoBloqueio && (
        <div className="at-motivo" role="note">
          <span className="at-motivo__icone">{IcAlerta}</span>
          <span><strong>Motivo:</strong> {ordem.motivoBloqueio}</span>
        </div>
      )}

      {chips.length > 0 && (
        <div className="atm-cartao__chips">
          {chips.map(c => (
            <span key={c.chave} className={`at-chip at-chip--${c.tom}`}>
              {c.icone}
              {c.texto}
            </span>
          ))}
        </div>
      )}

      <div className="atm-cartao__metas">
        {detalhe && <Meta icone={IcRelogio} tom={tempoTom}>{detalhe}</Meta>}
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

      <div className="atm-acoes">
        <button type="button" className={`atm-btn${coluna === 'concluido' ? ' atm-btn--bloco' : ''}`} onClick={() => onVerOS(ordem)}>
          Ver OS
        </button>
        {coluna === 'fila' && (
          <button type="button" className="atm-btn" onClick={() => onContinuarChecklist(ordem)}>Iniciar</button>
        )}
        {coluna === 'em_execucao' && (
          <button type="button" className="atm-btn" onClick={() => onContinuarChecklist(ordem)}>Concluir</button>
        )}
        {coluna === 'bloqueado' && (
          <button type="button" className="atm-btn" onClick={() => onPecaChegou(ordem.id)}>Peça chegou</button>
        )}
      </div>
    </article>
  );
}