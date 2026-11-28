import { useMemo, useState } from 'react';
import type { useOrdemServico } from '../hooks/useOrdemServico';
import { Topbar } from '../components/Topbar';
import { DesktopTopBar } from '../components/DesktopTopBar';
import { Lightbox, useResponsive } from '../components/ui';
import { Button, useConfirm } from '../components/system';
import { CabecalhoOS, GavetaOS, LayoutFaseOS, RodapeEtapa, StepperFases, SubEtapas } from '../components/os';
import { EtapaServicos } from '../features/Checklist/Diagnostico/EtapaServicos';
import { EtapaDiagnostico } from '../features/Checklist/Diagnostico/EtapaDiagnostico';
import { EtapaPecas } from '../features/Checklist/Diagnostico/EtapaPecas';
import { EtapaTexto } from '../features/Checklist/Diagnostico/EtapaTexto';
import { MenuSistemas } from '../features/Checklist/Diagnostico/MenuSistemas';
import { PainelInspecao } from '../features/Checklist/Diagnostico/PainelInspecao';
import { SeletorSistemas } from '../features/Checklist/Diagnostico/SeletorSistemas';
import { tokens } from '../constants';
import { montarCabecalhoOS } from '../utils/cabecalho_os';
import { eventosDaOS } from '../utils/historico_os';
import { formatarQuando } from '../utils/fotos_obrigatorias';
import {
  ETAPA_DIAG, contagemDoSistema, criticosSemObs, etapasDoDiagnostico, nomeDaChave, sistemasSelecionados,
  type ContagemSistema,
} from '../utils/diagnostico_os';

interface Check2Props {
  /** Estado da OS — o mesmo da Entrada e do orçamento (vive no App). */
  os: ReturnType<typeof useOrdemServico>;
  onBackToStart?: () => void;
  /** Vai para a etapa 3 (orçamento). */
  onNextChecklist?: () => void;
  /** Volta para o checklist anterior (Entrada) — usado pelo "Voltar" na primeira sub-etapa. */
  onPrevChecklist?: () => void;
}

/**
 * Fase DIAGNÓSTICO da OS. Sub-etapas (os.step): 1 Serviços (sistemas) · 2 Diagnóstico · 3 Peças · 4 Texto.
 * Mesma estrutura da Entrada (components/os); as regras ficam em utils/diagnostico_os.ts e os dados no hook useOrdemServico.
 */
