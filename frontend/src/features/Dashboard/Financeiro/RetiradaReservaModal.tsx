import { useState } from 'react';
import { tokens } from '../../../constants';
import { Input } from '../../../components/inputs/input';
import { mensagemDoErro } from '../../../utils/api_erro';
import { formatBRL } from '../../../utils/dashboard';

interface Props {
  saldo: number;
  onFechar: () => void;
  onRetirar: (valor: number, descricao: string) => Promise<void>;
}

/** Registra uma retirada da reserva. O servidor confere o saldo de novo: dois cliques ao mesmo tempo não estouram. */
export function RetiradaReservaModal({ saldo, onFechar, onRetirar }: Props) {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const valorNum = Number(valor);
  const valorOk = valorNum > 0 && valorNum <= saldo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(valorNum > 0)) { setErro('Informe um valor válido.'); return; }
    if (valorNum > saldo) { setErro(`O valor passa do saldo da reserva (${formatBRL(saldo)}).`); return; }
    setSalvando(true);
    setErro('');
    try {
      await onRetirar(valorNum, descricao.trim());
      onFechar();
    } catch (err) {
      setErro(mensagemDoErro(err, 'Não foi possível registrar a retirada. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="sheet-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
    }}>
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-label="Retirar da reserva" style={{
        background: tokens.color.card, borderRadius: 16, width: '100%', maxWidth: 420,
        border: `1px solid ${tokens.color.border}`, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Retirar da reserva</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: tokens.color.muted, width: 44, height: 44, margin: '-10px -10px -10px 0' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.84rem', color: tokens.color.textSecond }}>
            Saldo da reserva: <strong style={{ color: tokens.color.text }}>{formatBRL(saldo)}</strong>
          </div>

          <Input name="reserva_retirada_valor" type="currency" label="Valor" required autoFocus placeholder="R$ 0,00" value={valor} onChangeValue={setValor} />
          <Input name="reserva_retirada_motivo" label="Motivo (opcional)" placeholder="Ex: Conserto do compressor" maxLength={200} value={descricao} onChangeValue={setDescricao} />

          <div style={{ fontSize: '0.78rem', color: tokens.color.muted, lineHeight: 1.45 }}>
            A retirada só abate o saldo da reserva. Se o dinheiro pagou uma despesa, lance a saída em Novo Lançamento.
          </div>

          {erro && (
            <div role="alert" style={{ padding: '10px 14px', background: 'var(--color-crit-bg)', color: 'var(--color-crit)', border: '1px solid var(--color-crit-border)', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600 }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onFechar} style={{ padding: '10px 16px', minHeight: 44, background: 'transparent', color: tokens.color.text, border: `1px solid ${tokens.color.border}`, borderRadius: 10, fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando || !valorOk} style={{ padding: '10px 18px', minHeight: 44, background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.84rem', fontWeight: 700, cursor: salvando || !valorOk ? 'not-allowed' : 'pointer', opacity: salvando || !valorOk ? 0.5 : 1 }}>
              {salvando ? 'Registrando…' : 'Retirar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
