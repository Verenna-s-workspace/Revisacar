import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { Input } from '../../../../components/inputs/input';
import { Textarea } from '../../../../components/inputs/textarea';
import { Select } from '../../../../components/inputs/select';
import { COMBUSTIVEL_OPTIONS, NIVEL_COMBUSTIVEL_OPTIONS, tokens } from '../../../../constants';
import {
  FormBlock, Field, PanelFooter, PhotoGrid,
  ValidationBanner, grid3, grid4, btnGhost, btnAccent, pfNote,
} from '../../../../components/ui';

interface StepProps {
  os: ReturnType<typeof useOrdemServico>;
  onExportPDF?: () => void;
}

function StepWrapper({ children, direction = 'forward' }: {
  children: React.ReactNode;
  direction?: 'forward' | 'back';
}) {
  return (
    <div
      className={direction === 'forward' ? 'step-enter' : 'step-enter-left'}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </div>
  );
}

export function Step1({ os }: StepProps) {
  const {
    osHeader, setOsHeader,
    cliente, setCliente,
    veiculo, setVeiculo,
    photos, handlePhotos, removePhoto,
    setLightbox,
    savedAt, showErrors, errors,
    saveOrder, handleNextStep1,
    stepDir,
  } = os;

  const hasErr = (k: string) => showErrors && !!errors[k];

  function formatDoc(value: string) {
    const raw = value.replace(/\D/g, '');
    if (raw.length <= 11) {
      return raw
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return raw
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function validatePlaca(placa: string) {
    if (!placa || placa.trim() === '') return undefined;
    if (/^[A-Za-z]{3}\d[A-Za-z]\d{2}$/.test(placa)) return undefined;
    if (/^[A-Za-z]{3}-?\d{4}$/.test(placa)) return undefined;
    return 'Placa inválida';
  }

  return (
    <StepWrapper direction={stepDir}>
      <ValidationBanner show={showErrors && Object.keys(errors).length > 0}>
        Preencha os campos obrigatórios antes de continuar.
      </ValidationBanner>

      <FormBlock title="Ordem de Serviço">
        <div style={grid4}>
          <Field label="Nº da OS *">
            <Input
              name="os_num" onlyNumbers placeholder="000001"
              value={osHeader.os_num}
              error={hasErr('os_num') ? 'Campo obrigatório' : undefined}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_num: v }))}
            />
          </Field>
          <Field label="Data de entrada *">
            <Input
              name="os_date" type="date" value={osHeader.os_date}
              error={hasErr('os_date') ? 'Campo obrigatório' : undefined}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_date: v }))}
            />
          </Field>
          <Field label="Hora de entrada *">
            <Input
              name="os_time" type="time" value={osHeader.os_time}
              error={hasErr('os_time') ? 'Campo obrigatório' : undefined}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_time: v }))}
            />
          </Field>
          <Field label="Km atual" hint="ex: 87.450">
            <Input
              name="os_km" onlyNumbers placeholder="87.450"
              value={osHeader.os_km}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_km: v }))}
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Dados do Cliente">
        <div style={grid3}>
          <Field label="Nome completo *" span={2}>
            <Input
              name="cliente_nome" placeholder="Ex: João da Silva" onlyText
              value={cliente.nome}
              error={hasErr('cli_nome') ? 'Campo obrigatório' : undefined}
              onChangeValue={(v) => setCliente((p) => ({ ...p, nome: v }))}
            />
          </Field>
          <Field label="CPF / CNPJ">
            <Input
              name="cliente_doc" placeholder="000.000.000-00"
              value={formatDoc(cliente.doc)} maxLength={18}
              onChangeValue={(v) => setCliente((p) => ({ ...p, doc: v.replace(/\D/g, '') }))}
            />
          </Field>
          <Field label="Telefone *">
            <Input
              name="cliente_tel" placeholder="(00) 00000-0000" mask="(99) 99999-9999"
              value={cliente.tel}
              error={hasErr('cli_tel') ? 'Campo obrigatório' : undefined}
              onChangeValue={(v) => setCliente((p) => ({ ...p, tel: v }))}
            />
          </Field>
          <Field label="E-mail" span={2}>
            <Input
              name="cliente_email" placeholder="cliente@email.com"
              value={cliente.email}
              onChangeValue={(v) => setCliente((p) => ({ ...p, email: v }))}
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Dados do Veículo">
        <div style={grid4}>
          <Field label="Placa *">
            <Input
              name="veiculo_placa" placeholder="ABC1C34 / ABC-1234"
              value={veiculo.placa} maxLength={8} uppercase
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, placa: v }))}
              error={validatePlaca(veiculo.placa)}
            />
          </Field>
          <Field label="Modelo *" span={2}>
            <Input
              name="veiculo_modelo" placeholder="ex: Toyota Corolla"
              value={veiculo.modelo}
              error={hasErr('vei_modelo') ? 'Campo obrigatório' : undefined}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, modelo: v }))}
            />
          </Field>
          <Field label="Ano">
            <Input
              name="veiculo_ano" placeholder="2014" value={veiculo.ano} maxLength={4}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, ano: v }))}
            />
          </Field>
          <Field label="Cor">
            <Input
              name="veiculo_cor" placeholder="Prata" value={veiculo.cor}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, cor: v }))}
            />
          </Field>
          <Field label="Combustível">
            <Select
              name="combustivel" value={veiculo.combustivel}
              options={COMBUSTIVEL_OPTIONS} placeholder="Selecione..."
              error={errors.combustivel}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, combustivel: v }))}
            />
          </Field>
          <Field label="Nível combustível">
            <Select
              name="nivel_combustivel" value={veiculo.nivel_combustivel}
              options={NIVEL_COMBUSTIVEL_OPTIONS} placeholder="Selecione..."
              error={errors.nivel_combustivel}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, nivel_combustivel: v }))}
            />
          </Field>
          <Field label="Chassi" span={2} hint="17 caracteres">
            <Input
              name="veiculo_chassi" placeholder="ex: 9BWZZZ377VT004251"
              value={veiculo.chassi} uppercase maxLength={17}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, chassi: v }))}
            />
          </Field>
          <Field label="Observações de entrada" span={4}>
            <Textarea
              name="veiculo_obs_entrada" value={veiculo.obs_entrada}
              placeholder="Riscos, amassados, itens faltantes..."
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, obs_entrada: v }))}
            />
          </Field>
          <Field label="Relato do cliente" span={4}>
            <Textarea
              name="veiculo_obs_cliente" value={veiculo.obs_cliente}
              placeholder="Descreva o que o cliente relatou sobre o problema do veículo..."
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, obs_cliente: v }))}
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Fotos de Entrada">
        <PhotoGrid
          photos={photos}
          handlePhotos={handlePhotos}
          onRemove={removePhoto}
          onPreview={(src) => setLightbox(src)}
        />
      </FormBlock>

      <PanelFooter
        left={
          <span style={pfNote}>
            {savedAt ? `Salvo às ${savedAt}` : 'Rascunho não salvo'}
          </span>
        }
        right={
          <>
            <button onClick={saveOrder} style={btnGhost}>
              Salvar rascunho
            </button>
            <button onClick={handleNextStep1} style={btnAccent}>
              Próximo
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />
    </StepWrapper>
  );
}