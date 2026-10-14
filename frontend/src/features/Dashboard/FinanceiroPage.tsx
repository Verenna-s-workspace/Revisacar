import { useState, useMemo } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';
import { usePermissions } from '../../hooks/usePermissions';
import { useFinanceiro } from '../../hooks/useFinanceiro';
import { mensagemDoErro } from '../../utils/api_erro';
import { formatBRL } from '../../utils/dashboard';
import { KpiCards } from './Financeiro/KpiCards';
import { FluxoCaixaChart } from './Financeiro/FluxoCaixaChart';
import type { FluxoDia } from './Financeiro/FluxoCaixaChart';
import { CategoriaDonut } from './Financeiro/CategoriaDonut';
import { ContasWidget } from './Financeiro/ContasWidget';
import { TransacaoModal } from './Financeiro/TransacaoModal';
import { labelCategoria, LABEL_STATUS } from './Financeiro/categoriaLabels';
import type { Transacao } from './Financeiro/types';
import { isoLocal } from '../../utils/financeiro_utils';

type Preset = 'este-mes' | 'mes-passado' | '3-meses';

// Datas no calendário LOCAL (toISOString converteria pra UTC e, à noite no
// Brasil, empurraria o limite do período pro dia seguinte).
function periodoDoPreset(preset: Preset): { de: string; ate: string } {
  const hoje = new Date();
  const a = hoje.getFullYear();
  const m = hoje.getMonth();
  if (preset === 'mes-passado') {
    return { de: isoLocal(new Date(a, m - 1, 1)), ate: isoLocal(new Date(a, m, 0)) };
  }
  if (preset === '3-meses') {
    return { de: isoLocal(new Date(a, m - 2, 1)), ate: isoLocal(new Date(a, m + 1, 0)) };
  }
  return { de: isoLocal(new Date(a, m, 1)), ate: isoLocal(new Date(a, m + 1, 0)) };
}

function formatDataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

