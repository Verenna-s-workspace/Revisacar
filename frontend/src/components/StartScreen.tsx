import { useState } from 'react';
import { api } from '../utils/api';
import type { OrdemServico } from '../types';

const tokens = {
  color: {
    surface: '#F5F5F5',
    text: '#1A1A1A',
    textMuted: '#666666',
    border: '#E0E0E0',
    accent: '#E63946',
    accentLight: '#FFE5E8',
  },
  radius: {
    md: '8px',
  },
  shadow: {
    md: '0 4px 6px rgba(0,0,0,0.1)',
  },
};

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.color.surface, padding: '20px' }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '30px', color: tokens.color.text }}>
            Carregue um Rascunho
          </h2>

          {error && (
            <div style={{
              background: '#FEE',
              border: '1px solid #F99',
              padding: '12px',
              borderRadius: tokens.radius.md,
              color: '#C33',
              marginBottom: '20px',
              fontSize: '0.9rem',
            }}>
              {error}
            </div>
          )}

          {rascunhos.length === 0 && !loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: 'white',
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.border}`,
            }}>
              <p style={{ color: tokens.color.textMuted, marginBottom: '20px' }}>
                Nenhum rascunho encontrado
              </p>
              <button
                onClick={() => setShowRascunhos(false)}
                style={{
                  padding: '10px 20px',
                  background: tokens.color.accent,
                  color: 'white',
                  border: 'none',
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                }}
              >
                Voltar
              </button>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}>
                {rascunhos.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'stretch',
                    }}
                  >
                    <button
                      onClick={() => handleSelectRascunho(r.id)}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '15px',
                        background: 'white',
                        border: `1px solid ${tokens.color.border}`,
                        borderRadius: tokens.radius.md,
                        textAlign: 'left',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: loading ? 0.5 : 1,
                      }}
                      onMouseOver={(e) => {
                        if (!loading) (e.target as HTMLButtonElement).style.background = tokens.color.accentLight;
                      }}
                      onMouseOut={(e) => {
                        (e.target as HTMLButtonElement).style.background = 'white';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: tokens.color.text }}>
                            OS #{r.os_num} - {r.cliente}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: tokens.color.textMuted, marginTop: '4px' }}>
                            {r.placa} • {new Date(r.updated_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: tokens.color.textMuted }}>
                          {loading ? '...' : '>'}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={(e) => handleDeleteRascunho(r.id, e)}
                      title="Deletar rascunho"
                      style={{
                        width: '40px',
                        padding: '0',
                        background: '#FEE',
                        border: `1px solid ${tokens.color.border}`,
                        borderRadius: tokens.radius.md,
                        cursor: 'pointer',
                        color: tokens.color.accent,
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        (e.target as HTMLButtonElement).style.background = tokens.color.accent;
                        (e.target as HTMLButtonElement).style.color = 'white';
                      }}
                      onMouseOut={(e) => {
                        (e.target as HTMLButtonElement).style.background = '#FEE';
                        (e.target as HTMLButtonElement).style.color = tokens.color.accent;
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowRascunhos(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: '20px',
                  background: tokens.color.surface,
                  border: `1px solid ${tokens.color.border}`,
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  color: tokens.color.text,
                }}
              >
                Voltar
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.color.surface }}>
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        <h1 style={{ marginBottom: '40px', color: tokens.color.text }}>RevisaCar</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button
            onClick={onStartNew}
            style={{
              padding: '20px',
              background: tokens.color.accent,
              color: 'white',
              border: 'none',
              borderRadius: tokens.radius.md,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: tokens.shadow.md,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.target as HTMLButtonElement).style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.target as HTMLButtonElement).style.boxShadow = tokens.shadow.md;
            }}
          >
            + Nova Ordem de Serviço
          </button>

          <button
            onClick={handleLoadRascunhos}
            disabled={loading}
            style={{
              padding: '20px',
              background: 'white',
              color: tokens.color.accent,
              border: `2px solid ${tokens.color.accent}`,
              borderRadius: tokens.radius.md,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.background = tokens.color.accentLight;
              }
            }}
            onMouseOut={(e) => {
              (e.target as HTMLButtonElement).style.background = 'white';
            }}
          >
            {loading ? 'Carregando...' : 'Carregar Rascunho'}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: '#FEE',
            border: '1px solid #F99',
            borderRadius: tokens.radius.md,
            color: '#C33',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
