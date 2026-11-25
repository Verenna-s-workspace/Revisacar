import { tokens } from '../../../constants';
import { Card } from '../Primitives';
import { formatBRL } from '../../../utils/dashboard';
import { usePrivacidade } from '../../../context/PrivacidadeContext';
import { Valor, MASCARA_PERCENTUAL } from '../../../components/Privacidade';

export interface ResumoFinanceiro {
  faturamento: number;
  /** Soma das taxas de maquininha das entradas do período (já descontada do lucro). */
  taxas?: number;
  despesas: number;
  recebido: number;
  saldo: number;
  a_receber: number;
  a_pagar: number;
  vencido_receber: number;
  vencido_pagar: number;
  lucro?: number;
  margem_percentual?: number;
}

function KpiCard({ label, valor, corBorda, extra, destaqueId }: { label: string; valor: string; corBorda: string; extra?: React.ReactNode; destaqueId?: string }) {
  return (
    <Card style={{ padding: 18, borderLeft: `4px solid ${corBorda}` }} destaqueId={destaqueId}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
        {extra}
      </div>
      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: tokens.color.text, margin: '6px 0 0' }}><Valor texto={valor} /></h3>
    </Card>
  );
}

export function KpiCards({ resumo, verMargem, isMobile }: { resumo: ResumoFinanceiro; verMargem: boolean; isMobile: boolean }) {
  const { oculto } = usePrivacidade();
  const cols = isMobile ? '1fr 1fr' : verMargem ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14 }}>
      <KpiCard
        label="Faturamento"
        valor={formatBRL(resumo.faturamento)}
        corBorda="#CC1400"
        destaqueId="fin-kpi-faturamento"
        extra={resumo.taxas && resumo.taxas > 0 ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.muted }}><Valor texto={formatBRL(resumo.taxas)} /> em taxas de maquininha</span>
        ) : undefined}
      />
      <KpiCard label="Despesas" valor={formatBRL(resumo.despesas)} corBorda="#B35C00" destaqueId="fin-kpi-despesas" />
      <KpiCard label="Saldo" valor={formatBRL(resumo.saldo)} corBorda={tokens.color.ok} />
      {verMargem && resumo.lucro !== undefined && (
        <KpiCard
          label="Lucro"
          valor={formatBRL(resumo.lucro)}
          // Verde/vermelho denunciam lucro ou prejuízo: com a máscara ligada ficam neutros.
          corBorda={oculto ? tokens.color.muted : resumo.lucro >= 0 ? tokens.color.ok : tokens.color.crit}
          destaqueId="fin-kpi-lucro"
          extra={
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: oculto ? tokens.color.muted : resumo.lucro >= 0 ? tokens.color.ok : tokens.color.crit }}>
              <Valor texto={`${resumo.margem_percentual}%`} mascara={MASCARA_PERCENTUAL} /> margem
            </span>
          }
        />
      )}
      <KpiCard
        label="A Receber"
        valor={formatBRL(resumo.a_receber)}
        corBorda={tokens.color.warn}
        extra={resumo.vencido_receber > 0 ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.crit }}><Valor texto={formatBRL(resumo.vencido_receber)} /> vencido</span>
        ) : undefined}
      />
      <KpiCard
        label="A Pagar"
        valor={formatBRL(resumo.a_pagar)}
        corBorda={tokens.color.muted}
        extra={resumo.vencido_pagar > 0 ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.crit }}><Valor texto={formatBRL(resumo.vencido_pagar)} /> vencido</span>
        ) : undefined}
      />
    </div>
  );
}