export function FinanceiroPage({ isMobile }: { isMobile: boolean }) {
  const { can } = usePermissions();
  const podeVer = can('financeiro.ver');
  const podeEditar = can('financeiro.editar');
  const podeVerMargem = can('financeiro.ver_margem');

  const [preset, setPreset] = useState<Preset>('este-mes');
  // Modal: undefined = fechado, null = novo lançamento, Transacao = edição.
  const [modal, setModal] = useState<Transacao | null | undefined>(undefined);
  const [erroAcao, setErroAcao] = useState('');

  const { de, ate } = periodoDoPreset(preset);
  const {
    resumo, transacoes, pendentesReceber, pendentesPagar, categorias,
    carregando, erro, usandoDadosDemo, criar, atualizar, cancelar,
  } = useFinanceiro({ de, ate, podeVer, podeVerMargem });

  const fluxoDiario = useMemo<FluxoDia[]>(() => {
    const porDia = new Map<string, { entradas: number; saidas: number }>();
    for (const t of transacoes) {
      const atual = porDia.get(t.data_competencia) ?? { entradas: 0, saidas: 0 };
      if (t.tipo === 'entrada') atual.entradas += t.valor; else atual.saidas += t.valor;
      porDia.set(t.data_competencia, atual);
    }
    return Array.from(porDia.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, v]) => ({ dia: formatDataCurta(dia), ...v }));
  }, [transacoes]);

  const despesasPorCategoria = useMemo(() => {
    const porCat = new Map<string, number>();
    for (const t of transacoes) {
      if (t.tipo !== 'saida') continue;
      porCat.set(t.categoria, (porCat.get(t.categoria) ?? 0) + t.valor);
    }
    return Array.from(porCat.entries()).map(([categoria, valor]) => ({ categoria, valor }));
  }, [transacoes]);

  const handleSalvarTransacao = async (payload: Record<string, unknown>) => {
    if (modal) await atualizar(modal.id, payload);
    else await criar(payload);
    setModal(undefined);
  };

  const handleMarcarPago = async (id: string) => {
    setErroAcao('');
    try {
      await atualizar(id, { status: 'pago' });
    } catch (e) {
      setErroAcao(mensagemDoErro(e, 'Não foi possível atualizar. Tente de novo.'));
    }
  };

  const handleCancelar = async (id: string) => {
    if (!window.confirm('Cancelar este lançamento? Ele sai dos totais, mas fica no histórico.')) return;
    setErroAcao('');
    try {
      await cancelar(id);
    } catch (e) {
      setErroAcao(mensagemDoErro(e, 'Não foi possível cancelar. Tente de novo.'));
    }
  };

  if (!podeVer) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: tokens.color.muted }}>
        Você não tem permissão pra ver o financeiro da oficina.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Financeiro</h2>
            {usandoDadosDemo && (
              <span
                style={{
                  fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: tokens.color.warn, background: tokens.color.warnBg, border: `1px solid ${tokens.color.warnBorder}`,
                  borderRadius: 6, padding: '2px 7px',
                }}
              >
                dados de demonstração
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Entradas, saídas e fluxo de caixa da oficina.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto' }}>
          <select
            value={preset}
            onChange={e => setPreset(e.target.value as Preset)}
            style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: tokens.color.surface, color: tokens.color.text, fontSize: '0.82rem', fontWeight: 600 }}
          >
            <option value="este-mes">Este mês</option>
            <option value="mes-passado">Mês passado</option>
            <option value="3-meses">Últimos 3 meses</option>
          </select>
          {podeEditar && (
            <button
              onClick={() => setModal(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap' }}
            >
              {Icons.plus} Novo Lançamento
            </button>
          )}
        </div>
      </div>

      {(erro || erroAcao) && (
        <div style={{ padding: '10px 16px', background: 'var(--color-crit-bg)', color: 'var(--color-crit)', border: '1px solid var(--color-crit-border)', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600 }}>
          {erro || erroAcao}
        </div>
      )}

      {!resumo ? (
        !erro && <div style={{ padding: 60, textAlign: 'center', color: tokens.color.muted }}>Carregando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: carregando ? 0.6 : 1, transition: 'opacity .15s' }}>
          <KpiCards resumo={resumo} verMargem={podeVerMargem} isMobile={isMobile} />

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 16 }}>
            <Card style={{ padding: 20 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text, marginBottom: 8 }}>Fluxo de Caixa</div>
              {fluxoDiario.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: tokens.color.muted, fontSize: '0.82rem' }}>Sem lançamentos nesse período.</div>
              ) : (
                <FluxoCaixaChart data={fluxoDiario} height={isMobile ? 200 : 240} />
              )}
            </Card>

            <Card style={{ padding: 20 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text, marginBottom: 8 }}>Despesas por Categoria</div>
              <CategoriaDonut dados={despesasPorCategoria} />
            </Card>
          </div>

          <ContasWidget
            aReceber={pendentesReceber}
            aPagar={pendentesPagar}
            onMarcarPago={handleMarcarPago}
            podeEditar={podeEditar}
          />

          {/* Transações do período */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>Lançamentos do Período</span>
              <span style={{ fontSize: '0.78rem', color: tokens.color.muted }}>{transacoes.length} transaç{transacoes.length === 1 ? 'ão' : 'ões'}</span>
            </div>
            {transacoes.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: tokens.color.muted, fontSize: '0.85rem' }}>Nenhum lançamento nesse período ainda.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${tokens.color.border}`, background: tokens.color.surfaceHigh }}>
                      <th style={thStyle}>Descrição</th>
                      <th style={thStyle}>Categoria</th>
                      <th style={thStyle}>Data</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Valor</th>
                      {podeEditar && <th style={thStyle} />}
                    </tr>
                  </thead>
                  <tbody>
                    {transacoes.map(t => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                        <td style={tdStyle}>{t.descricao || labelCategoria(t.tipo, t.categoria)}{t.cliente_nome ? ` — ${t.cliente_nome}` : ''}</td>
                        <td style={{ ...tdStyle, color: tokens.color.muted }}>{labelCategoria(t.tipo, t.categoria)}</td>
                        <td style={{ ...tdStyle, color: tokens.color.muted }}>{formatDataCurta(t.data_competencia)}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                            background: t.vencido ? 'var(--color-crit-bg)' : t.status === 'pago' ? 'var(--color-ok-bg)' : tokens.color.surfaceHigh,
                            color: t.vencido ? 'var(--color-crit)' : t.status === 'pago' ? 'var(--color-ok)' : tokens.color.muted,
                          }}>
                            {t.vencido ? 'Vencido' : LABEL_STATUS[t.status]}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: t.tipo === 'entrada' ? tokens.color.ok : tokens.color.text }}>
                          {t.tipo === 'entrada' ? '+ ' : '- '}{formatBRL(t.valor)}
                        </td>
                        {podeEditar && (
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {t.status === 'pendente' && (
                              <button onClick={() => handleMarcarPago(t.id)} style={acaoBtnStyle} title="Marcar como pago">✓</button>
                            )}
                            <button onClick={() => setModal(t)} style={acaoBtnStyle} title="Editar">{Icons.edit}</button>
                            <button onClick={() => handleCancelar(t.id)} style={{ ...acaoBtnStyle, color: tokens.color.crit }} title="Cancelar">{Icons.trash}</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {modal !== undefined && (
        <TransacaoModal
          categorias={categorias}
          transacao={modal ?? undefined}
          onFechar={() => setModal(undefined)}
          onSalvar={handleSalvarTransacao}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '12px 20px', fontSize: '0.84rem', color: tokens.color.text };
const acaoBtnStyle: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', color: tokens.color.muted, fontSize: '0.9rem' };