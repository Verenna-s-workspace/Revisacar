import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { formatBRL } from '../../../utils/dashboard';
import { resumoQuarentena } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';

interface QuarentenaAlertProps {
  itens: EstoqueItem[];
}

export function QuarentenaAlert({ itens }: QuarentenaAlertProps) {
  const resumo = resumoQuarentena(itens);
  if (!resumo) return null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: tokens.color.warnBg, border: `1px solid ${tokens.color.warnBorder}`, borderRadius: 12,
      }}
    >
      <span style={{ color: tokens.color.warn, display: 'flex', flexShrink: 0 }}>{Icons.alert}</span>
      <div style={{ fontSize: '0.82rem', color: tokens.color.text, lineHeight: 1.5 }}>
        <strong>{formatBRL(resumo.valorTotal)}</strong> em {resumo.totalPecas} {resumo.totalPecas === 1 ? 'peça' : 'peças'} aguardando
        devolução/garantia
        {resumo.diasMaisAntigo > 0 && (
          <>, a mais antiga há {resumo.diasMaisAntigo} {resumo.diasMaisAntigo === 1 ? 'dia' : 'dias'}</>
        )}
        .
      </div>
    </div>
  );
}
