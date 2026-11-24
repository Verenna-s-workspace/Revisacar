import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Valor } from '../../../components/Privacidade';
import { formatBRL } from '../../../utils/dashboard';
import { dataCompleta } from '../../../utils/financeiro_utils';
import { IcEditar, IcLixeira } from '../Clientes/icones';
import { IcConfirmar } from './icones';
import { labelCategoria, LABEL_FORMA_PAGAMENTO } from './categoriaLabels';
import { classeStatus, nomeDoLancamento, rotuloStatus } from './lancamentoUtils';
import type { Transacao } from './types';

interface Props {
  t: Transacao;
  podeEditar: boolean;
  onFechar: () => void;
  onPagar: () => void;
  onEditar: () => void;
  onCancelar: () => void;
}

/**
 * Bottom sheet do lançamento (celular): mostra tudo que a lista esconde — taxa, líquido, forma de pagamento,
 * datas, cliente e origem — e reúne as ações. Quem não pode editar vê só os detalhes.
 */
export function LancamentoSheet({ t, podeEditar, onFechar, onPagar, onEditar, onCancelar }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const entrada = t.tipo === 'entrada';
  const linhas: { rotulo: string; valor: React.ReactNode }[] = [
    { rotulo: 'Tipo', valor: entrada ? 'Entrada' : 'Saída' },
    { rotulo: 'Categoria', valor: labelCategoria(t.tipo, t.categoria) },
    { rotulo: 'Data', valor: dataCompleta(t.data_competencia) },
  ];
  if (t.data_vencimento) linhas.push({ rotulo: 'Vencimento', valor: dataCompleta(t.data_vencimento) });
  if (t.data_pagamento) linhas.push({ rotulo: 'Pagamento', valor: dataCompleta(t.data_pagamento) });
  if (t.forma_pagamento) linhas.push({ rotulo: 'Forma de pagamento', valor: LABEL_FORMA_PAGAMENTO[t.forma_pagamento] ?? t.forma_pagamento });
  if (t.cliente_nome) linhas.push({ rotulo: 'Cliente', valor: t.cliente_nome });
  linhas.push({ rotulo: 'Origem', valor: t.ordem_servico_id ? 'Ordem de serviço' : 'Lançamento manual' });
  if (t.criado_por_nome) linhas.push({ rotulo: 'Registrado por', valor: t.criado_por_nome });

  const temTaxa = entrada && t.taxa > 0;

  return createPortal(
    <div className="finm-sheet-backdrop" onClick={onFechar}>
      <div className="finm-sheet" role="dialog" aria-modal="true" aria-label={`Lançamento: ${nomeDoLancamento(t)}`} onClick={e => e.stopPropagation()}>
        <div className="finm-sheet__grab" aria-hidden="true" />
        <h2 className="finm-sheet__titulo">{nomeDoLancamento(t)}</h2>
        <div className="finm-sheet__sub">
          <span className={`os-status ${classeStatus(t)}`.trim()}>
            <span className="os-status__dot" aria-hidden="true" />
            {rotuloStatus(t)}
          </span>
        </div>

        <div className={`finm-sheet__valor${entrada ? ' finm-sheet__valor--entrada' : ''}`}>
          {entrada ? '+ ' : '- '}<Valor texto={formatBRL(t.valor)} />
        </div>

        <dl className="finm-sheet__lista">
          {temTaxa && (
            <>
              <div className="finm-sheet__linha"><dt>Taxa da maquininha</dt><dd>- <Valor texto={formatBRL(t.taxa)} /></dd></div>
              <div className="finm-sheet__linha"><dt>Líquido</dt><dd><Valor texto={formatBRL(t.valor_liquido)} /></dd></div>
            </>
          )}
          {linhas.map(l => (
            <div key={l.rotulo} className="finm-sheet__linha"><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>
          ))}
        </dl>

        {podeEditar && t.status === 'pendente' && (
          <button type="button" className="finm-sheet__opt finm-sheet__opt--ok" onClick={onPagar}>
            {IcConfirmar}
            {entrada ? 'Marcar como recebido' : 'Marcar como pago'}
          </button>
        )}
        {podeEditar && (
          <button type="button" className="finm-sheet__opt" onClick={onEditar}>
            {IcEditar}
            Editar lançamento
          </button>
        )}
        {podeEditar && t.status !== 'cancelado' && (
          <button type="button" className="finm-sheet__opt finm-sheet__opt--perigo" onClick={onCancelar}>
            {IcLixeira}
            Cancelar lançamento
          </button>
        )}

        <button type="button" className="finm-sheet__cancel" onClick={onFechar}>Fechar</button>
      </div>
    </div>,
    document.body,
  );
}
