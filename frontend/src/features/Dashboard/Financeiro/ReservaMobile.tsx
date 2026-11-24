import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Valor } from '../../../components/Privacidade';
import { useConfirm } from '../../../components/system/ConfirmDialog';
import { formatBRL } from '../../../utils/dashboard';
import { mensagemDoErro } from '../../../utils/api_erro';
import { LABEL_CATEGORIA_RESERVA, LABEL_ESCOPO } from '../../../utils/reserva_utils';
import { IcSetaDir } from '../Clientes/icones';
import { RetiradaReservaModal } from './RetiradaReservaModal';
import type { MovimentoReserva, ReservaResumo } from './types';

const MOSTRAR_INICIAL = 8;

interface Props {
  reserva: ReservaResumo;
  /** Erro da última atualização: os números na tela podem estar desatualizados. */
  erro: string | null;
  podeRetirar: boolean;
  onRetirar: (valor: number, descricao: string) => Promise<void>;
  onDesfazer: (id: string) => Promise<void>;
}

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
 * Caixa de reserva no celular: uma linha com o saldo (sempre visível sob os indicadores) que abre uma folha
 * com o resumo, "Retirar da reserva" e o histórico de movimentos. O dinheiro continua dentro do Saldo do caixa.
 */
export function ReservaMobile({ reserva, erro, podeRetirar, onRetirar, onDesfazer }: Props) {
  const confirmar = useConfirm();
  const [aberta, setAberta] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  const negativo = reserva.saldo < 0;
  const movimentos = verTodos ? reserva.movimentos : reserva.movimentos.slice(0, MOSTRAR_INICIAL);
  const regra = reserva.ativa
    ? `Guardando ${reserva.percentual}% dos pagamentos de ${LABEL_ESCOPO[reserva.escopo]}`
    : 'Reserva desligada — o histórico continua aqui';

  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberta(false); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta]);

  const desfazer = async (m: MovimentoReserva) => {
    const ok = await confirmar({
      title: 'Desfazer a retirada?',
      description: `A retirada de ${formatBRL(m.valor)} é desfeita e o valor volta para o saldo da reserva.`,
      confirmLabel: 'Desfazer retirada',
    });
    if (!ok) return;
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
    <>
      <button type="button" className="finm-reserva" aria-haspopup="dialog" onClick={() => setAberta(true)}>
        <span className="finm-reserva__texto">
          <span className="finm-reserva__titulo">Caixa de reserva</span>
          <span className={`finm-reserva__sub${erro ? ' finm-reserva__sub--alerta' : ''}`}>
            {erro ? 'Valores podem estar desatualizados' : regra}
          </span>
        </span>
        <span className={`finm-reserva__saldo${negativo ? ' finm-reserva__saldo--negativo' : ''}`}><Valor texto={formatBRL(reserva.saldo)} /></span>
        <span className="finm-reserva__seta" aria-hidden="true">{IcSetaDir}</span>
      </button>

      {aberta && createPortal(
        <div className="finm-sheet-backdrop" onClick={() => setAberta(false)}>
          <div className="finm-sheet" role="dialog" aria-modal="true" aria-label="Caixa de reserva" onClick={e => e.stopPropagation()}>
            <div className="finm-sheet__grab" aria-hidden="true" />
            <h2 className="finm-sheet__titulo">Caixa de reserva</h2>
            <p className="finm-sheet__texto">{regra}. Já está dentro do Saldo do caixa; aqui você vê quanto dele está separado.</p>

            {(erro || erroAcao) && (
              <div className="finm-aviso os-status--recusada finm-aviso--sheet" role="alert">
                <span>{erroAcao || `${erro} Os valores abaixo podem estar desatualizados.`}</span>
              </div>
            )}

            <div className={`finm-sheet__valor${negativo ? ' finm-sheet__valor--negativo' : ''}`}><Valor texto={formatBRL(reserva.saldo)} /></div>
            {negativo && (
              <p className="finm-sheet__texto finm-sheet__texto--alerta">
                O saldo ficou negativo porque um pagamento que já tinha reserva foi cancelado depois de parte dela ser retirada.
              </p>
            )}

            <dl className="finm-sheet__lista">
              <div className="finm-sheet__linha"><dt>Total guardado</dt><dd className="finm-sheet__ok"><Valor texto={formatBRL(reserva.totalGuardado)} /></dd></div>
              <div className="finm-sheet__linha"><dt>Total retirado</dt><dd><Valor texto={formatBRL(reserva.totalRetirado)} /></dd></div>
            </dl>

            {podeRetirar && (
              <button
                type="button"
                className="finm-sheet__opt"
                disabled={reserva.saldo <= 0}
                // Fecha a folha antes: o modal de retirada abre por cima de tudo.
                onClick={() => { setAberta(false); setRetirando(true); }}
              >
                Retirar da reserva
              </button>
            )}

            <h3 className="finm-sheet__secao">Movimentos</h3>
            {reserva.movimentos.length === 0 ? (
              <p className="finm-sheet__texto">Nenhum valor guardado ainda. A reserva começa a encher quando um pagamento é marcado como pago.</p>
            ) : (
              <>
                <ul className="finm-movimentos">
                  {movimentos.map(m => (
                    <li key={m.id} className="finm-movimento">
                      <div className="finm-movimento__texto">
                        <span className="finm-movimento__titulo">{textoDoMovimento(m)}</span>
                        <span className="finm-movimento__data">{dataCurta(m.criadoEm)}{m.tipo === 'retirada' && m.criadoPorNome ? ` · ${m.criadoPorNome}` : ''}</span>
                      </div>
                      <span className={`finm-movimento__valor${m.tipo === 'deposito' ? ' finm-movimento__valor--deposito' : ''}`}>
                        {m.tipo === 'deposito' ? '+ ' : '- '}<Valor texto={formatBRL(m.valor)} />
                      </span>
                      {podeRetirar && m.tipo === 'retirada' && (
                        <button type="button" className="finm-movimento__desfazer" disabled={desfazendo === m.id} onClick={() => desfazer(m)}>
                          Desfazer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {reserva.movimentos.length > MOSTRAR_INICIAL && (
                  <button type="button" className="finm-sheet__opt" onClick={() => setVerTodos(v => !v)}>
                    {verTodos ? 'Mostrar menos' : `Ver todos (${reserva.movimentos.length}${reserva.truncado ? '+' : ''})`}
                  </button>
                )}
                {reserva.truncado && <p className="finm-sheet__texto">Mostrando os mais recentes; os totais somam todos.</p>}
              </>
            )}

            <button type="button" className="finm-sheet__cancel" onClick={() => setAberta(false)}>Fechar</button>
          </div>
        </div>,
        document.body,
      )}

      {retirando && <RetiradaReservaModal saldo={reserva.saldo} onFechar={() => setRetirando(false)} onRetirar={onRetirar} />}
    </>
  );
}
