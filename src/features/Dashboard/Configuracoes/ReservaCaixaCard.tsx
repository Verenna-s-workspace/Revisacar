import { useState, useEffect } from 'react';
import { Button } from '../../../components/system';
import { Aviso, EstadoMensagem, Interruptor, RodapeAcoes } from './cfgUi';
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
export function ReservaCaixaCard() {
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

  if (carregando) return <EstadoMensagem>Carregando…</EstadoMensagem>;
  if (indisponivel) {
    return (
      <EstadoMensagem>
        A reserva de caixa ainda não está disponível no seu sistema. Peça a quem cuida do RevisaCar para ativá-la.
      </EstadoMensagem>
    );
  }

  return (
    <>
      {erro && <Aviso tom="crit">{erro}</Aviso>}
      {salvou && !erro && (
        <Aviso tom="ok">Salvo. Vale para os próximos pagamentos; o que já foi pago não muda.</Aviso>
      )}

      {/* Liga/desliga */}
      <div className="cfg-opcao-linha">
        <div className="cfg-opcao-linha__texto">
          <span className="cfg-bloco__titulo">Usar reserva de caixa</span>
          <span className="cfg-texto cfg-texto--pequeno">
            Não é desconto: o cliente paga o mesmo valor. É só uma separação interna do que entrou.
          </span>
        </div>
        <Interruptor
          ligado={ativa}
          rotulo="Usar reserva de caixa"
          onAlternar={() => { setAtiva(a => !a); setSalvou(false); }}
        />
      </div>

      {ativa && (
        <>
          <div style={{ maxWidth: 220 }}>
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

          <fieldset className="cfg-opcoes">
            <legend className="cfg-rotulo cfg-opcoes__legenda">Em quais pagamentos guardar</legend>
            <div className="cfg-opcoes__grade">
              {ESCOPOS_RESERVA.map(opcao => {
                const marcado = escopo === opcao.valor;
                return (
                  <label key={opcao.valor} className={`cfg-opcao${marcado ? ' cfg-opcao--marcada' : ''}`}>
                    <input
                      type="radio"
                      name="reserva_escopo"
                      value={opcao.valor}
                      checked={marcado}
                      onChange={() => { setEscopo(opcao.valor); setSalvou(false); }}
                    />
                    <span>
                      <span className="cfg-opcao__titulo">{opcao.titulo}</span>
                      <span className="cfg-opcao__texto">{opcao.descricao}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="cfg-destaque">
            {guardado !== null && pct !== null ? (
              <>
                Exemplo: num {exemplo} de <strong>{formatBRL(BASE_EXEMPLO)}</strong> pago, <strong>{formatBRL(guardado)}</strong>{' '}
                ({pct}%) vão para a reserva e {formatBRL(BASE_EXEMPLO - guardado)} ficam livres no caixa.
              </>
            ) : (
              <>Informe o percentual para ver um exemplo.</>
            )}
            <div className="cfg-texto cfg-texto--pequeno">
              A reserva é calculada quando o pagamento de {LABEL_ESCOPO[escopo]} é marcado como pago. Se o pagamento for
              cancelado ou voltar a pendente, a reserva dele sai junto.
            </div>
          </div>
        </>
      )}

      <RodapeAcoes>
        <Button variant="primary" disabled={!podeSalvar} loading={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </RodapeAcoes>
    </>
  );
}