export default function Check2({ os, onBackToStart, onNextChecklist, onPrevChecklist }: Check2Props) {
  const { isDesktop } = useResponsive();
  const pedirConfirmacao = useConfirm();

  const step = Math.min(Math.max(os.step, 1), 4);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [sistemasAberto, setSistemasAberto] = useState(false);
  const [sistemaAtivoId, setSistemaAtivoId] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);

  // ── Sistemas da OS e contagens ─────────────────────────────────────────────
  const sistemas = sistemasSelecionados(os.selected);
  const sistemaAtivo = sistemas.find((s) => s.id === sistemaAtivoId) ?? sistemas[0];
  const contagens = useMemo(() => {
    const m: Record<string, ContagemSistema> = {};
    for (const s of sistemasSelecionados(os.selected)) m[s.id] = contagemDoSistema(s, os.checklist, os.itensAdicionais);
    return m;
  }, [os.selected, os.checklist, os.itensAdicionais]);

  const { done, total, ok, warn, crit, na } = os.stats;
  const pendentes = Math.max(total - done, 0);
  const semObs = criticosSemObs(os.selected, os.checklist, os.itensAdicionais).length;
  const paraTrocar = Array.from(os.trocaSet).map((key) => ({ key, nome: nomeDaChave(key) }));

  const etapas = etapasDoDiagnostico({
    sistemas: sistemas.length, total, feitos: done, crit, semObs, pecas: os.tabelaPecas,
  });

  // ── Navegação ──────────────────────────────────────────────────────────────
  // Salva ao trocar de sub-etapa sem mexer no status da OS (igual à Entrada). O botão "Salvar" é o salvamento explícito de sempre.
  const irPara = (id: number) => {
    if (os.orderId) void os.saveOrder({ manter: true });
    os.goStep(id, step);
  };
  const voltar = () => { if (step > 1) irPara(step - 1); else (onPrevChecklist ?? onBackToStart)?.(); };

  const concluir = async () => {
    if (concluindo || !onNextChecklist) return;
    setConcluindo(true);
    const salvou = await os.saveOrder();
    setConcluindo(false);
    if (salvou) onNextChecklist();
  };

  const alternarSistema = (id: string) => {
    const jaEstava = os.selected.has(id);
    os.toggleSection(id);
    if (!jaEstava) setSistemaAtivoId(id);
  };

  const limparOS = async () => {
    const confirmou = await pedirConfirmacao({
      title: 'Limpar toda a OS e começar do zero?', description: 'O que foi preenchido nesta OS será descartado.',
      confirmLabel: 'Limpar OS', tone: 'danger',
    });
    if (!confirmou) return;
    os.novaOrdem();
    onBackToStart?.();
  };

  // ── Ação principal do painel, por sub-etapa ────────────────────────────────
  const acao =
    step === ETAPA_DIAG.servicos
      ? { rotulo: 'Continuar para o diagnóstico', desabilitada: os.selected.size === 0, onClick: () => irPara(ETAPA_DIAG.diagnostico) }
      : step === ETAPA_DIAG.diagnostico
        ? { rotulo: os.trocaSet.size > 0 ? `Revisar peças (${os.trocaSet.size})` : 'Continuar para peças', desabilitada: false, onClick: () => irPara(ETAPA_DIAG.pecas) }
        : step === ETAPA_DIAG.pecas
          ? { rotulo: 'Gerar texto', desabilitada: os.tabelaPecas.length === 0, onClick: () => irPara(ETAPA_DIAG.texto) }
          : { rotulo: 'Ir para o orçamento', desabilitada: !onNextChecklist, ocupada: concluindo, onClick: () => void concluir() };

  const ajuda = step === ETAPA_DIAG.diagnostico && pendentes > 0
    ? `${pendentes === 1 ? 'Falta 1 item' : `Faltam ${pendentes} itens`} sem status. Dá para continuar e voltar depois.`
    : undefined;
  const salvo = os.saveStatus === 'error' ? undefined : os.savedAt ? `Salvo às ${os.savedAt}` : 'Rascunho não salvo';

  // ── Cabeçalho e histórico ──────────────────────────────────────────────────
  const { osHeader, veiculo, cliente } = os;
  const { titulo, meta } = montarCabecalhoOS(osHeader, veiculo, cliente);
  const eventos = eventosDaOS({ orderId: os.orderId, osHeader, fotos: os.fotosObrig.resumo.itens });
  const identificado = !!veiculo.placa || !!os.orderId;

  return (
    <div style={{ fontFamily: tokens.fontSans, background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
      {isDesktop ? (
        <DesktopTopBar
          page="ordens"
          onNav={() => onBackToStart?.()}
          trilha={[
            { rotulo: 'Operação' },
            { rotulo: 'Ordens', onClick: onBackToStart },
            { rotulo: `OS #${osHeader.os_num}` },
          ]}
        />
      ) : (
        <Topbar
          saveStatus={os.saveStatus} savedAt={os.savedAt} onReset={() => void limparOS()} onBackToStart={onBackToStart}
          onBackStep={voltar}
          backAriaLabel={step > 1 ? 'Voltar uma etapa' : onPrevChecklist ? 'Voltar para a Entrada' : 'Voltar para a visão geral'}
        />
      )}

      <LayoutFaseOS
        cabecalho={
          <CabecalhoOS
            identificado={identificado} placa={veiculo.placa} titulo={titulo} status={os.ordemStatus} meta={meta}
            onHistorico={() => setHistoricoAberto(true)}
            acoesMais={[{ rotulo: 'Limpar OS e recomeçar', perigo: true, onClick: () => void limparOS() }]}
          />
        }
        stepper={
          <StepperFases
            atual="diagnostico" concluidas={['entrada']}
            onSelecionar={onPrevChecklist ? (fase) => { if (fase === 'entrada') onPrevChecklist(); } : undefined}
          />
        }
        subetapas={<SubEtapas etapas={etapas} atual={step} onSelecionar={irPara} rotuloNav="Etapas do Diagnóstico" />}
        menu={
          step === ETAPA_DIAG.diagnostico ? (
            <MenuSistemas
              sistemas={sistemas} ativo={sistemaAtivo?.id} contagens={contagens} feitos={done} total={total}
              onSelecionar={setSistemaAtivoId} onAdicionar={() => setSistemasAberto(true)}
            />
          ) : undefined
        }
        resumo={
          <PainelInspecao
            ok={ok} warn={warn} crit={crit} na={na} pendentes={pendentes} criticosSemObs={semObs}
            paraTrocar={paraTrocar} acao={acao} ajuda={ajuda} salvo={salvo}
          />
        }
      >
        <main className="osf-card osd-card" aria-live="polite">
          {os.saveStatus === 'error' && os.saveError && <div className="osf-aviso" data-tom="crit" role="alert">{os.saveError}</div>}

          {step === ETAPA_DIAG.servicos && <EtapaServicos os={os} />}
          {step === ETAPA_DIAG.diagnostico && (
            <EtapaDiagnostico os={os} sistema={sistemaAtivo} onAbrirSistemas={() => setSistemasAberto(true)} />
          )}
          {step === ETAPA_DIAG.pecas && <EtapaPecas os={os} onVoltarDiagnostico={() => irPara(ETAPA_DIAG.diagnostico)} />}
          {step === ETAPA_DIAG.texto && <EtapaTexto os={os} onVoltarPecas={() => irPara(ETAPA_DIAG.pecas)} />}

          <RodapeEtapa
            onVoltar={voltar}
            extra={<Button variant="secondary" onClick={() => void os.saveOrder()}>Salvar</Button>}
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

      {sistemasAberto && (
        <GavetaOS titulo="Sistemas da OS" onFechar={() => setSistemasAberto(false)}>
          <SeletorSistemas selected={os.selected} onToggle={alternarSistema} onToggleAll={os.toggleAllSections} layout="lista" />
          <p className="osf-nota">
            Desmarcar um sistema o tira da inspeção; o que você já respondeu nele fica guardado se marcar de novo.
            “Inspeção Personalizada” é para itens que você digita.
          </p>
        </GavetaOS>
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}
