import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { Input } from '../../../components/inputs/input';
import { formatCpfCnpj, formatPhoneBR } from '../../../components/inputs/masks';
import { VeiculoIcons } from './icons';
import type { Cliente } from '../../../types/cliente';
import type { VeiculoProprietario } from '../../../types/veiculo';

// ── Seleção do proprietário (vínculo veículo ↔ cliente) ───────────────────────
// Dois caminhos, ambos aceitos pelo backend (POST/PATCH /veiculos, campo `proprietario`):
//   • cliente cadastrado → manda `clienteId`; o servidor confere que ele é da carteira da oficina;
//   • novo cliente      → manda só texto; o servidor acha o cliente por CPF/CNPJ, e-mail ou nome
//                         exato, ou cadastra um de balcão na hora.
// Usado no formulário do veículo e no modal "Alterar proprietário" — um componente só.

interface OwnerPickerProps {
  /** Clientes da carteira da oficina (useClientes). */
  clientes: Cliente[];
  /** Valor atual: com `clienteId` = cliente cadastrado; sem = texto do "novo cliente"; null = nenhum. */
  value: VeiculoProprietario | null;
  onChange: (proprietario: VeiculoProprietario | null) => void;
  /** Prefixo dos `name` dos campos (únicos na tela). */
  name: string;
  autoFocus?: boolean;
}

type Modo = 'cadastrado' | 'novo';

