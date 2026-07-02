import { useState } from 'react';
import { tokens } from '../../../constants';
import { COMBUSTIVEL_OPTIONS } from '../../../constants';
import { PhotoGrid, Lightbox } from '../../../components/ui';
import { CATEGORIA_OPTIONS, CAMBIO_OPTIONS, PORTAS_OPTIONS } from '../../../utils/veiculos_utils';
import { VeiculoIcons } from './icons';
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

export function VehicleFormModal({ veiculo, onSave, onClose }: VehicleFormModalProps) {
  const isEdit = !!veiculo;
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(() => buildInitialState(veiculo));
  const [fotoPrincipal, setFotoPrincipal] = useState<string | undefined>(veiculo?.fotoPrincipal);
  const [fotos, setFotos] = useState<Photo[]>(() => (veiculo?.fotosAdicionais ?? []).map(src => ({ src, name: 'foto' })));
  const [preview, setPreview] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value as FormState[K] }));

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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    border: `1px solid ${tokens.color.border}`, background: 'white',
    fontSize: '0.875rem', color: tokens.color.text, outline: 'none',
    fontFamily: tokens.fontSans, boxSizing: 'border-box',
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
              <div>
                <label style={labelStyle}>Placa *</label>
                <input
                  style={{ ...inputStyle, fontFamily: tokens.fontMono, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  placeholder="ABC1D23"
                  maxLength={8}
                  value={form.placa}
                  onChange={setField('placa')}
                />
              </div>
              <div>
                <label style={labelStyle}>Categoria *</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.categoria} onChange={setField('categoria')}>
                  {CATEGORIA_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Marca *</label>
                <input style={inputStyle} placeholder="Toyota" value={form.marca} onChange={setField('marca')} />
              </div>
              <div>
                <label style={labelStyle}>Modelo *</label>
                <input style={inputStyle} placeholder="Corolla Altis" value={form.modelo} onChange={setField('modelo')} />
              </div>

              <div>
                <label style={labelStyle}>Ano *</label>
                <input style={inputStyle} type="number" placeholder="2022" value={form.ano} onChange={setField('ano')} />
              </div>
              <div>
                <label style={labelStyle}>Cor</label>
                <input style={inputStyle} placeholder="Prata" value={form.cor} onChange={setField('cor')} />
              </div>

              <div>
                <label style={labelStyle}>Quilometragem</label>
                <input style={inputStyle} type="number" placeholder="32000" value={form.quilometragem} onChange={setField('quilometragem')} />
              </div>
              <div>
                <label style={labelStyle}>Combustível</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.combustivel} onChange={setField('combustivel')}>
                  {COMBUSTIVEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Câmbio</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.cambio} onChange={setField('cambio')}>
                  {CAMBIO_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Número de Portas</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.portas} onChange={setField('portas')}>
                  {PORTAS_OPTIONS.map(p => <option key={p} value={p}>{p} portas</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Chassi</label>
                <input style={{ ...inputStyle, fontFamily: tokens.fontMono, fontSize: '0.8rem' }} placeholder="9BWZZZ377VT004251" value={form.chassi} onChange={setField('chassi')} />
              </div>
              <div>
                <label style={labelStyle}>Renavam</label>
                <input style={{ ...inputStyle, fontFamily: tokens.fontMono, fontSize: '0.8rem' }} placeholder="01234567890" value={form.renavam} onChange={setField('renavam')} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Observações</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }}
                  placeholder="Observações gerais sobre o veículo..."
                  value={form.observacoes}
                  onChange={setField('observacoes')}
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
                  <label style={labelStyle}>Nome do Proprietário</label>
                  <input style={inputStyle} placeholder="Deixe em branco para salvar sem proprietário" value={form.proprietarioNome} onChange={setField('proprietarioNome')} />
                </div>
                <div>
                  <label style={labelStyle}>CPF/CNPJ</label>
                  <input style={inputStyle} placeholder="000.000.000-00" value={form.proprietarioDoc} onChange={setField('proprietarioDoc')} />
                </div>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <input style={inputStyle} placeholder="(11) 99999-9999" value={form.proprietarioTelefone} onChange={setField('proprietarioTelefone')} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>E-mail</label>
                  <input style={inputStyle} placeholder="email@exemplo.com" value={form.proprietarioEmail} onChange={setField('proprietarioEmail')} />
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
