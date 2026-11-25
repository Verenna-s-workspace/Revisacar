import { useMemo, useState } from 'react';
import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { useCadastrosExistentes } from '../../../hooks/useCadastrosExistentes';
import { usePermissions } from '../../../hooks/usePermissions';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Button } from '../../../components/system';
import { NIVEL_COMBUSTIVEL_OPTIONS } from '../../../constants';
import { FILTRO, formatPlaca, isValidPlaca, onlyDigits } from '../../../components/inputs/masks';
import { buscarClientes, buscarVeiculoPorPlaca, rotuloVeiculo, veiculosDoCliente } from '../../../utils/cadastro_existente';
import { clienteDeCadastro, veiculoDeCadastro } from '../../../utils/usar_cadastro';
import { clienteVeiculoCompleto } from '../../../utils/entrada_os';
import {
  DATA_MIN, LIM, validarAno, validarDoc, validarEmail, validarKm, validarNome, validarPlaca,
  validarPrevisaoData, validarPrevisaoHora, validarTel,
} from '../../../utils/campos_checklist';
import type { Cliente as ClienteCarteira } from '../../../types/cliente';
import type { VeiculoCadastrado } from '../../../types/veiculo';
import '../../../components/os/os-fase.css';

interface Props {
  os: ReturnType<typeof useOrdemServico>;
  identificado: boolean;
  onIdentificar: () => void;
  onTrocarVeiculo: () => void;
}

const obrigatorio = (v: string) => (v.trim() ? undefined : 'Campo obrigatório');
const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return (p.length >= 2 ? p[0][0] + p[1][0] : (p[0] ?? '?').slice(0, 2)).toUpperCase();
};

/** Dados que o servidor exige para a OS existir (o que `validateStep1` pedia quando não vem de cadastro). */
function CamposDoCadastro({ os, comPlaca, mostrarErros }: { os: Props['os']; comPlaca: boolean; mostrarErros: boolean }) {
  const { cliente, setCliente, veiculo, setVeiculo } = os;
  const erro = (v: string, extra?: (x: string) => string | undefined) => (mostrarErros ? obrigatorio(v) ?? extra?.(v) : undefined);
  return (
    <div className="osf-grid osf-grid--2">
      {comPlaca && (
        <Input
          name="veiculo_placa" type="placa" label="Placa" required placeholder="ABC1D23 / ABC1234"
          value={veiculo.placa} validate={validarPlaca} error={erro(veiculo.placa, validarPlaca)}
          onChangeValue={(v) => setVeiculo((p) => ({ ...p, placa: v, id: undefined }))}
        />
      )}
      <Input
        name="veiculo_modelo" label="Modelo do veículo" required placeholder="ex: Fiat Pulse"
        maxLength={LIM.modelo} filter={FILTRO.modelo} value={veiculo.modelo} error={erro(veiculo.modelo)}
        onChangeValue={(v) => setVeiculo((p) => ({ ...p, modelo: v }))}
      />
      <Input
        name="veiculo_ano" type="ano" label="Ano" placeholder="2023" value={veiculo.ano}
        validate={validarAno} onChangeValue={(v) => setVeiculo((p) => ({ ...p, ano: v }))}
      />
      <Input
        name="veiculo_cor" label="Cor" placeholder="Prata" maxLength={LIM.cor} filter={FILTRO.cor} value={veiculo.cor}
        onChangeValue={(v) => setVeiculo((p) => ({ ...p, cor: v }))}
      />
      <Input
        name="cliente_nome" type="nome" label="Nome do cliente" required placeholder="Ex: João da Silva" maxLength={LIM.nome}
        value={cliente.nome} validate={validarNome} error={erro(cliente.nome, validarNome)}
        onChangeValue={(v) => setCliente((p) => ({ ...p, nome: v, id: undefined }))}
      />
      <Input
        name="cliente_tel" type="phone" label="Telefone" required placeholder="(00) 00000-0000"
        value={cliente.tel} validate={validarTel} error={erro(cliente.tel, validarTel)}
        onChangeValue={(v) => setCliente((p) => ({ ...p, tel: v }))}
      />
      <Input
        name="cliente_doc" type="cpf_cnpj" label="CPF / CNPJ (opcional)" placeholder="000.000.000-00"
        value={cliente.doc} validate={validarDoc} onChangeValue={(v) => setCliente((p) => ({ ...p, doc: v }))}
      />
      <Input
        name="cliente_email" type="email" label="E-mail (opcional)" placeholder="cliente@email.com" maxLength={LIM.email}
        filter={FILTRO.espacos} value={cliente.email} validate={validarEmail}
        onChangeValue={(v) => setCliente((p) => ({ ...p, email: v }))}
      />
    </div>
  );
}

