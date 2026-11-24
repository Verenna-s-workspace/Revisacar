import { useMemo, useState } from 'react';
import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { useCadastrosExistentes } from '../../../../hooks/useCadastrosExistentes';
import { usePermissions } from '../../../../hooks/usePermissions';
import { Input } from '../../../../components/inputs/input';
import { Textarea } from '../../../../components/inputs/textarea';
import { Select } from '../../../../components/inputs/select';
import { COMBUSTIVEL_OPTIONS, NIVEL_COMBUSTIVEL_OPTIONS, tokens } from '../../../../constants';
import {
  FILTRO, formatChassi, formatNome, formatPlaca, isValidPlaca, limparTexto, onlyDigits,
} from '../../../../components/inputs/masks';
import {
  MOTIVOS_FORTES, buscarClientes, buscarVeiculoPorPlaca, normalizarNome, normalizarTelefone, veiculosDoCliente,
} from '../../../../utils/cadastro_existente';
import { PainelClienteExistente, PainelVeiculoExistente } from './CadastroExistente';
import type { Cliente as ClienteCarteira } from '../../../../types/cliente';
import type { VeiculoCadastrado } from '../../../../types/veiculo';
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

  // ── Cadastros que já existem ────────────────────────────────────────────────
  // A tela sugere o que já está cadastrado; quem confirma é a pessoa (toque) e quem garante contra
  // duplicata ao salvar é o servidor. Sem a lista (sem rede/permissão) nada disto aparece.
  const { clientes, veiculos, carregado } = useCadastrosExistentes();
  const { can } = usePermissions();
  const podeCadastrar = can('clientes.editar');
  const [ignorados, setIgnorados] = useState<ReadonlySet<string>>(new Set());

  const clienteEscolhido = cliente.id ? clientes.find((c) => c.id === cliente.id) : undefined;
  const veiculoEscolhido = veiculo.id ? veiculos.find((v) => v.id === veiculo.id) : undefined;

  const candidatos = useMemo(
    () => (clienteEscolhido
      ? []
      : buscarClientes(clientes, veiculos, { nome: cliente.nome, doc: cliente.doc, tel: cliente.tel, email: cliente.email })
        .filter((c) => !ignorados.has(c.cliente.id) || c.motivos.some((m) => MOTIVOS_FORTES.has(m)))),
    [clientes, veiculos, clienteEscolhido, cliente.nome, cliente.doc, cliente.tel, cliente.email, ignorados],
  );
  const clienteNovo = carregado && podeCadastrar && !cliente.id
    && cliente.nome.trim().length >= 3 && normalizarTelefone(cliente.tel) !== '';

  const veiculoEncontrado = veiculo.id ? undefined : buscarVeiculoPorPlaca(veiculos, veiculo.placa);
  const donoDoEncontrado = veiculoEncontrado?.proprietario;
  const clienteDiferenteDoDono = !!donoDoEncontrado && cliente.nome.trim() !== ''
    && cliente.id !== donoDoEncontrado.clienteId
    && normalizarNome(cliente.nome) !== normalizarNome(donoDoEncontrado.nome)
    && (normalizarTelefone(cliente.tel) === '' || normalizarTelefone(cliente.tel) !== normalizarTelefone(donoDoEncontrado.telefone || ''));
  const veiculoNovo = carregado && podeCadastrar && !veiculo.id && isValidPlaca(veiculo.placa) && !veiculoEncontrado;

  // Preenche o bloco do cliente com o cadastro existente (mesmas regras de digitação dos campos).
  const usarCliente = (c: ClienteCarteira) => setCliente({
    id: c.id,
    nome: formatNome(c.nome, LIM.nome).trim(),
    doc: onlyDigits(c.cpfCnpj || '').slice(0, 14),
    tel: onlyDigits(c.telefone || '').slice(0, 11),
    email: limparTexto(c.email || '', FILTRO.espacos, LIM.email),
  });

  // Veículo existente: só completa o que está vazio (não apaga o que o mecânico digitou) e, se o bloco do
  // cliente está em branco, traz o dono — o caminho "placa primeiro".
  const usarVeiculo = (v: VeiculoCadastrado) => {
    setVeiculo((p) => ({
      ...p,
      id: v.id,
      placa: formatPlaca(v.placa),
      modelo: p.modelo.trim() ? p.modelo : limparTexto([v.marca, v.modelo].filter(Boolean).join(' '), FILTRO.modelo, LIM.modelo).trim(),
      ano: p.ano.trim() ? p.ano : onlyDigits(String(v.ano || '')).slice(0, 4),
      cor: p.cor.trim() ? p.cor : limparTexto(v.cor || '', FILTRO.cor, LIM.cor).trim(),
      combustivel: p.combustivel || (COMBUSTIVEL_OPTIONS.includes(v.combustivel) ? v.combustivel : ''),
      chassi: p.chassi || formatChassi(v.chassi || ''),
    }));
    const donoId = v.proprietario?.clienteId;
    const dono = donoId ? clientes.find((c) => c.id === donoId) : undefined;
    if (dono && !cliente.id && !cliente.nome.trim()) usarCliente(dono);
  };

  // Editar o NOME para outra pessoa solta o vínculo com o cadastro escolhido (não deixa a OS ligada a quem
  // não é); telefone, e-mail e CPF podem ser atualizados sem soltar. Idem a placa para o veículo.
  const editarNome = (v: string) => setCliente((p) => {
    const sel = p.id ? clientes.find((c) => c.id === p.id) : undefined;
    const outraPessoa = !!sel && normalizarNome(v) !== normalizarNome(sel.nome);
    return { ...p, nome: v, ...(outraPessoa ? { id: undefined } : {}) };
  });
  const editarPlaca = (v: string) => setVeiculo((p) => {
    const sel = p.id ? veiculos.find((x) => x.id === p.id) : undefined;
    const outraPlaca = !!sel && formatPlaca(v) !== formatPlaca(sel.placa);
    return { ...p, placa: v, ...(outraPlaca ? { id: undefined } : {}) };
  });

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
          <Field label="Km atual">
            <Input
              name="os_km" type="km" placeholder="ex.: 87.450"
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
              name="cliente_nome" type="nome" placeholder="ex.: João da Silva" maxLength={LIM.nome}
              value={cliente.nome} validate={validarNome}
              error={erro('cli_nome')}
              onChangeValue={editarNome}
            />
          </Field>
          <Field label="CPF / CNPJ">
            <Input
              name="cliente_doc" type="cpf_cnpj" placeholder="000.000.000-00"
              value={cliente.doc} validate={validarDoc} error={erro('cli_doc')}
              onChangeValue={(v) => setCliente((p) => ({ ...p, doc: v }))}
            />
          </Field>
          <PainelClienteExistente
            selecionado={clienteEscolhido}
            candidatos={candidatos}
            avisarNovo={clienteNovo}
            onUsar={usarCliente}
            onDesvincular={() => setCliente((p) => ({ ...p, id: undefined }))}
            onNenhum={() => setIgnorados((prev) => new Set([...prev, ...candidatos.map((c) => c.cliente.id)]))}
          />
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
              onChangeValue={editarPlaca}
            />
          </Field>
          <Field label="Modelo *" span={2}>
            <Input
              name="veiculo_modelo" placeholder="ex.: Toyota Corolla"
              maxLength={LIM.modelo} filter={FILTRO.modelo}
              value={veiculo.modelo}
              error={erro('vei_modelo')}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, modelo: v }))}
            />
          </Field>
          <Field label="Ano">
            <Input
              name="veiculo_ano" type="ano" placeholder="ex.: 2014" value={veiculo.ano}
              validate={validarAno} error={erro('vei_ano')}
              onChangeValue={(v) => setVeiculo((p) => ({ ...p, ano: v }))}
            />
          </Field>
          <PainelVeiculoExistente
            encontrado={veiculoEncontrado}
            selecionado={veiculoEscolhido}
            donoNome={(veiculoEncontrado ?? veiculoEscolhido)?.proprietario?.nome}
            clienteDiferenteDoDono={clienteDiferenteDoDono}
            clienteDigitado={cliente.nome.trim()}
            doCliente={clienteEscolhido ? veiculosDoCliente(veiculos, clienteEscolhido.id) : []}
            placaVazia={veiculo.placa.trim() === ''}
            avisarNovo={veiculoNovo}
            semAno={veiculo.ano.trim() === ''}
            onUsar={usarVeiculo}
            onUsarDono={(v) => {
              const dono = clientes.find((c) => c.id === v.proprietario?.clienteId);
              if (dono) usarCliente(dono);
            }}
            onDesvincular={() => setVeiculo((p) => ({ ...p, id: undefined }))}
          />
          <Field label="Cor">
            <Input
              name="veiculo_cor" placeholder="ex.: Prata" value={veiculo.cor}
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
              name="veiculo_chassi" type="chassi" placeholder="ex.: 9BWZZZ377VT004251"
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