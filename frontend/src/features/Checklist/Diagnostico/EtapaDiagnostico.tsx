import { useRef, useState } from 'react';
import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import type { Section } from '../../../types';
import { Button } from '../../../components/system';
import { LIM, sanitizarItemAdicional } from '../../../utils/campos_checklist';
import { chavesPendentes, contagemDoSistema, itensDoSistema } from '../../../utils/diagnostico_os';
import { ItemInspecao } from './ItemInspecao';
import { IcCheck, IcMais, IcPrancheta } from './icones';
import './diagnostico.css';

interface EtapaDiagnosticoProps {
  os: ReturnType<typeof useOrdemServico>;
  /** Sistema aberto no menu lateral (undefined = a OS ainda não tem sistemas). */
  sistema?: Section;
  onAbrirSistemas: () => void;
}

/** Sub-etapa 2 — Diagnóstico: itens do sistema escolhido no menu. Mesmos handlers do hook; só muda a apresentação. */
export function EtapaDiagnostico({ os, sistema, onAbrirSistemas }: EtapaDiagnosticoProps) {
  const { checklist, itensAdicionais, setChecklistStatus, setChecklistObs, addChecklistItem, removeChecklistItem, trocaSet, toggleTroca } = os;

  if (!sistema) {
    return (
      <div className="osd-vazio" role="status">
        <IcPrancheta />
        <span>Nenhum sistema na OS. Escolha o que será inspecionado.</span>
        <Button variant="secondary" icon={<IcMais />} onClick={onAbrirSistemas}>Adicionar sistema</Button>
      </div>
    );
  }

  const itens = itensDoSistema(sistema, itensAdicionais);
  const c = contagemDoSistema(sistema, checklist, itensAdicionais);
  const pendentes = chavesPendentes(sistema, checklist, itensAdicionais);
  const marcarRestantesOk = () => pendentes.forEach((k) => setChecklistStatus(k, 'ok'));

  return (
    <>
      <div className="osd-topo">
        <h2 className="osd-titulo">{sistema.label} <span className="osd-dica" style={{ marginLeft: 6 }}>{c.feitos} de {c.total}</span></h2>
        <p className="osd-dica osd-dica--atalhos">Atalhos: 1 OK · 2 Atenção · 3 Crítico · 4 N/A</p>
      </div>

      {sistema.isDynamic && itens.length === 0 ? (
        <div className="osd-lista"><div className="osd-vazio"><IcPrancheta /><span>Nenhum item adicionado</span></div></div>
      ) : (
        <ul className="osd-lista">
          {itens.map((name, i) => (
            <li key={sistema.isDynamic ? `${name}-${i}` : name}>
              <ItemInspecao
                sid={sistema.id} name={name} data={checklist[`${sistema.id}:${name}`]}
                onSetStatus={setChecklistStatus} onSetObs={setChecklistObs}
                trocado={trocaSet.has(`${sistema.id}:${name}`)} onToggleTroca={toggleTroca}
                onRemover={sistema.isDynamic ? () => removeChecklistItem(i) : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {sistema.isDynamic && <NovoItem existentes={itensAdicionais} onAdd={addChecklistItem} />}

      {pendentes.length > 0 && (
        <div className="osd-rodape-lista">
          <Button variant="secondary" icon={<IcCheck />} onClick={marcarRestantesOk}>
            {pendentes.length === 1 ? 'Marcar 1 restante como OK' : `Marcar ${pendentes.length} restantes como OK`}
          </Button>
        </div>
      )}
    </>
  );
}

// Item digitado à mão (sistema "Inspeção Personalizada"): Enter ou botão; o hook ainda barra repetidos e o teto de itens.
function NovoItem({ existentes, onAdd }: { existentes: string[]; onAdd: (nome: string) => void }) {
  const [valor, setValor] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  const nome = valor.trim();
  const repetido = nome !== '' && existentes.some((n) => n.toLowerCase() === nome.toLowerCase());
  const cheio = existentes.length >= LIM.maxItensAdicionais;

  const confirmar = () => {
    if (!nome || repetido || cheio) return;
    onAdd(nome);
    setValor('');
    campo.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="osd-add">
        <input
          ref={campo} className="osd-campo" value={valor} maxLength={LIM.itemAdicional} enterKeyHint="done"
          aria-label="Nome do item a inspecionar" placeholder="Nome do item — Enter para adicionar" disabled={cheio}
          onChange={(e) => setValor(sanitizarItemAdicional(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } }}
        />
        <Button variant="secondary" icon={<IcMais />} onClick={confirmar} disabled={!nome || repetido || cheio}>Adicionar</Button>
      </div>
      {repetido && <p className="osf-nota" role="status">Esse item já está na lista.</p>}
      {cheio && <p className="osf-nota" role="status">Limite de {LIM.maxItensAdicionais} itens personalizados atingido.</p>}
    </div>
  );
}
