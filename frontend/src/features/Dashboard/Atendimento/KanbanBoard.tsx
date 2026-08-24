import type { CSSProperties } from 'react';
import { KanbanColuna } from './KanbanColuna';
import { OSKanbanCard } from './OSKanbanCard';
import { KANBAN_COLUNAS } from '../../../types/atendimento';
import type { Agendamento } from '../../../types/agendamento';
import type { ColunasKanban, ItemKanban, OSAtendimento } from '../../../types/atendimento';

interface KanbanBoardProps {
  colunas: ColunasKanban;
  isMobile: boolean;
  /** ordemId -> nº de itens de peças vinculadas via Kit (Fase 6). */
  qtdPecasPorOrdem: Record<string, number>;
  /** ordemId -> possível retorno detectado no Histórico Express (Fase 6). */
  possivelRetornoPorOrdem: Record<string, boolean>;
  onAbrirOS: (ordem: OSAtendimento) => void;
  onIniciarAtendimento: (agendamento: Agendamento) => void;
}

export function KanbanBoard({
  colunas,
  isMobile,
  qtdPecasPorOrdem,
  possivelRetornoPorOrdem,
  onAbrirOS,
  onIniciarAtendimento,
}: KanbanBoardProps) {
  const renderCards = (itens: ItemKanban[]) =>
    itens.map(item => {
      if (item.tipo === 'agendamento') {
        return (
          <OSKanbanCard
            key={`ag-${item.agendamento.id}`}
            item={item}
            onAbrir={onAbrirOS}
            onIniciarAtendimento={onIniciarAtendimento}
          />
        );
      }
      return (
        <OSKanbanCard
          key={`os-${item.ordem.id}`}
          item={item}
          qtdPecas={qtdPecasPorOrdem[item.ordem.id]}
          possivelRetorno={possivelRetornoPorOrdem[item.ordem.id]}
          onAbrir={onAbrirOS}
          onIniciarAtendimento={onIniciarAtendimento}
        />
      );
    });

  const colunaStyle: CSSProperties = isMobile
    ? { flex: '0 0 88%', scrollSnapAlign: 'start', maxHeight: '62vh' }
    : { flex: 1, minWidth: 0, maxHeight: 640 };

  const colunasData = KANBAN_COLUNAS.map(c => ({ ...c, itens: colunas[c.id] }));

  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {colunasData.map(c => (
          <KanbanColuna key={c.id} titulo={c.titulo} count={c.itens.length} style={colunaStyle}>
            {renderCards(c.itens)}
          </KanbanColuna>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
      {colunasData.map(c => (
        <KanbanColuna key={c.id} titulo={c.titulo} count={c.itens.length} style={colunaStyle}>
          {renderCards(c.itens)}
        </KanbanColuna>
      ))}
    </div>
  );
}
