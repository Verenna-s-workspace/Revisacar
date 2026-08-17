import { useState } from 'react';
import { tokens } from '../../../constants';
import { COMBUSTIVEL_OPTIONS } from '../../../constants';
import { PhotoGrid, Lightbox } from '../../../components/ui';
import { CATEGORIA_OPTIONS, CAMBIO_OPTIONS, PORTAS_OPTIONS } from '../../../utils/veiculos_utils';
import { VeiculoIcons } from './icons';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import type { NovoVeiculoInput, VeiculoCadastrado, VeiculoCategoria, VeiculoCambio } from '../../../types/veiculo';

interface Photo { src: string; name: string; }

interface VehicleFormModalProps {
  /** Quando presente, o modal funciona em modo edição. */
  veiculo?: VeiculoCadastrado;
  onSave: (input: NovoVeiculoInput) => void;
  onClose: () => void;
}

interface FormState {
  placa: string; marca: string; modelo: string; ano: string; cor: string; quilometragem: string;
  categoria: VeiculoCategoria; combustivel: string; cambio: VeiculoCambio; portas: string;
  chassi: string; renavam: string; observacoes: string;
  proprietarioNome: string; proprietarioDoc: string; proprietarioTelefone: string; proprietarioEmail: string;
}

function buildInitialState(v?: VeiculoCadastrado): FormState {
  return {
    placa: v?.placa ?? '',
    marca: v?.marca ?? '',
    modelo: v?.modelo ?? '',
    ano: v ? String(v.ano) : '',
    cor: v?.cor ?? '',
    quilometragem: v ? String(v.quilometragem) : '',
    categoria: v?.categoria ?? 'hatch',
    combustivel: v?.combustivel ?? 'Flex',
    cambio: v?.cambio ?? 'Manual',
    portas: v ? String(v.portas) : '4',
    chassi: v?.chassi ?? '',
    renavam: v?.renavam ?? '',
    observacoes: v?.observacoes ?? '',
    proprietarioNome: v?.proprietario?.nome ?? '',
    proprietarioDoc: v?.proprietario?.docCpfCnpj ?? '',
    proprietarioTelefone: v?.proprietario?.telefone ?? '',
    proprietarioEmail: v?.proprietario?.email ?? '',
  };
}

const PORTAS_SELECT_OPTIONS = PORTAS_OPTIONS.map(p => ({ value: String(p), label: `${p} portas` }));

