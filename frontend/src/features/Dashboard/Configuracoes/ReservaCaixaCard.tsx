import { useState, useEffect } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Card } from '../Primitives';
import { Input } from '../../../components/inputs/input';
import { api } from '../../../utils/api';
import { ApiError, mensagemDoErro } from '../../../utils/api_erro';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatBRL } from '../../../utils/dashboard';
import {
  ESCOPOS_RESERVA, LABEL_ESCOPO, calcularReserva, lerPercentual,
} from '../../../utils/reserva_utils';
import type { EscopoReserva } from '../../../utils/reserva_utils';
import type { ReservaConfig } from '../Financeiro/types';

const BASE_EXEMPLO = 1000;

/**
 * Reserva de caixa: separa um percentual de cada entrada paga num caixa de emergência. Vem DESLIGADA —
 * quem não liga não vê nada diferente no sistema. Não é desconto: o cliente paga o mesmo valor.
 * Só o dono configura (financeiro.reserva); esconder o card é só UX, quem barra é o backend.
 */
export function ReservaCaixaCard({ isMobile }: { isMobile: boolean }) {
  const { can } = usePermissions();
  const podeConfigurar = can('financeiro.reserva');

  const [carregando, setCarregando] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [erro, setErro] = useState('');
  const [salvou, setSalvou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [ativa, setAtiva] = useState(false);
  const [percentual, setPercentual] = useState('');
  const [escopo, setEscopo] = useState<EscopoReserva>('servicos');
  const [original, setOriginal] = useState<{ ativa: boolean; percentual: string; escopo: EscopoReserva } | null>(null);

  useEffect(() => {
    if (!podeConfigurar) return;
    let vivo = true;
    api.obterReservaConfig()
      .then((c: ReservaConfig) => {
        if (!vivo) return;
        const pct = c.percentual > 0 ? String(Math.round(c.percentual)) : '';
        setAtiva(c.ativa);
        setPercentual(pct);
        setEscopo(c.escopo);
        setOriginal({ ativa: c.ativa, percentual: pct, escopo: c.escopo });
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        if (e instanceof ApiError && e.status === 503) setIndisponivel(true);
        else setErro(mensagemDoErro(e, 'Não foi possível carregar a reserva de caixa.'));
      })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [podeConfigurar]);

  if (!podeConfigurar) return null;

  const pct = lerPercentual(percentual);
  const erroPercentual = ativa && percentual !== '' && pct === null ? 'Informe um número de 1 a 100.' : undefined;
  const alterado = original !== null && (
    original.ativa !== ativa || original.escopo !== escopo || (ativa && original.percentual !== percentual)
  );
  const podeSalvar = !salvando && alterado && (!ativa || pct !== null);
  const exemplo = ESCOPOS_RESERVA.find(e => e.valor === escopo)?.exemplo ?? 'serviço';
  const guardado = pct !== null ? calcularReserva(BASE_EXEMPLO, pct) : null;

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    setSalvou(false);
    try {
      // Desligada, o percentual vai como estava (ou 0): o backend só exige > 0 quando está ligada.
      const r: ReservaConfig = await api.salvarReservaConfig({
        ativa,
        percentual: pct ?? Number(original?.percentual || 0),
        escopo,
      });
      const novo = r.percentual > 0 ? String(Math.round(r.percentual)) : '';
      setAtiva(r.ativa);
      setPercentual(novo);
      setEscopo(r.escopo);
      setOriginal({ ativa: r.ativa, percentual: novo, escopo: r.escopo });
      setSalvou(true);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível salvar a reserva de caixa. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-ferrari)', display: 'flex' }}>{Icons.dollar}</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>Reserva de caixa</div>
            <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>
              Guarde uma parte de cada pagamento recebido num caixa de emergência
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {carregando ? (
          <div style={{ color: tokens.color.muted, fontSize: '0.85rem' }}>Carregando…</div>
        ) : indisponivel ? (
          <div style={{ color: tokens.color.muted, fontSize: '0.85rem', lineHeight: 1.45 }}>
            A reserva de caixa ainda não está disponível no seu sistema. Peça a quem cuida do RevisaCar para ativá-la.
          </div>
        ) : (
          <>
            {erro && (
              <div role="alert" style={{
                padding: '10px 14px', background: 'var(--color-crit-bg)', color: 'var(--color-crit)',
                border: '1px solid var(--color-crit-border)', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
              }}>
                {erro}
              </div>
            )}
            {salvou && !erro && (
              <div role="status" style={{
                padding: '10px 14px', background: 'var(--color-ok-bg)', color: 'var(--color-ok)',
                borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {Icons.check} Salvo. Vale para os próximos pagamentos; o que já foi pago não muda.
              </div>
            )}

            {/* Liga/desliga */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: tokens.color.text }}>Usar reserva de caixa</div>
                <div style={{ fontSize: '0.78rem', color: tokens.color.muted, lineHeight: 1.4 }}>
                  Não é desconto: o cliente paga o mesmo valor. É só uma separação interna do que entrou.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ativa}
                aria-label="Usar reserva de caixa"
                onClick={() => { setAtiva(a => !a); setSalvou(false); }}
                style={{
                  flexShrink: 0, width: 52, height: 44, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{
                  position: 'relative', width: 44, height: 26, borderRadius: 999, transition: 'background .15s',
                  background: ativa ? 'var(--color-ferrari)' : tokens.color.border, display: 'block',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: ativa ? 21 : 3, width: 20, height: 20, borderRadius: '50%',
                    background: 'white', transition: 'left .15s', boxShadow: 'var(--shadow-sm)',
                  }} />
                </span>
              </button>
            </div>

            {ativa && (
              <>
                <div style={{ maxWidth: isMobile ? '100%' : 220 }}>
                  <Input
                    name="reserva_percentual"
                    type="digits"
                    label="Quanto guardar (%)"
                    placeholder="Ex: 20"
                    maxLength={3}
                    value={percentual}
                    error={erroPercentual}
                    onChangeValue={v => { setPercentual(v); setSalvou(false); }}
                  />
                </div>

                <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
                  <legend style={{ fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 8, padding: 0 }}>
                    Em quais pagamentos guardar
                  </legend>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                    {ESCOPOS_RESERVA.map(opcao => {
                      const marcado = escopo === opcao.valor;
                      return (
                        <label key={opcao.valor} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', minHeight: 44, cursor: 'pointer',
                          borderRadius: 10, border: `1px solid ${marcado ? 'var(--color-ferrari)' : tokens.color.border}`,
                          background: marcado ? 'var(--color-ferrari-glow)' : 'transparent',
                        }}>
                          <input
                            type="radio"
                            name="reserva_escopo"
                            value={opcao.valor}
                            checked={marcado}
                            onChange={() => { setEscopo(opcao.valor); setSalvou(false); }}
                            style={{ marginTop: 3, accentColor: 'var(--color-ferrari)' }}
                          />
                          <span>
                            <span style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: tokens.color.text }}>{opcao.titulo}</span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: tokens.color.muted }}>{opcao.descricao}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div style={{
                  padding: '12px 14px', borderRadius: 10, background: tokens.color.surfaceHigh,
                  fontSize: '0.82rem', color: tokens.color.textSecond, lineHeight: 1.5,
                }}>
                  {guardado !== null && pct !== null ? (
                    <>
                      Exemplo: num {exemplo} de <strong>{formatBRL(BASE_EXEMPLO)}</strong> pago, <strong>{formatBRL(guardado)}</strong>{' '}
                      ({pct}%) vão para a reserva e {formatBRL(BASE_EXEMPLO - guardado)} ficam livres no caixa.
                    </>
                  ) : (
                    <>Informe o percentual para ver um exemplo.</>
                  )}
                  <div style={{ marginTop: 6, color: tokens.color.muted, fontSize: '0.78rem' }}>
                    A reserva é calculada quando o pagamento de {LABEL_ESCOPO[escopo]} é marcado como pago. Se o pagamento for
                    cancelado ou voltar a pendente, a reserva dele sai junto.
                  </div>
                </div>
              </>
            )}

            <div>
              <button
                type="button"
                disabled={!podeSalvar}
                onClick={salvar}
                style={{
                  padding: '10px 18px', background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 10,
                  fontSize: '0.84rem', fontWeight: 700, cursor: podeSalvar ? 'pointer' : 'not-allowed', boxShadow: 'var(--shadow-sm)',
                  width: isMobile ? '100%' : 'auto', minHeight: 44, opacity: podeSalvar ? 1 : 0.5,
                }}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
