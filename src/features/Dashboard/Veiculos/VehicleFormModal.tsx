import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { tokens, COMBUSTIVEL_OPTIONS } from '../../../constants';
import { PhotoGrid, Lightbox } from '../../../components/ui';
import { CATEGORIA_OPTIONS, CAMBIO_OPTIONS, PORTAS_OPTIONS } from '../../../utils/veiculos_utils';
import { comprimirImagem } from '../../../utils/estoque_utils';
import { VeiculoIcons } from './icons';
import { Icons } from '../Icons';
import { OwnerPicker, mesmoProprietario } from './OwnerPicker';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import {
  Button, Modal, ModalBody, ModalColumns, ModalFields, ModalFooter, ModalFotoCampo, ModalHeader,
  ModalNotice, ModalSection,
} from '../../../components/system';
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
  const [form, setForm] = useState<FormState>(() => buildInitialState(veiculo));
  const [fotoPrincipal, setFotoPrincipal] = useState<string | undefined>(veiculo?.fotoPrincipal);
  const [fotos, setFotos] = useState<Photo[]>(() => (veiculo?.fotosAdicionais ?? []).map(src => ({ src, name: 'foto' })));
  const [preview, setPreview] = useState<string | null>(null);
  const [proprietario, setProprietario] = useState<VeiculoProprietario | null>(veiculo?.proprietario ?? null);
  const [comprimindo, setComprimindo] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: v as FormState[K] }));

  const handleFotoPrincipal = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setErroFoto(null);
    setComprimindo(true);
    try {
      setFotoPrincipal(await comprimirImagem(file, LARGURA_FOTO_PRINCIPAL, QUALIDADE_FOTO));
    } catch {
      setErroFoto('Não foi possível processar essa imagem. Ela pode estar corrompida ou em formato não aceito (use JPEG, PNG ou WebP). Tente outra foto.');
    } finally {
      setComprimindo(false);
    }
  };

  const handleFotosAdicionais = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (arquivos.length === 0) return;
    setErroFoto(null);
    const vagas = MAX_FOTOS_ADICIONAIS - fotos.length;
    if (arquivos.length > vagas) {
      setErroFoto(`Limite de ${MAX_FOTOS_ADICIONAIS} fotos adicionais por veículo atingido. Remova uma foto para adicionar outra.`);
    }
    setComprimindo(true);
    try {
      const novas: Photo[] = [];
      for (const file of arquivos.slice(0, Math.max(vagas, 0))) {
        novas.push({ src: await comprimirImagem(file, LARGURA_FOTO_ADICIONAL, QUALIDADE_FOTO), name: file.name });
      }
      setFotos(prev => [...prev, ...novas].slice(0, MAX_FOTOS_ADICIONAIS));
    } catch {
      setErroFoto('Não foi possível processar uma das imagens. Ela pode estar corrompida ou em formato não aceito (use JPEG, PNG ou WebP). Tente outra foto.');
    } finally {
      setComprimindo(false);
    }
  };

  const removeFoto = (i: number) => { setErroFoto(null); setFotos(prev => prev.filter((_, idx) => idx !== i)); };

  const camposObrigatoriosOk = !!(form.placa.trim() && form.marca.trim() && form.modelo.trim() && form.ano.trim());

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!camposObrigatoriosOk || comprimindo) return;
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

  // Esc com a foto ampliada aberta fecha só a foto (o Lightbox é um overlay à parte, fora da pilha de modais).
  const fechar = () => { if (preview) setPreview(null); else onClose(); };

  return (
    <>
      <Modal size="xl" onClose={fechar} onSubmit={handleSubmit}>
        <ModalHeader
          icon={Icons.car}
          title={isEdit ? 'Editar Veículo' : 'Cadastrar Veículo'}
          description={isEdit ? 'Atualize os dados do veículo.' : 'Cadastre um novo veículo na oficina.'}
        />

        <ModalBody>
          <ModalColumns
            aside={
              <>
                <ModalSection icon={Icons.camera} title="Foto principal">
                  <ModalFotoCampo
                    foto={fotoPrincipal}
                    alt="Foto principal do veículo"
                    vazio={VeiculoIcons.uploadCloud}
                    comprimindo={comprimindo}
                    onSelecionar={handleFotoPrincipal}
                    onRemover={() => setFotoPrincipal(undefined)}
                  />
                </ModalSection>

                <ModalSection
                  icon={Icons.camera}
                  title="Fotos adicionais"
                  aside={<span style={{ fontSize: 13, color: tokens.color.muted }}>{fotos.length}/{MAX_FOTOS_ADICIONAIS}</span>}
                >
                  <PhotoGrid photos={fotos} handlePhotos={handleFotosAdicionais} onRemove={removeFoto} onPreview={setPreview} />
                  {erroFoto && <ModalNotice tone="error" role="alert">{erroFoto}</ModalNotice>}
                </ModalSection>
              </>
            }
          >
            <ModalSection icon={Icons.car} title="Identificação">
              <ModalFields>
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
              </ModalFields>
            </ModalSection>

            <ModalSection icon={Icons.wrench} title="Características">
              <ModalFields>
                <Input name="quilometragem" type="number" label="Quilometragem" placeholder="32000" value={form.quilometragem} onChangeValue={setField('quilometragem')} />
                <Select name="combustivel" label="Combustível" value={form.combustivel} options={COMBUSTIVEL_OPTIONS} onChangeValue={setField('combustivel')} />
                <Select name="cambio" label="Câmbio" value={form.cambio} options={CAMBIO_OPTIONS} onChangeValue={setField('cambio')} />
                <Select name="portas" label="Número de Portas" value={form.portas} options={PORTAS_SELECT_OPTIONS} onChangeValue={setField('portas')} />
                <Input
                  name="chassi" label="Chassi" placeholder="9BWZZZ377VT004251" value={form.chassi} onChangeValue={setField('chassi')}
                  style={{ fontFamily: tokens.fontMono }}
                />
                <Input
                  name="renavam" label="Renavam" placeholder="01234567890" value={form.renavam} onChangeValue={setField('renavam')}
                  style={{ fontFamily: tokens.fontMono }}
                />
              </ModalFields>
            </ModalSection>

            <ModalSection
              icon={Icons.user}
              title="Proprietário"
              description="Opcional. Sem proprietário, o veículo fica cadastrado só na oficina e pode ser vinculado a um cliente depois."
            >
              <OwnerPicker name="prop" clientes={clientes} value={proprietario} onChange={setProprietario} />
            </ModalSection>

            <ModalSection title="Observações">
              <Textarea
                name="observacoes_veiculo"
                label="Observações gerais"
                placeholder="Observações gerais sobre o veículo..."
                value={form.observacoes}
                onChangeValue={setField('observacoes')}
                rows={3}
              />
            </ModalSection>
          </ModalColumns>
        </ModalBody>

        <ModalFooter hint="* Campos obrigatórios">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={comprimindo}>
            {isEdit ? 'Salvar Alterações' : 'Cadastrar Veículo'}
          </Button>
        </ModalFooter>
      </Modal>

      <Lightbox src={preview} onClose={() => setPreview(null)} />
    </>
  );
}