export function VehicleFormModal({ veiculo, onSave, onClose }: VehicleFormModalProps) {
  const isEdit = !!veiculo;
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(() => buildInitialState(veiculo));
  const [fotoPrincipal, setFotoPrincipal] = useState<string | undefined>(veiculo?.fotoPrincipal);
  const [fotos, setFotos] = useState<Photo[]>(() => (veiculo?.fotosAdicionais ?? []).map(src => ({ src, name: 'foto' })));
  const [preview, setPreview] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: v as FormState[K] }));

  const handleFotoPrincipal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => setFotoPrincipal(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFotosAdicionais = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = ev => setFotos(prev => [...prev, { src: ev.target?.result as string, name: file.name }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeFoto = (i: number) => setFotos(prev => prev.filter((_, idx) => idx !== i));

  const step1Valid = form.placa.trim() && form.marca.trim() && form.modelo.trim() && form.ano.trim();

  const handleSubmit = () => {
    if (!step1Valid) return;
    const input: NovoVeiculoInput = {
      placa: form.placa.trim().toUpperCase(),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      ano: Number(form.ano) || new Date().getFullYear(),
      cor: form.cor.trim(),
      categoria: form.categoria,
      quilometragem: Number(form.quilometragem) || 0,
      combustivel: form.combustivel,
      cambio: form.cambio,
      portas: Number(form.portas) || 4,
      chassi: form.chassi.trim() || undefined,
      renavam: form.renavam.trim() || undefined,
      observacoes: form.observacoes.trim() || undefined,
      fotoPrincipal,
      fotosAdicionais: fotos.map(f => f.src),
      proprietario: form.proprietarioNome.trim()
        ? {
            nome: form.proprietarioNome.trim(),
            docCpfCnpj: form.proprietarioDoc.trim() || undefined,
            telefone: form.proprietarioTelefone.trim() || undefined,
            email: form.proprietarioEmail.trim() || undefined,
          }
        : null,
      status: veiculo?.status,
    };
    onSave(input);
    onClose();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: tokens.color.muted, marginBottom: 5, display: 'block',
  };

  return (
    <>
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{isEdit ? 'Editar Veículo' : 'Cadastrar Veículo'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {[1, 2].map(n => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 60, height: 5, borderRadius: 99,
                    background: step >= n ? tokens.color.ferrari : tokens.color.border,
                    transition: 'background 0.25s',
                  }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: step >= n ? tokens.color.ferrari : tokens.color.muted }}>
                    {n === 1 ? 'Dados do Veículo' : 'Fotos e Proprietário'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        {/* ── Step 1: dados do veículo ── */}
        {step === 1 && (
          <div className="dashboard-modal__body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              <Input
                name="placa" type="placa" label="Placa" required placeholder="ABC1D23"
                value={form.placa} onChangeValue={setField('placa')}
                style={{ fontFamily: tokens.fontMono, letterSpacing: '0.06em' }}
              />
              <Select name="categoria" label="Categoria" required value={form.categoria} options={CATEGORIA_OPTIONS} onChangeValue={setField('categoria')} />

              <Input name="marca" label="Marca" required placeholder="Toyota" value={form.marca} onChangeValue={setField('marca')} />
              <Input name="modelo" label="Modelo" required placeholder="Corolla Altis" value={form.modelo} onChangeValue={setField('modelo')} />

              <Input name="ano" type="number" label="Ano" required placeholder="2022" value={form.ano} onChangeValue={setField('ano')} />
              <Input name="cor" label="Cor" placeholder="Prata" value={form.cor} onChangeValue={setField('cor')} />

              <Input name="quilometragem" type="number" label="Quilometragem" placeholder="32000" value={form.quilometragem} onChangeValue={setField('quilometragem')} />
              <Select name="combustivel" label="Combustível" value={form.combustivel} options={COMBUSTIVEL_OPTIONS} onChangeValue={setField('combustivel')} />

              <Select name="cambio" label="Câmbio" value={form.cambio} options={CAMBIO_OPTIONS} onChangeValue={setField('cambio')} />
              <Select name="portas" label="Número de Portas" value={form.portas} options={PORTAS_SELECT_OPTIONS} onChangeValue={setField('portas')} />

              <Input
                name="chassi" label="Chassi" placeholder="9BWZZZ377VT004251" value={form.chassi} onChangeValue={setField('chassi')}
                style={{ fontFamily: tokens.fontMono, fontSize: '0.8rem' }}
              />
              <Input
                name="renavam" label="Renavam" placeholder="01234567890" value={form.renavam} onChangeValue={setField('renavam')}
                style={{ fontFamily: tokens.fontMono, fontSize: '0.8rem' }}
              />

              <div style={{ gridColumn: 'span 2' }}>
                <Textarea
                  name="observacoes_veiculo"
                  label="Observações"
                  placeholder="Observações gerais sobre o veículo..."
                  value={form.observacoes}
                  onChangeValue={setField('observacoes')}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: fotos + proprietário ── */}
        {step === 2 && (
          <div className="dashboard-modal__body">
            {/* Foto principal */}
            <div>
              <label style={labelStyle}>Foto Principal</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label
                  style={{
                    width: 130, height: 96, borderRadius: 12, flexShrink: 0,
                    border: `1.5px dashed ${tokens.color.borderMd}`, background: tokens.color.bg,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', overflow: 'hidden', position: 'relative',
                  }}
                >
                  {fotoPrincipal ? (
                    <img src={fotoPrincipal} alt="Foto principal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <span style={{ color: tokens.color.muted, display: 'flex' }}>{VeiculoIcons.uploadCloud}</span>
                      <span style={{ fontSize: '0.62rem', color: tokens.color.subtle, marginTop: 6, fontFamily: tokens.fontMono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Adicionar foto
                      </span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFotoPrincipal} style={{ display: 'none' }} />
                </label>
                {fotoPrincipal && (
                  <button
                    onClick={() => setFotoPrincipal(undefined)}
                    style={{ border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.muted, borderRadius: 8, padding: '6px 12px', fontSize: '0.76rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>

            {/* Fotos adicionais */}
            <div>
              <label style={labelStyle}>Fotos Adicionais</label>
              <PhotoGrid
                photos={fotos}
                handlePhotos={handleFotosAdicionais}
                onRemove={removeFoto}
                onPreview={setPreview}
              />
            </div>

            {/* Proprietário (improvisado) */}
            <div style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Proprietário (opcional)</label>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, color: tokens.color.ferrari, background: tokens.color.ferrariMid,
                  padding: '2px 7px', borderRadius: 99, textTransform: 'none', letterSpacing: 0,
                }}>
                  🔜 vínculo com cliente cadastrado em breve
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <Input name="prop_nome" label="Nome do Proprietário" placeholder="Deixe em branco para salvar sem proprietário" value={form.proprietarioNome} onChangeValue={setField('proprietarioNome')} />
                </div>
                <Input name="prop_doc" type="cpf_cnpj" label="CPF/CNPJ" placeholder="000.000.000-00" value={form.proprietarioDoc} onChangeValue={setField('proprietarioDoc')} />
                <Input name="prop_tel" type="phone" label="Telefone" placeholder="(11) 99999-9999" value={form.proprietarioTelefone} onChangeValue={setField('proprietarioTelefone')} />
                <div style={{ gridColumn: 'span 2' }}>
                  <Input name="prop_email" type="email" label="E-mail" placeholder="email@exemplo.com" value={form.proprietarioEmail} onChangeValue={setField('proprietarioEmail')} />
                </div>
              </div>
            </div>
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
              style={{
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: tokens.color.ferrari, color: 'white', cursor: 'pointer',
                fontSize: '0.84rem', fontWeight: 700, boxShadow: tokens.shadow.ferrari,
              }}
            >
              {isEdit ? 'Salvar Alterações' : 'Cadastrar Veículo'}
            </button>
          )}
        </div>
      </div>
    </div>

    <Lightbox src={preview} onClose={() => setPreview(null)} />
    </>
  );
}
