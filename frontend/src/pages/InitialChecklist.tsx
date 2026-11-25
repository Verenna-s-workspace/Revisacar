import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { useOrdemServico } from '../hooks/useOrdemServico';
import { Topbar } from '../components/Topbar';
import { DesktopTopBar } from '../components/DesktopTopBar';
import { Lightbox, useResponsive } from '../components/ui';
import { useConfirm } from '../components/system';
import {
  CabecalhoOS, GavetaOS, LayoutFaseOS, PainelResumo, RodapeEtapa, StepperFases, SubEtapas,
} from '../components/os';
import { EtapaClienteVeiculo } from '../features/Checklist/Entrada/EtapaClienteVeiculo';
import { EtapaRelato } from '../features/Checklist/Entrada/EtapaRelato';
import { EtapaFotos } from '../features/Checklist/Entrada/EtapaFotos';
import { EtapaAssinatura } from '../features/Checklist/Entrada/EtapaAssinatura';
import { tokens } from '../constants';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { salvarOverlay } from '../utils/atendimento_utils';
import type { OSPrefillInput } from '../types/atendimento';
import { LIM, sanitizarPrefill } from '../utils/campos_checklist';
import { formatNome } from '../components/inputs/masks';
import { AvisoCadastro } from '../features/Checklist/Steps/Initial/CadastroExistente';
import { ETAPA, clienteVeiculoCompleto, etapasDaEntrada, resumoDaEntrada } from '../utils/entrada_os';
import { eventosDaOS } from '../utils/historico_os';
import { formatarQuando } from '../utils/fotos_obrigatorias';

interface CheckProps {
  /** Estado da OS — vive no App e é compartilhado entre as fases (entrada, diagnóstico, orçamento). */
  os: ReturnType<typeof useOrdemServico>;
  /** Pré-preenchimento opcional de cliente/veículo pra uma OS NOVA (ex.: "Iniciar Atendimento" a partir de
   *  um agendamento, ou "Fazer OS" a partir de um veículo). Não carrega rascunho existente (isso é do App). */
  prefill?: OSPrefillInput | null;
  onBackToStart?: () => void;
  onNextChecklist?: () => void;
}

/**
 * Fase ENTRADA da OS. Sub-etapas (os.step): 1 Cliente e veículo · 2 Relato e avarias · 3 Fotos · 4 Assinatura.
 * Estrutura compartilhada com as próximas fases em components/os; as regras estão em utils/entrada_os.ts.
 */