const so = (s: string | undefined) => (s ?? '').replace(/\D/g, '');
const norm = (s: string | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Filtra por nome, e-mail, ou documento/telefone (só dígitos). Busca vazia = todos. */
export function filtrarClientes(clientes: Cliente[], busca: string): Cliente[] {
  const q = norm(busca);
  const d = so(busca);
  if (!q) return clientes;
  return clientes.filter(c =>
    norm(c.nome).includes(q) ||
    norm(c.email).includes(q) ||
    (d.length >= 3 && (so(c.cpfCnpj).includes(d) || so(c.telefone).includes(d))),
  );
}

/** Converte um cliente da carteira no formato enviado ao backend. */
export function clienteParaProprietario(c: Cliente): VeiculoProprietario {
  return {
    clienteId: c.id,
    nome: c.nome,
    docCpfCnpj: c.cpfCnpj,
    telefone: c.telefone,
    email: c.email,
  };
}

/** Dois proprietários são o mesmo vínculo? (mesmo cliente, ou ambos vazios). */
export function mesmoProprietario(a: VeiculoProprietario | null | undefined, b: VeiculoProprietario | null | undefined): boolean {
  const va = a && a.nome.trim() ? a : null;
  const vb = b && b.nome.trim() ? b : null;
  if (!va || !vb) return !va && !vb;
  return !!va.clienteId && va.clienteId === vb.clienteId;
}

/** "CPF · telefone · e-mail" já formatados, só com o que existir. */
const resumoContato = (doc?: string, tel?: string, email?: string) =>
  [doc ? formatCpfCnpj(doc) : '', tel ? formatPhoneBR(tel) : '', email].filter(Boolean).join(' · ');

const btnLink: React.CSSProperties = {
  border: 'none', background: 'transparent', color: tokens.color.ferrari, cursor: 'pointer',
  fontSize: '0.78rem', fontWeight: 700, padding: 0, fontFamily: tokens.fontSans,
};

export function OwnerPicker({ clientes, value, onChange, name, autoFocus }: OwnerPickerProps) {
  const [modo, setModo] = useState<Modo>(() =>
    value?.clienteId ? 'cadastrado' : value ? 'novo' : clientes.length > 0 ? 'cadastrado' : 'novo',
  );
  const [busca, setBusca] = useState('');
  const filtrados = useMemo(() => filtrarClientes(clientes, busca), [clientes, busca]);

  const trocarModo = (m: Modo) => { setModo(m); setBusca(''); onChange(null); };

  // ── Cliente já cadastrado ─────────────────────────────────────────────────
  if (modo === 'cadastrado') {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {value?.clienteId ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12,
            background: tokens.color.ferrariMid, border: `1px solid ${tokens.color.ferrari}`,
          }}>
            <span style={{ display: 'flex', color: tokens.color.ferrari, flexShrink: 0 }}>{VeiculoIcons.linkUser}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: tokens.color.text }}>{value.nome}</div>
              <div style={{ fontSize: '0.76rem', color: tokens.color.muted, overflowWrap: 'anywhere' }}>
                {resumoContato(value.docCpfCnpj, value.telefone, value.email) || 'Cliente cadastrado'}
              </div>
            </div>
            <button type="button" onClick={() => onChange(null)} style={btnLink}>Trocar</button>
          </div>
        ) : (
          <>
            <Input
              name={`${name}_busca`} type="search" label="Cliente cadastrado"
              placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
              value={busca} onChangeValue={setBusca} autoFocus={autoFocus}
            />
            <div
              role="listbox" aria-label="Clientes cadastrados"
              style={{
                maxHeight: 188, overflowY: 'auto', borderRadius: 12,
                border: `1px solid ${tokens.color.border}`, background: tokens.color.bg,
              }}
            >
              {filtrados.length === 0 ? (
                <div style={{ padding: '14px', fontSize: '0.8rem', color: tokens.color.muted, textAlign: 'center' }}>
                  {clientes.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado para essa busca.'}
                </div>
              ) : filtrados.map(c => (
                <button
                  key={c.id} type="button" role="option" aria-selected={false}
                  onClick={() => onChange(clienteParaProprietario(c))}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', cursor: 'pointer',
                    border: 'none', borderBottom: `1px solid ${tokens.color.border}`, background: 'transparent',
                    fontFamily: tokens.fontSans,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: tokens.color.text }}>{c.nome}</div>
                  <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>
                    {resumoContato(c.cpfCnpj, c.telefone, c.email) || 'Sem documento ou contato'}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
        <div>
          <button type="button" onClick={() => trocarModo('novo')} style={btnLink}>
            + Cadastrar um novo cliente
          </button>
        </div>
      </div>
    );
  }

  // ── Novo cliente (só texto; o servidor acha por CPF/e-mail/nome ou cadastra) ─────
  const campo = (patch: Partial<VeiculoProprietario>) =>
    onChange({ nome: '', ...(value && !value.clienteId ? value : {}), ...patch });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="dashboard-form-grid-2col" style={{ gap: '12px 20px' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Input
            name={`${name}_nome`} label="Nome do Proprietário" placeholder="Nome completo"
            value={value?.nome ?? ''} onChangeValue={v => campo({ nome: v })} autoFocus={autoFocus}
          />
        </div>
        <Input
          name={`${name}_doc`} type="cpf_cnpj" label="CPF/CNPJ" placeholder="000.000.000-00"
          value={value?.docCpfCnpj ?? ''} onChangeValue={v => campo({ docCpfCnpj: v || undefined })}
        />
        <Input
          name={`${name}_tel`} type="phone" label="Telefone" placeholder="(11) 99999-9999"
          value={value?.telefone ?? ''} onChangeValue={v => campo({ telefone: v || undefined })}
        />
        <div style={{ gridColumn: 'span 2' }}>
          <Input
            name={`${name}_email`} type="email" label="E-mail" placeholder="email@exemplo.com"
            value={value?.email ?? ''} onChangeValue={v => campo({ email: v || undefined })}
          />
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: tokens.color.muted, lineHeight: 1.5 }}>
        Se já existir um cliente com esse CPF/CNPJ ou e-mail, o veículo é vinculado a ele; senão, o cliente é cadastrado.
      </div>
      {clientes.length > 0 && (
        <div>
          <button type="button" onClick={() => trocarModo('cadastrado')} style={btnLink}>
            ← Escolher um cliente já cadastrado
          </button>
        </div>
      )}
    </div>
  );
}
