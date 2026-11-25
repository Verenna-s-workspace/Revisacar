import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { COMBUSTIVEL_OPTIONS } from '../../../constants';
import { CATEGORIA_OPTIONS } from '../../../utils/veiculos_utils';
import { comprimirImagem } from '../../../utils/estoque_utils';
import { ClienteIcons } from './icons';
import { Icons } from '../Icons';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import {
  Button, Modal, ModalBody, ModalColumns, ModalFields, ModalFooter, ModalFotoCampo, ModalHeader,
  ModalNotice, ModalSection, ModalSubsection,
} from '../../../components/system';
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
  const [form, setForm] = useState<FormState>(() => buildInitialState(cliente));
  const [fotoPrincipal, setFotoPrincipal] = useState<string | undefined>(cliente?.fotoPrincipal);
  const [comprimindo, setComprimindo] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [veiculosNovos, setVeiculosNovos] = useState<NovoVeiculoClienteInput[]>([]);
  const [tentou, setTentou] = useState(false);

  const setField = <K extends keyof FormState>(key: K) => (v: string) =>
    setForm(prev => ({ ...prev, [key]: v }));

  // Mesmo caminho da foto dos itens do estoque: comprime no navegador (480px, JPEG) e envia como data URL.
  // Sem isto o arquivo cru (3–6 MB) estourava o limite do servidor e a foto não ficava salva.
  const handleFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setErroFoto(null);
    setComprimindo(true);
    try {
      setFotoPrincipal(await comprimirImagem(file));
    } catch {
      setErroFoto('Não foi possível processar essa imagem. Ela pode estar corrompida ou em formato não aceito (use JPEG, PNG ou WebP). Tente outra foto.');
    } finally {
      setComprimindo(false);
    }
  };

  const updateVeiculo = (idx: number, patch: Partial<NovoVeiculoClienteInput>) =>
    setVeiculosNovos(prev => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  const removeVeiculo = (idx: number) => setVeiculosNovos(prev => prev.filter((_, i) => i !== idx));
  const addVeiculo = () => setVeiculosNovos(prev => [...prev, buildEmptyVeiculo()]);

  const nomeValido = form.nome.trim() !== '';
  const veiculosValid = veiculosNovos.every(v => v.marca.trim() && v.modelo.trim() && v.placa.trim());

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nomeValido || comprimindo) return;
    if (!veiculosValid) { setTentou(true); return; }
    const input: NovoClienteInput = {
      nome: form.nome.trim(),
      cpfCnpj: form.cpfCnpj.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      email: form.email.trim() || undefined,
      endereco: form.endereco.trim() || undefined,
      observacoes: form.observacoes.trim() || undefined,
      // Editando: `null` avisa o servidor que a foto foi removida (chave ausente = não mexe).
      fotoPrincipal: fotoPrincipal ?? (isEdit ? null : undefined),
    };
    onSave(input, veiculosNovos);
    onClose();
  };

  return (
    <Modal size="xl" onClose={onClose} onSubmit={handleSubmit}>
      <ModalHeader
        icon={Icons.user}
        title={isEdit ? 'Editar Cliente' : 'Cadastrar Cliente'}
        description={isEdit ? 'Atualize os dados do cliente.' : 'Cadastre um novo cliente da oficina.'}
      />

      <ModalBody>
        <ModalColumns
          aside={
            <ModalSection icon={Icons.camera} title="Foto do cliente">
              <ModalFotoCampo
                forma="avatar"
                foto={fotoPrincipal}
                alt="Foto do cliente"
                vazio={ClienteIcons.uploadCloud}
                comprimindo={comprimindo}
                erro={erroFoto}
                hint="Opcional. Sem foto, o card exibe as iniciais do nome."
                onSelecionar={handleFoto}
                onRemover={() => setFotoPrincipal(undefined)}
              />
            </ModalSection>
          }
        >
          <ModalSection icon={Icons.user} title="Dados do cliente">
            <Input name="cli_nome" label="Nome Completo" required placeholder="Nome do cliente" value={form.nome} onChangeValue={setField('nome')} />
            <ModalFields>
              <Input name="cli_doc" type="cpf_cnpj" label="CPF/CNPJ" placeholder="000.000.000-00" value={form.cpfCnpj} onChangeValue={setField('cpfCnpj')} />
              <Input name="cli_tel" type="phone" label="Telefone" placeholder="(11) 99999-9999" value={form.telefone} onChangeValue={setField('telefone')} />
            </ModalFields>
            <Input name="cli_email" type="email" label="E-mail" placeholder="email@exemplo.com" value={form.email} onChangeValue={setField('email')} />
            <Input name="cli_endereco" label="Endereço" placeholder="Rua, número, bairro — cidade/UF" value={form.endereco} onChangeValue={setField('endereco')} />
          </ModalSection>

          <ModalSection title="Observações">
            <Textarea
              name="cli_obs"
              label="Observações gerais"
              placeholder="Observações gerais sobre o cliente..."
              value={form.observacoes}
              onChangeValue={setField('observacoes')}
              rows={3}
            />
          </ModalSection>

          <ModalSection
            icon={Icons.car}
            title="Veículos"
            description={isEdit
              ? 'Vincule novos veículos a este cliente. Os já cadastrados são vistos e editados na tela de Veículos ou no perfil do cliente.'
              : 'Opcional. Os veículos adicionados aqui aparecem na tela de Veículos, já vinculados a este cliente.'}
          >
            {veiculosNovos.map((v, idx) => (
              <ModalSubsection key={idx} title={`Veículo ${idx + 1}`} removeLabel="Remover" onRemove={() => removeVeiculo(idx)}>
                <ModalFields>
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
                  <Select
                    name={`v_combustivel_${idx}`}
                    label="Combustível"
                    value={v.combustivel}
                    options={COMBUSTIVEL_OPTIONS}
                    onChangeValue={val => updateVeiculo(idx, { combustivel: val })}
                  />
                </ModalFields>
                <Input name={`v_obs_${idx}`} label="Observações" placeholder="Observações sobre o veículo..." value={v.observacoes} onChangeValue={val => updateVeiculo(idx, { observacoes: val })} />
              </ModalSubsection>
            ))}
            <Button variant="secondary" icon={Icons.plus} onClick={addVeiculo}>Adicionar veículo</Button>
          </ModalSection>
        </ModalColumns>
      </ModalBody>

      <ModalFooter
        hint="* Campos obrigatórios"
        notice={tentou && !veiculosValid
          ? <ModalNotice tone="error" role="alert">Preencha marca, modelo e placa de cada veículo (ou remova-o).</ModalNotice>
          : undefined}
      >
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={comprimindo}>
          {isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
