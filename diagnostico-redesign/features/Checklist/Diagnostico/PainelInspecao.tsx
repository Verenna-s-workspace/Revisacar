import { Button } from '../../../components/system';
import { IcSetaDireita } from './icones';
import './diagnostico.css';

interface PainelInspecaoProps {
  ok: number; warn: number; crit: number; na: number; pendentes: number;
  /** Críticos ainda sem observação — só avisa, não bloqueia. */
  criticosSemObs: number;
  /** Nomes dos itens marcados em "Trocar" (vão para a tabela de peças e ao orçamento). */
  paraTrocar: { key: string; nome: string }[];
  acao: { rotulo: string; desabilitada: boolean; ocupada?: boolean; onClick: () => void };
  ajuda?: string;
  salvo?: string;
}

/** Painel lateral "Resumo da inspeção": contagem por status, itens para trocar e a ação principal da sub-etapa. */
export function PainelInspecao({ ok, warn, crit, na, pendentes, criticosSemObs, paraTrocar, acao, ajuda, salvo }: PainelInspecaoProps) {
  const linhas: { rotulo: string; valor: number; tom?: 'ok' | 'warn' | 'crit' }[] = [
    { rotulo: 'OK', valor: ok, tom: 'ok' },
    { rotulo: 'Atenção', valor: warn, tom: 'warn' },
    { rotulo: 'Crítico', valor: crit, tom: 'crit' },
    ...(na > 0 ? [{ rotulo: 'N/A', valor: na }] : []),
    { rotulo: 'Pendentes', valor: pendentes },
  ];
  return (
    <aside className="osf-resumo" aria-label="Resumo da inspeção">
      <div className="osf-resumo__topo"><h2 className="osf-resumo__titulo">Resumo da inspeção</h2></div>
      <ul className="osd-res__linhas">
        {linhas.map((l) => (
          <li key={l.rotulo} className="osd-res__lin" data-tom={l.valor > 0 ? l.tom : undefined}>
            <span>{l.rotulo}</span><b>{l.valor}</b>
          </li>
        ))}
      </ul>
      {criticosSemObs > 0 && (
        <div className="osf-aviso" data-tom="crit" role="status">
          {criticosSemObs === 1 ? '1 item crítico está sem observação.' : `${criticosSemObs} itens críticos estão sem observação.`} Descreva o problema para constar no orçamento.
        </div>
      )}
      <div className="osf-resumo__sep" />
      <p className="osd-res__rot">Para trocar (vão ao orçamento)</p>
      {paraTrocar.length === 0 ? (
        <p className="osf-resumo__ajuda">Nenhum item marcado. Use “Trocar” nos itens do diagnóstico.</p>
      ) : (
        <ul className="osd-res__troca">{paraTrocar.map((t) => <li key={t.key}>{t.nome}</li>)}</ul>
      )}
      <Button variant="primary" className="osf-resumo__cta" icon={<IcSetaDireita />} disabled={acao.desabilitada} loading={acao.ocupada} onClick={acao.onClick}>
        {acao.rotulo}
      </Button>
      {ajuda && <p className="osf-resumo__ajuda" role="status">{ajuda}</p>}
      {salvo && <p className="osf-resumo__salvo">{salvo}</p>}
    </aside>
  );
}
