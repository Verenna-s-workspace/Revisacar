import { useState } from 'react';
import { tokens, COMBUSTIVEL_OPTIONS } from '../../../constants';
import { CATEGORIA_OPTIONS } from '../../../utils/veiculos_utils';
import { ClienteIcons } from './icons';
import { Icons } from '../Icons';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import type { Cliente, NovoClienteInput, NovoVeiculoClienteInput } from '../../../types/cliente';
import type { VeiculoCategoria } from '../../../types/veiculo';

interface ClientFormModalProps {
  /** Quando presente, o modal funciona em modo edição (apenas dados pessoais). */
  cliente?: Cliente;
  onSave: (input: NovoClienteInput, veiculosNovos: NovoVeiculoClienteInput[]) => void;
  onClose: () => void;
}

interface FormState {
  nome: string; cpfCnpj: string; telefone: string; email: string; endereco: string; observacoes: string;
}

function buildInitialState(c?: Cliente): FormState {
  return {
    nome: c?.nome ?? '',
    cpfCnpj: c?.cpfCnpj ?? '',
    telefone: c?.telefone ?? '',
    email: c?.email ?? '',
    endereco: c?.endereco ?? '',
    observacoes: c?.observacoes ?? '',
  };
}

function buildEmptyVeiculo(): NovoVeiculoClienteInput {
  return {
    marca: '', modelo: '', ano: String(new Date().getFullYear()), placa: '', cor: '',
    categoria: 'hatch', quilometragem: '', motor: '', combustivel: 'Flex', observacoes: '',
  };
}

