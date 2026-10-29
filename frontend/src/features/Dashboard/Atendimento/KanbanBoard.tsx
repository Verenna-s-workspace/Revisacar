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
  loading?: boolean;
}

export function KanbanBoard({
  colunas,
  isMobile,
  qtdPecasPorOrdem,
  possivelRetornoPorOrdem,
  onAbrirOS,
  onIniciarAtendimento,
  loading = false,
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

  // Mobile: as colunas (Fila, Em Execução, Bloqueado, Finalizado) ficam uma
  // embaixo da outra, em largura total, e a própria página rola. Antes ficavam
  // lado a lado num carrossel horizontal que não deixava ver tudo.
  const colunaStyle: CSSProperties = isMobile
    ? { width: '100%' }
    : { flex: 1, minWidth: 0, maxHeight: 640 };

  const colunasData = KANBAN_COLUNAS.map(c => ({ ...c, itens: colunas[c.id] }));

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {colunasData.map(c => (
          <KanbanColuna key={c.id} titulo={c.titulo} count={c.itens.length} style={colunaStyle} loading={loading}>
            {renderCards(c.itens)}
          </KanbanColuna>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
      {colunasData.map(c => (
        <KanbanColuna key={c.id} titulo={c.titulo} count={c.itens.length} style={colunaStyle} loading={loading}>
          {renderCards(c.itens)}
        </KanbanColuna>
      ))}
    </div>
  );
}
