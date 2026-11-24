import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalNotice } from '../../../components/system/Modal';
import { Button } from '../../../components/system/Button';
import { useConfirm } from '../../../components/system/ConfirmDialog';
import { Valor } from '../../../components/Privacidade';
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
 * Caixa de reserva, versão compacta do desktop: saldo, resumo e dois atalhos.
 * O histórico fica atrás de "Ver movimentos". O dinheiro continua dentro do Saldo do caixa.
 */
export function ReservaDesktop({ reserva, erro, podeRetirar, onRetirar, onDesfazer }: Props) {
  const confirmar = useConfirm();
  const [retirando, setRetirando] = useState(false);
  const [movimentos, setMovimentos] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  const [desfazendo, setDesfazendo] = useState<string | null>(null);
  const negativo = reserva.saldo < 0;

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
    <section className="fin-card" aria-labelledby="fin-reserva-titulo">
      <div className="fin-card__cab">
        <div className="fin-card__titulos">
          <h3 id="fin-reserva-titulo" className="fin-card__titulo">Caixa de reserva</h3>
          <p className="fin-card__sub">
            {reserva.ativa ? `Guardando ${reserva.percentual}% dos pagamentos de ${LABEL_ESCOPO[reserva.escopo]}` : 'Reserva desligada — o histórico continua aqui'}
          </p>
        </div>
      </div>
      <div className="fin-card__corpo">
        {erro && <ModalNotice tone="error" role="alert">{erro} Os valores abaixo podem estar desatualizados.</ModalNotice>}
        <div className={`fin-reserva__saldo${negativo ? ' fin-reserva__saldo--negativo' : ''}`}><Valor texto={formatBRL(reserva.saldo)} /></div>
        <p className="fin-reserva__texto">Já está dentro do Saldo do caixa; aqui você vê quanto dele está separado.</p>
        {negativo && (
          <p className="fin-reserva__texto fin-reserva__texto--alerta">
            O saldo ficou negativo porque um pagamento que já tinha reserva foi cancelado depois de parte dela ser retirada.
          </p>
        )}
        <dl className="fin-resumo">
          <div className="fin-resumo__linha fin-resumo__linha--ok"><dt>Total guardado</dt><dd><Valor texto={formatBRL(reserva.totalGuardado)} /></dd></div>
          <div className="fin-resumo__linha"><dt>Total retirado</dt><dd><Valor texto={formatBRL(reserva.totalRetirado)} /></dd></div>
        </dl>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {podeRetirar && (
            <button type="button" className="fin-btn fin-btn--secundario fin-btn--sm" disabled={reserva.saldo <= 0} onClick={() => setRetirando(true)}>
              Retirar da reserva
            </button>
          )}
          <button type="button" className="fin-link" onClick={() => setMovimentos(true)}>
            Ver movimentos{reserva.movimentos.length > 0 ? ` (${reserva.movimentos.length}${reserva.truncado ? '+' : ''})` : ''}
          </button>
        </div>
      </div>

      {movimentos && (
        <Modal size="md" onClose={() => setMovimentos(false)}>
          <ModalHeader title="Movimentos da reserva" description="Depósitos automáticos e retiradas, do mais recente para o mais antigo." />
          <ModalBody>
            {reserva.movimentos.length === 0 ? (
              <p className="fin-reserva__texto">Nenhum valor guardado ainda. A reserva começa a encher quando um pagamento é marcado como pago.</p>
            ) : (
              <ul className="fin-movimentos">
                {reserva.movimentos.map(m => (
                  <li key={m.id} className="fin-movimento">
                    <div className="fin-movimento__texto">
                      <span className="fin-movimento__titulo">{textoDoMovimento(m)}</span>
                      <span className="fin-movimento__data">{dataCurta(m.criadoEm)}{m.tipo === 'retirada' && m.criadoPorNome ? ` · ${m.criadoPorNome}` : ''}</span>
                    </div>
                    <span className={`fin-movimento__valor${m.tipo === 'deposito' ? ' fin-movimento__valor--deposito' : ''}`}>
                      {m.tipo === 'deposito' ? '+ ' : '- '}<Valor texto={formatBRL(m.valor)} />
                    </span>
                    {podeRetirar && m.tipo === 'retirada' && (
                      <Button size="sm" variant="ghost" loading={desfazendo === m.id} onClick={() => desfazer(m)}>Desfazer</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ModalBody>
          <ModalFooter
            hint={reserva.truncado ? 'Mostrando os mais recentes; os totais somam todos.' : undefined}
            notice={erroAcao ? <ModalNotice tone="error" role="alert">{erroAcao}</ModalNotice> : undefined}
          >
            <Button variant="secondary" onClick={() => setMovimentos(false)}>Fechar</Button>
          </ModalFooter>
        </Modal>
      )}

      {retirando && <RetiradaReservaModal saldo={reserva.saldo} onFechar={() => setRetirando(false)} onRetirar={onRetirar} />}
    </section>
  );
}