export function ClientFormModal({ cliente, onSave, onClose }: ClientFormModalProps) {
  const isEdit = !!cliente;
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(() => buildInitialState(cliente));
  const [fotoPrincipal, setFotoPrincipal] = useState<string | undefined>(cliente?.fotoPrincipal);
  const [veiculosNovos, setVeiculosNovos] = useState<NovoVeiculoClienteInput[]>([]);

  const setField = <K extends keyof FormState>(key: K) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: v }));

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => setFotoPrincipal(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateVeiculo = (idx: number, patch: Partial<NovoVeiculoClienteInput>) =>
    setVeiculosNovos(prev => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  const removeVeiculo = (idx: number) => setVeiculosNovos(prev => prev.filter((_, i) => i !== idx));
  const addVeiculo = () => setVeiculosNovos(prev => [...prev, buildEmptyVeiculo()]);

  const step1Valid = form.nome.trim() !== '';
  const veiculosValid = veiculosNovos.every(v => v.marca.trim() && v.modelo.trim() && v.placa.trim());

  const handleSubmit = () => {
    if (!step1Valid || !veiculosValid) return;
    const input: NovoClienteInput = {
      nome: form.nome.trim(),
      cpfCnpj: form.cpfCnpj.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      email: form.email.trim() || undefined,
      endereco: form.endereco.trim() || undefined,
      observacoes: form.observacoes.trim() || undefined,
      fotoPrincipal,
    };
    onSave(input, veiculosNovos);
    onClose();
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 740 }}>
        {/* Header */}
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{isEdit ? 'Editar Cliente' : 'Cadastrar Cliente'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {[1, 2].map(n => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 60, height: 5, borderRadius: 99,
                    background: step >= n ? tokens.color.ferrari : tokens.color.border,
                    transition: 'background 0.25s',
                  }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: step >= n ? tokens.color.ferrari : tokens.color.muted }}>
                    {n === 1 ? 'Dados do Cliente' : 'Veículos'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        {/* ── Step 1: dados pessoais + foto ── */}
        {step === 1 && (
          <div className="dashboard-modal__body">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <label
                style={{
                  width: 96, height: 96, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px dashed ${tokens.color.borderMd}`, background: tokens.color.bg,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden', position: 'relative',
                }}
              >
                {fotoPrincipal ? (
                  <img src={fotoPrincipal} alt="Foto do cliente" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <span style={{ color: tokens.color.muted, display: 'flex' }}>{ClienteIcons.uploadCloud}</span>
                    <span style={{ fontSize: '0.58rem', color: tokens.color.subtle, marginTop: 5, fontFamily: tokens.fontMono, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                      Adicionar foto
                    </span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleFoto} style={{ display: 'none' }} />
              </label>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: tokens.color.text, marginBottom: 4 }}>Foto do Cliente</div>
                <div style={{ fontSize: '0.76rem', color: tokens.color.muted, lineHeight: 1.5, marginBottom: fotoPrincipal ? 8 : 0 }}>
                  Opcional. Sem foto, o card exibe as iniciais do nome.
                </div>
                {fotoPrincipal && (
                  <button
                    onClick={() => setFotoPrincipal(undefined)}
                    style={{ border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.muted, borderRadius: 8, padding: '5px 11px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>

            <div className="dashboard-form-grid-2col" style={{ gap: '14px 20px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <Input name="cli_nome" label="Nome Completo" required placeholder="Nome do cliente" value={form.nome} onChangeValue={setField('nome')} />
              </div>
              <div>
                <Input name="cli_doc" type="cpf_cnpj" label="CPF/CNPJ" placeholder="000.000.000-00" value={form.cpfCnpj} onChangeValue={setField('cpfCnpj')} />
              </div>
              <div>
                <Input name="cli_tel" type="phone" label="Telefone" placeholder="(11) 99999-9999" value={form.telefone} onChangeValue={setField('telefone')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Input name="cli_email" type="email" label="E-mail" placeholder="email@exemplo.com" value={form.email} onChangeValue={setField('email')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Input name="cli_endereco" label="Endereço" placeholder="Rua, número, bairro — cidade/UF" value={form.endereco} onChangeValue={setField('endereco')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Textarea
                  name="cli_obs"
                  label="Observações"
                  placeholder="Observações gerais sobre o cliente..."
                  value={form.observacoes}
                  onChangeValue={setField('observacoes')}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: veículos vinculados ── */}
        {step === 2 && (
          <div className="dashboard-modal__body">
            <div style={{ fontSize: '0.8rem', color: tokens.color.muted, lineHeight: 1.5 }}>
              {isEdit
                ? 'Vincule novos veículos a este cliente. Veículos já cadastrados podem ser vistos e editados na tela de Veículos ou no perfil do cliente.'
                : 'Opcional. Os veículos adicionados aqui aparecem automaticamente na tela de Veículos, já vinculados a este cliente.'}
            </div>

            {veiculosNovos.map((v, idx) => (
              <div
                key={idx}
                style={{ border: `1px solid ${tokens.color.border}`, borderRadius: 12, padding: 14, position: 'relative', background: tokens.color.bg }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Veículo {idx + 1}
                  </span>
                  <button
                    onClick={() => removeVeiculo(idx)}
                    title="Remover veículo"
                    style={{ width: 24, height: 24, borderRadius: 7, border: `1px solid ${tokens.color.critBorder}`, background: 'transparent', color: tokens.color.crit, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    {ClienteIcons.x}
                  </button>
                </div>
                <div className="dashboard-form-grid-2col" style={{ gap: '10px 16px' }}>
                  <Input name={`v_marca_${idx}`} label="Marca" required placeholder="Ex: Toyota" value={v.marca} onChangeValue={val => updateVeiculo(idx, { marca: val })} />
                  <Input name={`v_modelo_${idx}`} label="Modelo" required placeholder="Ex: Corolla" value={v.modelo} onChangeValue={val => updateVeiculo(idx, { modelo: val })} />
                  <Input name={`v_placa_${idx}`} type="placa" label="Placa" required placeholder="ABC1D23" value={v.placa} onChangeValue={val => updateVeiculo(idx, { placa: val })} />
                  <Input name={`v_ano_${idx}`} type="number" label="Ano" value={v.ano} onChangeValue={val => updateVeiculo(idx, { ano: val })} />
                  <Input name={`v_cor_${idx}`} label="Cor" placeholder="Ex: Prata" value={v.cor} onChangeValue={val => updateVeiculo(idx, { cor: val })} />
                  <Select
                    name={`v_categoria_${idx}`}
                    label="Categoria"
                    value={v.categoria}
                    options={CATEGORIA_OPTIONS}
                    onChangeValue={val => updateVeiculo(idx, { categoria: val as VeiculoCategoria })}
                  />
                  <Input name={`v_km_${idx}`} type="number" label="Quilometragem" placeholder="0" value={v.quilometragem} onChangeValue={val => updateVeiculo(idx, { quilometragem: val })} />
                  <Input name={`v_motor_${idx}`} label="Motor" placeholder="Ex: 1.0 Turbo" value={v.motor} onChangeValue={val => updateVeiculo(idx, { motor: val })} />
                  <div style={{ gridColumn: 'span 2' }}>
                    <Select
                      name={`v_combustivel_${idx}`}
                      label="Combustível"
                      value={v.combustivel}
                      options={COMBUSTIVEL_OPTIONS}
                      onChangeValue={val => updateVeiculo(idx, { combustivel: val })}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input name={`v_obs_${idx}`} label="Observações" placeholder="Observações sobre o veículo..." value={v.observacoes} onChangeValue={val => updateVeiculo(idx, { observacoes: val })} />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addVeiculo}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '11px', borderRadius: 12, border: `1.5px dashed ${tokens.color.borderMd}`,
                background: 'transparent', color: tokens.color.ferrari, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex' }}>{Icons.plus}</span>
              Adicionar veículo
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'white', borderRadius: '0 0 20px 20px' }}>
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}
            >
              ← Voltar
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.muted, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}
            >
              Cancelar
            </button>
          )}
          {step === 1 ? (
            <button
              onClick={() => step1Valid && setStep(2)}
              disabled={!step1Valid}
              style={{
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: !step1Valid ? tokens.color.border : tokens.color.ferrari,
                color: !step1Valid ? tokens.color.muted : 'white',
                cursor: !step1Valid ? 'not-allowed' : 'pointer',
                fontSize: '0.84rem', fontWeight: 700, transition: 'background 0.15s',
              }}
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!veiculosValid}
              title={!veiculosValid ? 'Preencha marca, modelo e placa de cada veículo (ou remova-o)' : undefined}
              style={{
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: !veiculosValid ? tokens.color.border : tokens.color.ferrari,
                color: !veiculosValid ? tokens.color.muted : 'white',
                cursor: !veiculosValid ? 'not-allowed' : 'pointer',
                fontSize: '0.84rem', fontWeight: 700, boxShadow: !veiculosValid ? 'none' : tokens.shadow.ferrari,
              }}
            >
              {isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
