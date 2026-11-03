import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { Input } from '../../../../components/inputs/input';
import { Textarea } from '../../../../components/inputs/textarea';
import { Select } from '../../../../components/inputs/select';
import { COMBUSTIVEL_OPTIONS, NIVEL_COMBUSTIVEL_OPTIONS, tokens } from '../../../../constants';
import { FILTRO } from '../../../../components/inputs/masks';
import {
  LIM, hojeISO, DATA_MIN,
  validarOsNum, validarData, validarKm, validarNome, validarDoc, validarTel,
  validarEmail, validarPlaca, validarAno, validarChassi,
} from '../../../../utils/campos_checklist';
import {
  FormBlock, Field, PanelFooter, PhotoGrid,
  ValidationBanner, useGrid3, useGrid4, btnGhost, btnAccent, pfNote,
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
  const g3 = useGrid3();
  const g4 = useGrid4();
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

  // Mensagem do campo: o erro da etapa (obrigatório ou formato) só aparece depois de tentar avançar;
  // o formato também é conferido ao sair de cada campo (`validate`).
  const erro = (k: string) => (hasErr(k) ? errors[k] : undefined);

  return (
    <StepWrapper direction={stepDir}>
      <ValidationBanner show={showErrors && Object.keys(errors).length > 0}>
        Preencha os campos obrigatórios antes de continuar.
      </ValidationBanner>

      <FormBlock title="Ordem de Serviço">
        <div style={g4}>
          <Field label="Nº da OS *">
            <Input
              name="os_num" type="digits" placeholder="000001" maxLength={LIM.osNum}
              value={osHeader.os_num} validate={validarOsNum}
              error={erro('os_num')}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_num: v }))}
            />
          </Field>
          <Field label="Data de entrada *">
            <Input
              name="os_date" type="date" value={osHeader.os_date}
              min={DATA_MIN} max={hojeISO()} validate={validarData}
              error={erro('os_date')}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_date: v }))}
            />
          </Field>
          <Field label="Hora de entrada *">
            <Input
              name="os_time" type="time" value={osHeader.os_time}
              error={erro('os_time')}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_time: v }))}
            />
          </Field>
          <Field label="Km atual" hint="ex: 87.450">
            <Input
              name="os_km" type="km" placeholder="87.450"
              value={osHeader.os_km} validate={validarKm} error={erro('os_km')}
              onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_km: v }))}
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Dados do Cliente">
        <div style={g3}>
          <Field label="Nome completo *" span={2}>
            <Input
              name="cliente_nome" type="nome" placeholder="Ex: João da Silva" maxLength={LIM.nome}
              value={cliente.nome} validate={validarNome}
              error={erro('cli_nome')}
              onChangeValue={(v) => setCliente((p) => ({ ...p, nome: v }))}
            />
          </Field>
          <Field label="CPF / CNPJ">
            <Input
              name="cliente_doc" type="cpf_cnpj" placeholder="000.000.000-00"
              value={cliente.doc} validate={validarDoc} error={erro('cli_doc')}
              onChangeValue={(v) => setCliente((p) => ({ ...p, doc: v }))}
            />
          </Field>
          <Field label="Telefone *">
            <Input
              name="cliente_tel" type="phone" placeholder="(00) 00000-0000"
              value={cliente.tel} validate={validarTel}
              error={erro('cli_tel')}
              onChangeValue={(v) => setCliente((p) => ({ ...p, tel: v }))}
            />
          </Field>
          <Field label="E-mail" span={2}>
            <Input
              name="cliente_email" type="email" placeholder="cliente@email.com"
              maxLength={LIM.email} filter={FILTRO.espacos}
              value={cliente.email} validate={validarEmail} error={erro('cli_email')}
              onChangeValue={(v) => setCliente((p) => ({ ...p, email: v }))}
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Dados do Veículo">
        <div style={g4}>
          <Field label="Placa *">
            <Input
              name="veiculo_placa" type="placa" placeholder="ABC1D23 / ABC1234"
              value={veiculo.placa} validate={validarPlaca} error={erro('vei_placa')}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, placa: v }))}
            />
          </Field>
          <Field label="Modelo *" span={2}>
            <Input
              name="veiculo_modelo" placeholder="ex: Toyota Corolla"
              maxLength={LIM.modelo} filter={FILTRO.modelo}
              value={veiculo.modelo}
              error={erro('vei_modelo')}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, modelo: v }))}
            />
          </Field>
          <Field label="Ano">
            <Input
              name="veiculo_ano" type="ano" placeholder="2014" value={veiculo.ano}
              validate={validarAno} error={erro('vei_ano')}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, ano: v }))}
            />
          </Field>
          <Field label="Cor">
            <Input
              name="veiculo_cor" placeholder="Prata" value={veiculo.cor}
              maxLength={LIM.cor} filter={FILTRO.cor}
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
              name="veiculo_chassi" type="chassi" placeholder="ex: 9BWZZZ377VT004251"
              value={veiculo.chassi} validate={validarChassi} error={erro('vei_chassi')}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, chassi: v }))}
            />
          </Field>
          <Field label="Observações de entrada" span={4}>
            <Textarea
              name="veiculo_obs_entrada" value={veiculo.obs_entrada} maxLength={LIM.obsLonga}
              placeholder="Riscos, amassados, itens faltantes..."
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, obs_entrada: v }))}
            />
          </Field>
          <Field label="Relato do cliente" span={4}>
            <Textarea
              name="veiculo_obs_cliente" value={veiculo.obs_cliente} maxLength={LIM.obsLonga}
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