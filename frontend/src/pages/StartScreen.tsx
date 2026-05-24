import { useState } from 'react';
import '../styles/screens.css';
import { api } from '../utils/api';
import type { OrdemServico } from '../types';

interface StartScreenProps {
  onStartNew: () => void;
  onLoadRascunho: (ordem: OrdemServico & { id: string }) => void;
}

export function StartScreen({ onStartNew, onLoadRascunho }: StartScreenProps) {
  const [showRascunhos, setShowRascunhos] = useState(false);
  const [rascunhos, setRascunhos] = useState<(OrdemServico & { id: string; os_num: string; cliente: string; placa: string; updated_at: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadRascunhos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listarOrdens();
      const filtrados = data
        .filter((o: any) => o.status === 'rascunho')
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setRascunhos(filtrados);
      setShowRascunhos(true);
    } catch (err) {
      setError('Erro ao carregar rascunhos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRascunho = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const ordem = await api.obterOrdem(id);
      onLoadRascunho(ordem);
    } catch (err) {
      setError('Erro ao carregar ordem');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRascunho = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Impedir que trigre o onClick do botão principal
    
    if (!window.confirm('Tem certeza que deseja deletar este rascunho?')) return;
    
    try {
      await api.deletarOrdem(id);
      setRascunhos((prev) => prev.filter((r) => r.id !== id));
      if (rascunhos.length === 1) {
        setShowRascunhos(false);
      }
    } catch (err) {
      setError('Erro ao deletar rascunho');
      console.error(err);
    }
  };

  if (showRascunhos) {
    return (
      <div className="start-screen-shell">
        <div className="start-screen-center">
          <div className="start-screen-card">
            <h2 className="start-screen-title">Carregue um Rascunho</h2>

            {error && <div className="start-screen-error">{error}</div>}

            {rascunhos.length === 0 && !loading ? (
              <div className="start-screen-empty">
                <p>Nenhum rascunho encontrado</p>
                <button className="start-screen-back" onClick={() => setShowRascunhos(false)}>
                  Voltar
                </button>
              </div>
            ) : (
              <>
                <div className="start-screen-drafts">
                  {rascunhos.map((r) => (
                    <div key={r.id} className="start-screen-draft-row">
                      <button
                        className="start-screen-draft-button"
                        onClick={() => handleSelectRascunho(r.id)}
                        disabled={loading}
                      >
                        <div className="start-screen-draft-meta">
                          <div>
                            <div className="start-screen-draft-title">OS #{r.os_num} - {r.cliente}</div>
                            <div className="start-screen-draft-subtitle">
                              {r.placa} • {new Date(r.updated_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="start-screen-draft-arrow">{loading ? '...' : '>'}</div>
                        </div>
                      </button>

                      <button
                        className="start-screen-draft-delete"
                        onClick={(e) => handleDeleteRascunho(r.id, e)}
                        title="Deletar rascunho"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className="start-screen-back" onClick={() => setShowRascunhos(false)}>
                  Voltar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="start-screen-shell">
      <div className="start-screen-center">
        <div className="start-screen-card">
          <h1 className="start-screen-title">RevisaCar</h1>

          <div className="start-screen-actions">
            <button className="start-screen-button" type="button" onClick={onStartNew}>
              + Nova Ordem de Serviço
            </button>

            <button
              className="start-screen-secondary"
              type="button"
              onClick={handleLoadRascunhos}
              disabled={loading}
            >
              {loading ? 'Carregando...' : 'Carregar Rascunho'}
            </button>
          </div>

          {error && <div className="start-screen-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
