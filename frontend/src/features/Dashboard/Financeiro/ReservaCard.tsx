import { useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Card } from '../Primitives';
import { formatBRL } from '../../../utils/dashboard';
import { mensagemDoErro } from '../../../utils/api_erro';
import { LABEL_CATEGORIA_RESERVA, LABEL_ESCOPO } from '../../../utils/reserva_utils';
import { RetiradaReservaModal } from './RetiradaReservaModal';
import type { MovimentoReserva, ReservaResumo } from './types';

interface Props {
  reserva: ReservaResumo;
  /** Erro da última atualização: os números na tela podem estar desatualizados. */
  erro: string | null;
  podeRetirar: boolean;
  isMobile: boolean;
  onRetirar: (valor: number, descricao: string) => Promise<void>;
  onDesfazer: (id: string) => Promise<void>;
}

const MOSTRAR_INICIAL = 6;

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function textoDoMovimento(m: MovimentoReserva): string {
  if (m.tipo === 'retirada') return m.descricao || 'Retirada da reserva';
  const origem = LABEL_CATEGORIA_RESERVA[m.categoria ?? ''] ?? 'Pagamento';
  const regra = m.percentual !== undefined && m.baseValor !== undefined
    ? `${m.percentual}% de ${formatBRL(m.baseValor)}`
    : m.percentual !== undefined ? `${m.percentual}%` : '';
  return [origem, regra, m.ordemServicoId].filter(Boolean).join(' · ');
}

/**
 * Saldo da reserva de caixa no Financeiro. Só aparece se a oficina usa a reserva (ligada, ou com
 * histórico). O dinheiro continua dentro do Saldo do caixa — a reserva só diz quanto dele está separado.
 */
export function ReservaCard({ reserva, erro, podeRetirar, isMobile, onRetirar, onDesfazer }: Props) {
  const [modal, setModal] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  const movimentos = verTodos ? reserva.movimentos : reserva.movimentos.slice(0, MOSTRAR_INICIAL);
  const negativo = reserva.saldo < 0;

  const desfazer = async (m: MovimentoReserva) => {
    if (!window.confirm(`Desfazer a retirada de ${formatBRL(m.valor)}? O valor volta para o saldo da reserva.`)) return;
    setErroAcao('');
    setDesfazendo(m.id);
    try {
      await onDesfazer(m.id);
    } catch (e) {
      setErroAcao(mensagemDoErro(e, 'Não foi possível desfazer a retirada. Tente de novo.'));
    } finally {
      setDesfazendo(null);
    }
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', gap: 12,
        justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>
            <span style={{ color: 'var(--color-ferrari)', display: 'flex' }}>{Icons.dollar}</span> Caixa de reserva
          </div>
          <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 2 }}>
            {reserva.ativa
              ? `Guardando ${reserva.percentual}% dos pagamentos de ${LABEL_ESCOPO[reserva.escopo]} — já está dentro do Saldo do caixa`
              : 'Reserva desligada — o histórico continua aqui'}
          </div>
        </div>
        {podeRetirar && (
          <button
            type="button"
            onClick={() => setModal(true)}
            disabled={reserva.saldo <= 0}
            style={{
              padding: '9px 16px', minHeight: 44, background: 'transparent', color: tokens.color.text,
              border: `1px solid ${tokens.color.border}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 700,
              cursor: reserva.saldo <= 0 ? 'not-allowed' : 'pointer', opacity: reserva.saldo <= 0 ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            Retirar da reserva
          </button>
        )}
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(erro || erroAcao) && (
          <div role="alert" style={{ padding: '10px 14px', background: 'var(--color-crit-bg)', color: 'var(--color-crit)', border: '1px solid var(--color-crit-border)', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600 }}>
            {erroAcao || `${erro} Os valores abaixo podem estar desatualizados.`}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 10, background: tokens.color.surfaceHigh }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Saldo da reserva</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: negativo ? tokens.color.crit : tokens.color.text }}>{formatBRL(reserva.saldo)}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 10, background: tokens.color.surfaceHigh }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total guardado</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4, color: tokens.color.ok }}>{formatBRL(reserva.totalGuardado)}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 10, background: tokens.color.surfaceHigh }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total retirado</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4, color: tokens.color.text }}>{formatBRL(reserva.totalRetirado)}</div>
          </div>
        </div>

        {negativo && (
          <div style={{ fontSize: '0.78rem', color: tokens.color.crit, lineHeight: 1.45 }}>
            O saldo ficou negativo porque um pagamento que já tinha reserva foi cancelado depois de parte dela ser retirada.
          </div>
        )}

        {reserva.movimentos.length === 0 ? (
          <div style={{ fontSize: '0.84rem', color: tokens.color.muted }}>
            Nenhum valor guardado ainda. A reserva começa a encher quando um pagamento é marcado como pago.
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.muted, marginBottom: 6 }}>MOVIMENTOS</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {movimentos.map(m => (
                <li key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 0',
                  borderTop: `1px solid ${tokens.color.border}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: tokens.color.text, overflowWrap: 'anywhere' }}>{textoDoMovimento(m)}</div>
                    <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>
                      {dataCurta(m.criadoEm)}{m.tipo === 'retirada' && m.criadoPorNome ? ` · ${m.criadoPorNome}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: m.tipo === 'deposito' ? tokens.color.ok : tokens.color.text }}>
                    {m.tipo === 'deposito' ? '+ ' : '- '}{formatBRL(m.valor)}
                  </div>
                  {podeRetirar && m.tipo === 'retirada' && (
                    <button
                      type="button"
                      disabled={desfazendo === m.id}
                      onClick={() => desfazer(m)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: tokens.color.muted, fontSize: '0.78rem', fontWeight: 700, minHeight: 44, padding: '0 6px', textDecoration: 'underline' }}
                    >
                      Desfazer
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {reserva.movimentos.length > MOSTRAR_INICIAL && (
              <button
                type="button"
                onClick={() => setVerTodos(v => !v)}
                style={{ marginTop: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-ferrari)', fontSize: '0.8rem', fontWeight: 700, minHeight: 44, padding: 0 }}
              >
                {verTodos ? 'Mostrar menos' : `Ver todos (${reserva.movimentos.length}${reserva.truncado ? '+' : ''})`}
              </button>
            )}
          </div>
        )}
      </div>

      {modal && (
        <RetiradaReservaModal saldo={reserva.saldo} onFechar={() => setModal(false)} onRetirar={onRetirar} />
      )}
    </Card>
  );
}