export default function Check({ os, prefill, onBackToStart, onNextChecklist }: CheckProps) {
  const { isDesktop } = useResponsive();
  const { user } = useAuth();
  const pedirConfirmacao = useConfirm();

  const step = Math.min(Math.max(os.step, 1), 4);
  const [identificado, setIdentificado] = useState<boolean>(() => !!os.orderId);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [destacarFaltas, setDestacarFaltas] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [falhaRascunho, setFalhaRascunho] = useState(false);

  // ── Pré-preenchimento (Atendimento / veículo) — mesma lógica de antes, só com o salvamento "manter" ────────
  const limpo = useMemo(() => (prefill ? sanitizarPrefill(prefill) : null), [prefill]);
  const prefillAplicado = useRef(false);
  const rascunhoDisparado = useRef(false);   // um só salvamento de criação (dois criariam duas OS)
  const prefillVinculado = useRef(false);

  useEffect(() => {
    if (!prefill || !limpo || prefillAplicado.current) return;
    prefillAplicado.current = true;
    if (limpo.clienteNome) {
      os.setCliente((prev) => ({
        ...prev,
        nome: limpo.clienteNome,
        ...(limpo.clienteDoc ? { doc: limpo.clienteDoc } : {}),
        ...(limpo.clienteTel ? { tel: limpo.clienteTel } : {}),
        ...(limpo.clienteEmail ? { email: limpo.clienteEmail } : {}),
      }));
    }
    os.setVeiculo((prev) => ({
      ...prev,
      modelo: limpo.veiculoModelo,
      placa: limpo.veiculoPlaca,
      ...(limpo.veiculoAno ? { ano: limpo.veiculoAno } : {}),
      ...(limpo.veiculoCor ? { cor: limpo.veiculoCor } : {}),
      ...(limpo.veiculoCombustivel ? { combustivel: limpo.veiculoCombustivel } : {}),
      ...(limpo.veiculoChassi ? { chassi: limpo.veiculoChassi } : {}),
    }));
    // A OS já nasceu de um veículo/cliente cadastrado: o cabeçalho monta direto.
    if (limpo.veiculoPlaca && limpo.veiculoModelo) setIdentificado(true);
  }, [prefill, limpo, os]);

  useEffect(() => { if (os.orderId) setIdentificado(true); }, [os.orderId]);

  // O rascunho é criado ao identificar o veículo (as fotos sobem uma a uma e precisam da OS).
  const cadastroCompleto = clienteVeiculoCompleto(os.cliente, os.veiculo);
  const criarRascunho = useCallback(() => {
    rascunhoDisparado.current = true;
    setFalhaRascunho(false);
    void os.saveOrder({ manter: true }).then((ok) => { if (!ok) { setFalhaRascunho(true); rascunhoDisparado.current = false; } });
  }, [os]);
  useEffect(() => {
    if (identificado && cadastroCompleto && !os.orderId && !rascunhoDisparado.current && !falhaRascunho) criarRascunho();
  }, [identificado, cadastroCompleto, os.orderId, falhaRascunho, criarRascunho]);

  useEffect(() => {
    if (!prefill || prefill.apenasPreencher || !os.orderId || prefillVinculado.current || !prefillAplicado.current) return;
    prefillVinculado.current = true;
    salvarOverlay(os.orderId, { iniciadoEm: new Date().toISOString() });
    if (prefill.agendamentoId) api.atualizarAgendamento(prefill.agendamentoId, { ordemServicoId: os.orderId }).catch(() => {});
  }, [prefill, os.orderId]);

  // Sugere o técnico logado como responsável pela entrada (uma vez; dá para trocar).
  const tecnicoSugerido = useRef(false);
  useEffect(() => {
    if (!identificado || tecnicoSugerido.current) return;
    tecnicoSugerido.current = true;
    if (!os.tecnico.nome.trim() && user?.nome) os.setTecnico((p) => ({ ...p, nome: formatNome(user.nome, LIM.nome).trim() }));
  }, [identificado, user, os]);

  // ── Estado de cada sub-etapa / resumo ──────────────────────────────────────
  const { resumo: fotos, liberado } = os.fotosObrig;
  const entrada = {
    identificado, cliente: os.cliente, veiculo: os.veiculo, tecnico: os.tecnico, assinatura: os.assinaturaEntrada,
    fotos: { resolvidas: fotos.resolvidas, total: fotos.total, liberado },
  };
  const etapas = etapasDaEntrada(entrada);
  const resumo = resumoDaEntrada(etapas, entrada);

  // ── Navegação entre sub-etapas ─────────────────────────────────────────────
  const irPara = (id: number) => {
    // Não dá para pular as 5 fotos (nem pelo resumo): volta para a tela de fotos e realça o que falta.
    if (id > ETAPA.fotos && !liberado) { os.goStep(ETAPA.fotos, step); setDestacarFaltas(true); return; }
    if (os.orderId) void os.saveOrder({ manter: true });
    os.goStep(id, step);
  };
  useEffect(() => { if (liberado) setDestacarFaltas(false); }, [liberado]);

  const concluir = async () => {
    if (!resumo.podeConcluir || concluindo) return;
    setConcluindo(true);
    const ok = await os.saveOrder();
    setConcluindo(false);
    if (ok) onNextChecklist?.();
  };

  const trocarVeiculo = async () => {
    if (os.orderId) {
      const ok = await pedirConfirmacao({
        title: 'Trocar o veículo desta OS?',
        description: 'Os dados do cliente e do veículo serão limpos para você identificar outro. As fotos já registradas continuam na OS.',
        confirmLabel: 'Trocar veículo', tone: 'danger',
      });
      if (!ok) return;
    }
    os.setCliente({ nome: '', doc: '', tel: '', email: '' });
    os.setVeiculo((p) => ({ ...p, id: undefined, placa: '', modelo: '', ano: '', cor: '', combustivel: '', chassi: '' }));
    setIdentificado(false);
    os.goStep(ETAPA.cliente, step);
  };

  const limparOS = async () => {
    const ok = await pedirConfirmacao({
      title: 'Limpar toda a OS e começar do zero?', description: 'O que foi preenchido nesta tela será descartado.',
      confirmLabel: 'Limpar OS', tone: 'danger',
    });
    if (!ok) return;
    os.novaOrdem();
    setIdentificado(false);
    rascunhoDisparado.current = false;
    tecnicoSugerido.current = false;
  };

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  const { osHeader, veiculo, cliente } = os;
  const [, mm, dd] = (osHeader.os_date || '').split('-');
  const entradaTxt = osHeader.os_date ? `entrada ${dd}/${mm}${osHeader.os_time ? ` às ${osHeader.os_time}` : ''}` : '';
  const kmTxt = osHeader.os_km ? `${Number(osHeader.os_km).toLocaleString('pt-BR')} km` : '';
  const meta = [`OS #${osHeader.os_num}`, cliente.nome, entradaTxt, kmTxt].filter(Boolean).join(' · ');
  const titulo = [veiculo.modelo, veiculo.ano].filter(Boolean).join(' · ');
  const eventos = eventosDaOS({ orderId: os.orderId, osHeader, fotos: fotos.itens, assinatura: os.assinaturaEntrada });

  const salvoTxt = os.saveStatus === 'error' ? undefined : os.savedAt ? `Salvo automaticamente às ${os.savedAt}` : undefined;
  const ultima = step === ETAPA.assinatura;

  return (
    <div style={{ fontFamily: tokens.fontSans, background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
      {isDesktop ? (
        <DesktopTopBar
          page="ordens"
          onNav={() => onBackToStart?.()}
          trilha={[
            { rotulo: 'Operação' },
            { rotulo: 'Ordens', onClick: onBackToStart },
            { rotulo: identificado ? `OS #${osHeader.os_num}` : 'Nova OS' },
          ]}
        />
      ) : (
        <Topbar
          saveStatus={os.saveStatus} savedAt={os.savedAt} onReset={limparOS} onBackToStart={onBackToStart}
          onBackStep={() => (step > 1 ? irPara(step - 1) : onBackToStart?.())}
          backAriaLabel={step > 1 ? 'Voltar uma etapa' : 'Voltar para a visão geral'}
        />
      )}

      <AvisoCadastro info={os.cadastroInfo} onFechar={() => os.setCadastroInfo(null)} px={isDesktop ? 40 : 16} />

      <LayoutFaseOS
        cabecalho={
          <CabecalhoOS
            identificado={identificado} placa={veiculo.placa} titulo={titulo} status={os.ordemStatus} meta={meta}
            onHistorico={() => setHistoricoAberto(true)}
            acoesMais={[{ rotulo: 'Limpar OS e recomeçar', perigo: true, onClick: () => void limparOS() }]}
          />
        }
        stepper={<StepperFases atual="entrada" />}
        subetapas={<SubEtapas etapas={etapas} atual={step} onSelecionar={irPara} rotuloNav="Etapas da Entrada" />}
        resumo={
          <PainelResumo
            titulo="Resumo da entrada" etapas={etapas} atual={step} onSelecionar={irPara}
            concluidas={resumo.concluidas} total={resumo.total}
            acao={{ rotulo: 'Concluir entrada e diagnosticar', desabilitada: !resumo.podeConcluir, ocupada: concluindo, onClick: () => void concluir() }}
            ajuda={resumo.ajuda} salvo={salvoTxt}
          />
        }
      >
        <main className="osf-card" aria-live="polite">
          {falhaRascunho && !os.orderId && (
            <div className="osf-aviso" data-tom="crit" role="alert">
              {os.saveError ?? 'Não foi possível criar o rascunho da OS.'}
              <div style={{ marginTop: 10 }}>
                <button type="button" className="osf-link" onClick={criarRascunho}>Tentar salvar de novo</button>
              </div>
            </div>
          )}
          {os.saveStatus === 'error' && os.orderId && os.saveError && <div className="osf-aviso" data-tom="crit" role="alert">{os.saveError}</div>}

          {step === ETAPA.cliente && (
            <EtapaClienteVeiculo os={os} identificado={identificado} onIdentificar={() => setIdentificado(true)} onTrocarVeiculo={() => void trocarVeiculo()} />
          )}
          {step === ETAPA.relato && <EtapaRelato os={os} />}
          {step === ETAPA.fotos && <EtapaFotos os={os} destacarFaltas={destacarFaltas} />}
          {step === ETAPA.assinatura && <EtapaAssinatura os={os} />}

          <RodapeEtapa
            onVoltar={() => irPara(step - 1)} voltarDesabilitado={step === 1}
            onContinuar={ultima ? undefined : () => irPara(step + 1)}
            continuarRotulo={step === ETAPA.fotos ? 'Continuar para assinatura' : 'Continuar'}
            continuarDesabilitado={!identificado || (step === ETAPA.cliente && !cadastroCompleto)}
          />
        </main>
      </LayoutFaseOS>

      {historicoAberto && (
        <GavetaOS titulo="Histórico da OS" onFechar={() => setHistoricoAberto(false)}>
          {eventos.length === 0 ? (
            <p className="osf-nota">Ainda não há eventos registrados nesta OS.</p>
          ) : (
            <ul className="osf-linha">
              {eventos.map((e) => (
                <li key={e.id}>
                  <span className="osf-linha__ponto" aria-hidden="true" />
                  <div className="osf-linha__txt">
                    <span className="osf-linha__t">{e.texto}</span>
                    <span className="osf-linha__m">{[formatarQuando(e.quando) || (e.quando ?? '').replace('T', ' '), e.por].filter(Boolean).join(' · ')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="osf-nota">Mostra o que já foi registrado na OS (criação, fotos e assinatura).</p>
        </GavetaOS>
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}
