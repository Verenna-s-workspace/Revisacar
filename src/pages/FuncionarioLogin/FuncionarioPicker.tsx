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
  return <div className="auth-avatar">{inicial}</div>;
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
    <div className="auth-picker">
      <button type="button" className="auth-picker-trigger" onClick={onToggleOpen} aria-expanded={open} aria-haspopup="listbox">
        {selecionado ? (
          <div className="auth-picker-who">
            <Avatar nome={selecionado.nome} />
            <div>
              <div className="auth-person-name">{selecionado.nome}</div>
              <div className="auth-person-role">{CARGO_LABEL[selecionado.cargo]}</div>
            </div>
          </div>
        ) : (
          <span className="auth-picker-placeholder">Escolha seu nome</span>
        )}
        <span className={`auth-picker-chev${open ? ' is-open' : ''}`}>{Icons.chevD}</span>
      </button>

      {open && (
        <div className="auth-picker-menu" role="listbox">
          {loading ? (
            <div className="auth-picker-empty">Carregando…</div>
          ) : funcionarios.length === 0 ? (
            <div className="auth-picker-empty">Nenhum funcionário cadastrado ainda.</div>
          ) : (
            funcionarios.map((f) => (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={selecionado?.id === f.id}
                className={`auth-picker-item${selecionado?.id === f.id ? ' is-selected' : ''}`}
                onClick={() => onSelect(f)}
              >
                <Avatar nome={f.nome} />
                <div>
                  <div className="auth-person-name">{f.nome}</div>
                  <div className="auth-person-role">{CARGO_LABEL[f.cargo]}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
