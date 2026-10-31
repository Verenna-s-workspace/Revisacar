import { useState } from 'react';
import { tokens } from '../../../constants';
import { COMBUSTIVEL_OPTIONS } from '../../../constants';
import { PhotoGrid, Lightbox } from '../../../components/ui';
import { CATEGORIA_OPTIONS, CAMBIO_OPTIONS, PORTAS_OPTIONS } from '../../../utils/veiculos_utils';
import { comprimirImagem } from '../../../utils/estoque_utils';
import { VeiculoIcons } from './icons';
import { OwnerPicker, mesmoProprietario } from './OwnerPicker';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import { MAX_FOTOS_ADICIONAIS } from '../../../types/veiculo';
import type { Cliente } from '../../../types/cliente';
import type {
  NovoVeiculoInput, VeiculoCadastrado, VeiculoCategoria, VeiculoCambio, VeiculoProprietario,
} from '../../../types/veiculo';

interface Photo { src: string; name: string; }

interface VehicleFormModalProps {
  /** Quando presente, o modal funciona em modo edição. */
  veiculo?: VeiculoCadastrado;
  /** Clientes da carteira — para vincular o veículo a um cliente já cadastrado. */
  clientes?: Cliente[];
  onSave: (input: NovoVeiculoInput) => void;
  onClose: () => void;
}

interface FormState {
  placa: string; marca: string; modelo: string; ano: string; cor: string; quilometragem: string;
  categoria: VeiculoCategoria; combustivel: string; cambio: VeiculoCambio; portas: string;
  chassi: string; renavam: string; observacoes: string;
}

// As fotos seguem o mesmo caminho das do estoque (comprimir no navegador → data URL → banco), com mais
// resolução que o estoque (480px), porque o veículo aparece grande no card e no topo dos detalhes.
const LARGURA_FOTO_PRINCIPAL = 800;
const LARGURA_FOTO_ADICIONAL = 640;
const QUALIDADE_FOTO = 0.72;

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
  };
}

const PORTAS_SELECT_OPTIONS = PORTAS_OPTIONS.map(p => ({ value: String(p), label: `${p} portas` }));

export function VehicleFormModal({ veiculo, clientes = [], onSave, onClose }: VehicleFormModalProps) {
  const isEdit = !!veiculo;
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(() => buildInitialState(veiculo));
  const [fotoPrincipal, setFotoPrincipal] = useState<string | undefined>(veiculo?.fotoPrincipal);
  const [fotos, setFotos] = useState<Photo[]>(() => (veiculo?.fotosAdicionais ?? []).map(src => ({ src, name: 'foto' })));
  const [preview, setPreview] = useState<string | null>(null);
  const [proprietario, setProprietario] = useState<VeiculoProprietario | null>(veiculo?.proprietario ?? null);
  const [comprimindo, setComprimindo] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: v as FormState[K] }));

  const handleFotoPrincipal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setErroFoto(null);
    setComprimindo(true);
    try {
      setFotoPrincipal(await comprimirImagem(file, LARGURA_FOTO_PRINCIPAL, QUALIDADE_FOTO));
    } catch {
      setErroFoto('Não foi possível processar essa imagem. Tente outra foto.');
    } finally {
      setComprimindo(false);
    }
  };

  const handleFotosAdicionais = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (arquivos.length === 0) return;
    setErroFoto(null);
    const vagas = MAX_FOTOS_ADICIONAIS - fotos.length;
    if (arquivos.length > vagas) {
      setErroFoto(`No máximo ${MAX_FOTOS_ADICIONAIS} fotos adicionais por veículo.`);
    }
    setComprimindo(true);
    try {
      const novas: Photo[] = [];
      for (const file of arquivos.slice(0, Math.max(vagas, 0))) {
        novas.push({ src: await comprimirImagem(file, LARGURA_FOTO_ADICIONAL, QUALIDADE_FOTO), name: file.name });
      }
      setFotos(prev => [...prev, ...novas].slice(0, MAX_FOTOS_ADICIONAIS));
    } catch {
      setErroFoto('Não foi possível processar uma das imagens. Tente outra foto.');
    } finally {
      setComprimindo(false);
    }
  };

  const removeFoto = (i: number) => { setErroFoto(null); setFotos(prev => prev.filter((_, idx) => idx !== i)); };

  const step1Valid = form.placa.trim() && form.marca.trim() && form.modelo.trim() && form.ano.trim();

  const handleSubmit = () => {
    if (!step1Valid || comprimindo) return;
    const dono: VeiculoProprietario | null = proprietario && proprietario.nome.trim()
      ? {
          clienteId: proprietario.clienteId,
          nome: proprietario.nome.trim(),
          docCpfCnpj: proprietario.docCpfCnpj?.trim() || undefined,
          telefone: proprietario.telefone?.trim() || undefined,
          email: proprietario.email?.trim() || undefined,
        }
      : null;
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
      // Editando: `null` avisa o servidor que a foto foi removida (chave ausente = não mexe).
      fotoPrincipal: fotoPrincipal ?? (isEdit ? null : undefined),
      fotosAdicionais: fotos.map(f => f.src),
      proprietario: dono,
      status: veiculo?.status,
    };
    // Dono inalterado na edição: nem manda o campo. Reenviar o mesmo cliente a cada salvamento só serviria
    // para falhar se ele tiver sido arquivado da carteira depois (o servidor exige cliente ativo).
    if (isEdit && mesmoProprietario(dono, veiculo?.proprietario)) delete input.proprietario;
    onSave(input);
    onClose();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
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
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: step >= n ? tokens.color.ferrari : tokens.color.muted }}>
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
            <div className="dashboard-form-grid-2col" style={{ gap: '14px 20px' }}>
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
                      <span style={{ fontSize: '0.75rem', color: tokens.color.subtle, marginTop: 6, fontFamily: tokens.fontMono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Adicionar foto
                      </span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFotoPrincipal} disabled={comprimindo} style={{ display: 'none' }} />
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
              <label style={labelStyle}>
                Fotos Adicionais <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>({fotos.length}/{MAX_FOTOS_ADICIONAIS})</span>
              </label>
              <PhotoGrid
                photos={fotos}
                handlePhotos={handleFotosAdicionais}
                onRemove={removeFoto}
                onPreview={setPreview}
              />
              {comprimindo && (
                <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 8 }}>Processando a imagem...</div>
              )}
              {erroFoto && (
                <div style={{ fontSize: '0.75rem', color: tokens.color.crit, marginTop: 8 }}>{erroFoto}</div>
              )}
            </div>

            {/* Proprietário = cliente vinculado ao veículo */}
            <div style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: 18 }}>
              <label style={{ ...labelStyle, marginBottom: 10 }}>Proprietário (opcional)</label>
              <OwnerPicker name="prop" clientes={clientes} value={proprietario} onChange={setProprietario} />
              {!proprietario?.nome.trim() && (
                <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 10 }}>
                  Sem proprietário, o veículo fica cadastrado só na oficina e pode ser vinculado a um cliente depois.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'var(--color-surface)', borderRadius: '0 0 20px 20px' }}>
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
              disabled={comprimindo}
              style={{
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: tokens.color.ferrari, color: 'white', cursor: comprimindo ? 'wait' : 'pointer',
                opacity: comprimindo ? 0.6 : 1,
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