/** Sub-etapa 1: identifica o veículo (placa) OU escolhe um cliente cadastrado; depois km, combustível e previsão. */
export function EtapaClienteVeiculo({ os, identificado, onIdentificar, onTrocarVeiculo }: Props) {
  const { osHeader, setOsHeader, cliente, setCliente, veiculo, setVeiculo } = os;
  const { clientes, veiculos, carregado } = useCadastrosExistentes();
  const { can } = usePermissions();
  const podeCadastrar = can('clientes.editar');

  const [placaBusca, setPlacaBusca] = useState('');
  const [erroPlaca, setErroPlaca] = useState('');
  const [termo, setTermo] = useState('');
  const [clienteSel, setClienteSel] = useState<ClienteCarteira | null>(null);
  const [modoNovo, setModoNovo] = useState(false);
  const [placaNaoAchada, setPlacaNaoAchada] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(false);

  const completo = clienteVeiculoCompleto(cliente, veiculo);

  const usarVeiculo = (v: VeiculoCadastrado, cli?: ClienteCarteira) => {
    setVeiculo((p) => veiculoDeCadastro(p, v));
    const dono = cli ?? (v.proprietario?.clienteId ? clientes.find((c) => c.id === v.proprietario?.clienteId) : undefined);
    if (dono) setCliente(clienteDeCadastro(dono));
    setModoNovo(false);
    onIdentificar();
  };

  const buscarPlaca = () => {
    const p = formatPlaca(placaBusca);
    if (!isValidPlaca(p)) { setErroPlaca('Digite a placa completa (ABC1D23 ou ABC1234).'); return; }
    setErroPlaca('');
    const achado = buscarVeiculoPorPlaca(veiculos, p);
    if (achado) { usarVeiculo(achado); return; }
    setVeiculo((prev) => ({ ...prev, placa: p, id: undefined }));
    setPlacaNaoAchada(true);
    setModoNovo(true);
  };

  const resultados = useMemo(
    () => (termo.trim().length >= 2
      ? buscarClientes(clientes, veiculos, {
          nome: termo, doc: onlyDigits(termo), tel: onlyDigits(termo), email: termo.includes('@') ? termo : '',
        }, 6)
      : []),
    [clientes, veiculos, termo],
  );

  const escolherCliente = (c: ClienteCarteira) => {
    const vs = veiculosDoCliente(veiculos, c.id);
    if (vs.length === 1) { usarVeiculo(vs[0], c); return; }
    if (vs.length === 0) { setCliente(clienteDeCadastro(c)); setVeiculo((p) => ({ ...p, id: undefined, placa: '' })); setModoNovo(true); return; }
    setClienteSel(c);
  };

  const iniciarNovo = () => {
    setCliente({ nome: '', doc: '', tel: '', email: '' });
    setVeiculo((p) => ({ ...p, id: undefined, placa: '', modelo: '', ano: '', cor: '' }));
    setClienteSel(null); setPlacaNaoAchada(false); setMostrarErros(false); setModoNovo(true);
  };

  const confirmarNovo = () => {
    const ok = isValidPlaca(veiculo.placa) && veiculo.modelo.trim() && cliente.nome.trim() && cliente.tel.trim()
      && !validarNome(cliente.nome) && !validarTel(cliente.tel) && !validarAno(veiculo.ano) && !validarDoc(cliente.doc) && !validarEmail(cliente.email);
    if (!ok) { setMostrarErros(true); return; }
    setMostrarErros(false); setModoNovo(false); onIdentificar();
  };

  // ── Antes de identificar ───────────────────────────────────────────────────
  if (!identificado) {
    return (
      <section className="osf-sec" aria-labelledby="et1-titulo">
        <h2 id="et1-titulo" className="osf-card__titulo">Cliente e veículo</h2>

        {!modoNovo && (
          <>
            <div className="osf-busca">
              <Input
                name="placa_busca" type="placa" label="Placa do veículo" placeholder="Ex.: RVX5G67" value={placaBusca}
                error={erroPlaca || undefined} hint="Se a placa já estiver cadastrada, veículo e cliente vêm preenchidos."
                onChangeValue={(v) => { setPlacaBusca(v); setErroPlaca(''); }}
              />
              <Button variant="primary" onClick={buscarPlaca} style={{ minHeight: 44 }}>Buscar placa</Button>
            </div>

            <div className="osf-ou" aria-hidden="true">ou</div>

            <div className="osf-sec" style={{ gap: 12 }}>
              <Input
                name="busca_cliente" type="search" label="Cliente cadastrado" placeholder="Nome, telefone ou CPF"
                value={termo} onChangeValue={(v) => { setTermo(v); setClienteSel(null); }}
                hint={carregado ? undefined : 'Carregando os clientes cadastrados…'}
              />
              {clienteSel ? (
                <div className="osf-sec" style={{ gap: 8 }}>
                  <p className="osf-nota">Qual veículo de {clienteSel.nome}?</p>
                  <div className="osf-opcoes">
                    {veiculosDoCliente(veiculos, clienteSel.id).map((v) => (
                      <button key={v.id} type="button" className="osf-opcao" onClick={() => usarVeiculo(v, clienteSel)}>
                        <span className="osf-opcao__t"><span className="osf-opcao__n">{rotuloVeiculo(v)}</span><span className="osf-opcao__d">{v.placa}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : resultados.length > 0 ? (
                <div className="osf-opcoes">
                  {resultados.map(({ cliente: c, qtdVeiculos }) => (
                    <button key={c.id} type="button" className="osf-opcao" onClick={() => escolherCliente(c)}>
                      <span className="osf-avatar" aria-hidden="true">{iniciais(c.nome)}</span>
                      <span className="osf-opcao__t">
                        <span className="osf-opcao__n">{c.nome}</span>
                        <span className="osf-opcao__d">{qtdVeiculos === 1 ? '1 veículo' : `${qtdVeiculos} veículos`}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : termo.trim().length >= 2 && carregado ? (
                <p className="osf-nota">Nenhum cliente cadastrado com esse dado.</p>
              ) : null}
              <div className="osf-opcoes">
                <button type="button" className="osf-opcao osf-opcao--novo" onClick={iniciarNovo}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  Cadastrar novo cliente
                </button>
              </div>
            </div>
          </>
        )}

        {modoNovo && (
          <div className="osf-sec">
            {placaNaoAchada && <div className="osf-aviso" data-tom="warn" role="status">Placa {veiculo.placa} não encontrada nos cadastros. Preencha os dados abaixo para criar a OS.</div>}
            <CamposDoCadastro os={os} comPlaca mostrarErros={mostrarErros} />
            {!podeCadastrar && <p className="osf-nota">Seu cargo não cadastra clientes novos: a OS é criada com estes dados, sem criar um cadastro.</p>}
            <div className="osf-opcoes">
              <Button variant="primary" onClick={confirmarNovo} style={{ minHeight: 44 }}>Continuar</Button>
              <Button variant="secondary" onClick={() => { setModoNovo(false); setPlacaNaoAchada(false); setMostrarErros(false); }} style={{ minHeight: 44 }}>Voltar à busca</Button>
            </div>
          </div>
        )}
      </section>
    );
  }

  // ── Veículo identificado ───────────────────────────────────────────────────
  return (
    <section className="osf-sec" aria-labelledby="et1-titulo">
      <h2 id="et1-titulo" className="osf-card__titulo">Cliente e veículo</h2>

      <div className="osf-cartao">
        <div className="osf-cartao__id">
          <span className="osf-avatar" aria-hidden="true" style={{ background: 'var(--color-surface)' }}>{iniciais(cliente.nome || veiculo.placa)}</span>
          <span className="osf-opcao__t">
            <span className="osf-opcao__n">{cliente.nome || 'Cliente sem nome'}</span>
            <span className="osf-opcao__d">{cliente.id ? 'Cliente cadastrado · vinculado a esta OS' : 'Cliente novo nesta OS'}</span>
          </span>
        </div>
        <button type="button" className="osf-link" onClick={onTrocarVeiculo}>Trocar veículo</button>
      </div>

      {!completo && (
        <div className="osf-sec" style={{ gap: 12 }}>
          <div className="osf-aviso" data-tom="warn" role="status">Faltam dados do cliente ou do veículo para a OS ser criada.</div>
          <CamposDoCadastro os={os} comPlaca={false} mostrarErros />
        </div>
      )}

      <div className="osf-grid osf-grid--3">
        <Input
          name="os_km" type="km" label="Km atual" placeholder="87.450" value={osHeader.os_km}
          validate={validarKm} onChangeValue={(v) => setOsHeader((p) => ({ ...p, os_km: v }))}
        />
        <Select
          name="nivel_combustivel" label="Combustível" value={veiculo.nivel_combustivel}
          options={NIVEL_COMBUSTIVEL_OPTIONS} placeholder="Selecione..."
          onChangeValue={(v) => setVeiculo((p) => ({ ...p, nivel_combustivel: v }))}
        />
        <div className="osf-grid" style={{ gridTemplateColumns: '1fr 110px', gap: 8 }}>
          <Input
            name="previsao_entrega" type="date" label="Previsão de entrega" value={osHeader.previsao_entrega ?? ''}
            min={osHeader.os_date || DATA_MIN} validate={(v) => validarPrevisaoData(v, osHeader.os_date)}
            onChangeValue={(v) => setOsHeader((p) => ({ ...p, previsao_entrega: v, ...(v ? {} : { previsao_hora: '' }) }))}
          />
          <Input
            name="previsao_hora" type="time" label="Hora" value={osHeader.previsao_hora ?? ''}
            validate={(v) => validarPrevisaoHora(v, osHeader.previsao_entrega ?? '')}
            onChangeValue={(v) => setOsHeader((p) => ({ ...p, previsao_hora: v }))}
          />
        </div>
      </div>
    </section>
  );
}
