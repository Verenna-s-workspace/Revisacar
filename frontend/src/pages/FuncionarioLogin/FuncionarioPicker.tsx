import { tokens } from '../../constants';
import { Icons } from '../../features/Dashboard/Icons';

export interface FuncionarioPublico {
  id: string;
  nome: string;
  cargo: 'gerente' | 'mecanico' | 'atendente';
}

const CARGO_LABEL: Record<string, string> = {
  gerente: 'Gerente',
  mecanico: 'Mecânico',
  atendente: 'Atendente',
};

function Avatar({ nome }: { nome: string }) {
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: tokens.color.ferrari, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
    }}>
      {inicial}
    </div>
  );
}

interface Props {
  funcionarios: FuncionarioPublico[];
  loading: boolean;
  open: boolean;
  onToggleOpen: () => void;
  selecionado: FuncionarioPublico | null;
  onSelect: (f: FuncionarioPublico) => void;
}

export function FuncionarioPicker({ funcionarios, loading, open, onToggleOpen, selecionado, onSelect }: Props) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggleOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          borderRadius: 12,
          border: `1px solid ${tokens.color.border}`,
          background: tokens.color.surfaceHigh,
          cursor: 'pointer',
        }}
      >
        {selecionado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
            <Avatar nome={selecionado.nome} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: tokens.color.text }}>{selecionado.nome}</div>
              <div style={{ fontSize: '0.76rem', color: tokens.color.muted }}>{CARGO_LABEL[selecionado.cargo]}</div>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: '0.88rem', color: tokens.color.muted, padding: '6px 4px' }}>
            Escolha seu nome
          </span>
        )}
        <span style={{
          color: tokens.color.muted,
          display: 'flex',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s ease',
        }}>
          {Icons.chevD}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          maxHeight: 260,
          overflowY: 'auto',
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 12,
          boxShadow: tokens.shadow.lg,
          zIndex: 20,
        }}>
          {loading ? (
            <div style={{ padding: 18, textAlign: 'center', fontSize: '0.85rem', color: tokens.color.muted }}>
              Carregando…
            </div>
          ) : funcionarios.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', fontSize: '0.85rem', color: tokens.color.muted }}>
              Nenhum funcionário cadastrado ainda.
            </div>
          ) : (
            funcionarios.map(f => {
              const ativo = selecionado?.id === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelect(f)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: ativo ? tokens.color.critBg : 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${tokens.color.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Avatar nome={f.nome} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: ativo ? tokens.color.ferrari : tokens.color.text }}>
                      {f.nome}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>{CARGO_LABEL[f.cargo]}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
