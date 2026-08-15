import { useState, useEffect, useCallback, useMemo } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';
import { api } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';
import { formatBRL } from '../../utils/dashboard';
import { KpiCards } from './Financeiro/KpiCards';
import type { ResumoFinanceiro } from './Financeiro/KpiCards';
import { FluxoCaixaChart } from './Financeiro/FluxoCaixaChart';
import type { FluxoDia } from './Financeiro/FluxoCaixaChart';
import { CategoriaDonut } from './Financeiro/CategoriaDonut';
import { ContasWidget } from './Financeiro/ContasWidget';
import { TransacaoModal } from './Financeiro/TransacaoModal';
import { labelCategoria, LABEL_STATUS } from './Financeiro/categoriaLabels';
import type { Transacao, Categorias } from './Financeiro/types';
import { buildSeedTransacoes, buildSeedCategorias, buildSeedResumo, filtrarSeedPorPeriodo } from '../../utils/financeiro_utils';

type Preset = 'este-mes' | 'mes-passado' | '3-meses';

function periodoDoPreset(preset: Preset): { de: string; ate: string } {
  const hoje = new Date();
  if (preset === 'mes-passado') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { de: inicio.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) };
  }
  if (preset === '3-meses') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { de: inicio.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) };
  }
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { de: inicio.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) };
}

function formatDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

const CATEGORIAS_VAZIAS: Categorias = { entrada: [], saida: [], formas_pagamento: [] };

export function FinanceiroPage({ isMobile }: { isMobile: boolean }) {
  const { can } = usePermissions();
  const podeVer = can('financeiro.ver');
  const podeEditar = can('financeiro.editar');
  const podeVerMargem = can('financeiro.ver_margem');

  const [preset, setPreset] = useState<Preset>('este-mes');
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [pendentesReceber, setPendentesReceber] = useState<Transacao[]>([]);
  const [pendentesPagar, setPendentesPagar] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categorias>(CATEGORIAS_VAZIAS);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [usandoDadosDemo, setUsandoDadosDemo] = useState(false);

  const { de, ate } = periodoDoPreset(preset);

  const carregarTudo = useCallback(() => {
    if (!podeVer) return;
    setLoading(true);
    setErro('');
    Promise.all([
      api.resumoFinanceiro({ de, ate }),
      api.listarTransacoes({ de, ate }),
      api.listarTransacoes({ status: 'pendente', tipo: 'entrada', semPeriodo: true }),
      api.listarTransacoes({ status: 'pendente', tipo: 'saida', semPeriodo: true }),
    ])
      .then(([r, t, pr, pp]) => {
        setResumo(r);
        setTransacoes(t);
        setPendentesReceber(pr);
        setPendentesPagar(pp);
        setUsandoDadosDemo(false);
      })
      .catch(() => {
        // Mesmo critério de hooks/useEstoque.ts e hooks/useRelatorios.ts: só
        // cai pra dados de demonstração em desenvolvimento. Faturamento e
        // margem fictícios são um risco pelo menos tão grande quanto estoque
        // fictício, então uma falha real em produção mostra o erro de
        // verdade — e uma resposta bem sucedida (mesmo vazia) nunca é
        // substituída por isto, em nenhum ambiente.
        if (import.meta.env.DEV) {
          const todas = buildSeedTransacoes();
          setResumo(buildSeedResumo(todas, de, ate, podeVerMargem));
          setTransacoes(filtrarSeedPorPeriodo(todas, de, ate));
          setPendentesReceber(todas.filter(x => x.status === 'pendente' && x.tipo === 'entrada'));
          setPendentesPagar(todas.filter(x => x.status === 'pendente' && x.tipo === 'saida'));
          setUsandoDadosDemo(true);
        } else {
          setErro('Não foi possível carregar os dados financeiros.');
        }
      })
      .finally(() => setLoading(false));
  }, [podeVer, de, ate, podeVerMargem]);

  useEffect(() => { carregarTudo(); }, [carregarTudo]);

  useEffect(() => {
    if (!podeVer) return;
    api.categoriasFinanceiro()
      .then(setCategorias)
      .catch(() => { if (import.meta.env.DEV) setCategorias(buildSeedCategorias()); });
  }, [podeVer]);

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
    await api.criarTransacao(payload);
    setShowModal(false);
    carregarTudo();
  };

  const handleMarcarPago = async (id: string) => {
    try {
      await api.atualizarTransacao(id, { status: 'pago' });
      carregarTudo();
    } catch {
      setErro('Não foi possível atualizar. Tente de novo.');
    }
  };

  const handleCancelar = async (id: string) => {
    if (!window.confirm('Cancelar este lançamento? Ele sai dos totais, mas fica no histórico.')) return;
    try {
      await api.removerTransacao(id);
      carregarTudo();
    } catch {
      setErro('Não foi possível cancelar. Tente de novo.');
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
              onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap' }}
            >
              {Icons.plus} Novo Lançamento
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div style={{ padding: '10px 16px', background: 'var(--color-crit-bg)', color: 'var(--color-crit)', border: '1px solid var(--color-crit-border)', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600 }}>
          {erro}
        </div>
      )}

      {loading || !resumo ? (
        <div style={{ padding: 60, textAlign: 'center', color: tokens.color.muted }}>Carregando…</div>
      ) : (
        <>
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
        </>
      )}

      {showModal && (
        <TransacaoModal categorias={categorias} onFechar={() => setShowModal(false)} onSalvar={handleSalvarTransacao} />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '12px 20px', fontSize: '0.84rem', color: tokens.color.text };
const acaoBtnStyle: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', color: tokens.color.muted, fontSize: '0.9rem' };