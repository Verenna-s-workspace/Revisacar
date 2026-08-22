import { useEffect, useRef } from 'react';
import { useOrdemServico } from '../hooks/useOrdemServico';
import { exportPDF } from '../utils/exportPDF';
import { Topbar } from '../components/Topbar';
import { StepTabs } from '../components/StepTabs';
import { Lightbox } from '../components/ui';
import { entradaConfig } from '../features/Checklist/configs/initial';
import { tokens } from '../constants';
import { api } from '../utils/api';
import { salvarOverlay } from '../utils/atendimento_utils';
import type { OrdemServico } from '../types';
import type { OSPrefillInput } from '../types/atendimento';

interface CheckProps {
  initialOrdem?: (OrdemServico & { id: string }) | null;
  /** Pré-preenchimento opcional de cliente/veículo pra uma OS NOVA (ex.: "Iniciar
   *  Atendimento" a partir de um agendamento, na tela de Atendimento). Não é usado
   *  pra carregar rascunho existente — isso continua sendo `initialOrdem`. */
  prefill?: OSPrefillInput | null;
  onBackToStart?: () => void;
  onNextChecklist?: () => void;
}

export default function Check({ initialOrdem, prefill, onBackToStart, onNextChecklist }: CheckProps) {
  const os = useOrdemServico();

  const currentStep = entradaConfig.find((s) => s.id === os.step);

  // Chama initSig automaticamente sempre que o step ativo tiver hasSignature
  useEffect(() => {
    if (currentStep?.hasSignature) os.initSig();
  }, [os.step]);

  // Pré-preenchimento vindo da tela de Atendimento (ver Seção 8 do prompt).
  // 3 passos, cada um só dispara depois que o anterior comprovadamente se
  // efetivou — nenhum toca a lógica interna do checklist, só usa o que o
  // próprio hook já expõe publicamente (setCliente/setVeiculo/saveOrder/orderId,
  // os mesmos que o botão "Salvar" do Step 1 já usa):
  //  1) aplica cliente/veículo uma vez, nunca sobrescreve o que o usuário digitar;
  //  2) assim que o estado confirmar o prefill, dispara o saveOrder() já existente
  //     (cria a OS de verdade — mesmo caminho de sempre, só chamado programaticamente);
  //  3) assim que a OS ganhar um id real, registra iniciadoEm no overlay local e
  //     tenta vincular o agendamento de origem (melhor esforço, sem travar o fluxo).
  const prefillAplicado = useRef(false);
  const prefillSalvo = useRef(false);
  const prefillVinculado = useRef(false);

  useEffect(() => {
    if (!prefill || prefillAplicado.current) return;
    prefillAplicado.current = true;
    os.setCliente(prev => ({ ...prev, nome: prefill.clienteNome }));
    os.setVeiculo(prev => ({ ...prev, modelo: prefill.veiculoModelo, placa: prefill.veiculoPlaca }));
  }, [prefill]);

  useEffect(() => {
    if (!prefill || !prefillAplicado.current || prefillSalvo.current) return;
    if (os.cliente.nome !== prefill.clienteNome || os.veiculo.placa !== prefill.veiculoPlaca) return;
    prefillSalvo.current = true;
    os.saveOrder();
  }, [prefill, os.cliente, os.veiculo]);

  useEffect(() => {
    if (!prefill || !prefillSalvo.current || prefillVinculado.current || !os.orderId) return;
    prefillVinculado.current = true;
    salvarOverlay(os.orderId, { iniciadoEm: new Date().toISOString() });
    if (prefill.agendamentoId) {
      api.atualizarAgendamento(prefill.agendamentoId, { ordemServicoId: os.orderId }).catch(() => {});
    }
  }, [prefill, os.orderId]);

  // ... resto igual

  const handleExportPDF = () => {
    exportPDF(
      os.osHeader,
      os.cliente,
      os.veiculo,
      os.tecnico,
      os.photos,
      os.getSigImage(),
    );
  };

  const CurrentComponent = currentStep?.component;

  return (
    <div style={{
      fontFamily: tokens.fontSans,
      background: tokens.color.bg,
      minHeight: '100vh',
      paddingBottom: 'var(--mobile-bottom-nav-h)',
    }}>
      <Topbar
        saveStatus={os.saveStatus}
        savedAt={os.savedAt}
        onReset={os.resetAll}
        onExportPDF={handleExportPDF}
        onBackToStart={onBackToStart}
      />
     
<StepTabs
  step={os.step}
  onGoStep={(n) => os.goStep(n, os.step)}
  steps={entradaConfig}
/>

      {CurrentComponent && (
        <CurrentComponent
      os={os}
      onExportPDF={handleExportPDF}
      onNextChecklist={onNextChecklist}  // ← new
    />
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}