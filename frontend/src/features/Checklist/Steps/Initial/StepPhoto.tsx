import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { CameraCapture } from '../../../../components/Camera/CameraCapture';
import { tokens } from '../../../../constants';
import {
  FormBlock, PanelFooter, PhotoGrid, btnGhost, btnAccent, btnDisabled,
} from '../../../../components/ui';
import {
  SLOTS_FOTO, textoFaltam, type SlotFoto,
} from '../../../../utils/fotos_obrigatorias';
import { FotoObrigatoriaItem } from './FotosObrigatorias/FotoObrigatoriaItem';
import { PularFotoSheet } from './FotosObrigatorias/PularFotoSheet';
import { IconeCamera } from './FotosObrigatorias/IconesFoto';

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

const aviso = (cor: 'warn' | 'crit'): React.CSSProperties => ({
  background: tokens.color[`${cor}Bg`],
  border: `1px solid ${tokens.color[`${cor}Border`]}`,
  borderLeft: `3px solid ${tokens.color[cor]}`,
  borderRadius: tokens.radius.md,
  padding: '10px 14px',
  marginBottom: 14,
  fontFamily: tokens.fontSans,
  fontSize: '0.88rem',
  color: tokens.color.text,
});

export function Step2({ os }: StepProps) {
  const {
    photos, handlePhotos, removePhoto,
    setLightbox, addPhotoFromCamera,
    goStep, step, stepDir,
    orderId, saveOrder, fotosObrig,
  } = os;
  const { resumo, fonte, exigida, somenteLeitura, liberado } = fotosObrig;

  const [cameraSlot, setCameraSlot] = useState<SlotFoto | null>(null);
  const [cameraExtra, setCameraExtra] = useState(false);
  const [pularSlot, setPularSlot] = useState<SlotFoto | null>(null);
  const [mostrarFaltas, setMostrarFaltas] = useState(false);
  const [falhaSalvar, setFalhaSalvar] = useState(false);
  const jaTentouSalvar = useRef(false);

  // As fotos obrigatórias sobem uma a uma, então a OS precisa existir: ao chegar aqui sem id,
  // salva o rascunho (um salvamento por vez — ver saveOrder).
  useEffect(() => {
    if (orderId || jaTentouSalvar.current) return;
    jaTentouSalvar.current = true;
    saveOrder().then((ok) => { if (!ok) setFalhaSalvar(true); });
  }, [orderId, saveOrder]);

  useEffect(() => { if (orderId) setFalhaSalvar(false); }, [orderId]);
  useEffect(() => { if (resumo.completo) setMostrarFaltas(false); }, [resumo.completo]);

  const tentarSalvarDeNovo = () => {
    setFalhaSalvar(false);
    saveOrder().then((ok) => { if (!ok) setFalhaSalvar(true); });
  };

  const modoAntigo = fonte === 'indisponivel';
  const carregando = !modoAntigo && fonte !== 'ok' && fonte !== 'erro';
  const faltam = resumo.faltam.length;
  const bloqueado = !liberado;

  const irParaEncerramento = () => {
    if (bloqueado) {
      if (fonte !== 'ok') return;                      // ainda carregando / com erro: o aviso já explica
      setMostrarFaltas(true);
      document.getElementById(`foto-${resumo.faltam[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    void saveOrder();                                  // sobe as fotos adicionais e grava o rascunho
    goStep(3, step);
  };

  const cfgDoSlot = (slot: SlotFoto) => SLOTS_FOTO.find((s) => s.id === slot);
  const itemPular = pularSlot ? resumo.itens.find((i) => i.slot === pularSlot) : undefined;
  const pct = resumo.total ? Math.round((resumo.resolvidas / resumo.total) * 100) : 0;

  return (
    <StepWrapper direction={stepDir}>
      <FormBlock title="Fotos obrigatórias da entrada">
        <p style={{ fontFamily: tokens.fontMono, fontSize: '0.65rem', color: tokens.color.muted, margin: '0 0 14px' }}>
          Registro de confiabilidade do veículo. As fotos entram no relatório em PDF.
        </p>

        {falhaSalvar && !orderId && (
          <div role="alert" style={aviso('crit')}>
            Não foi possível salvar a OS para liberar as fotos. Confira a Identificação (placa, modelo e cliente) e a internet.
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" onClick={tentarSalvarDeNovo} style={{ ...btnAccent, minHeight: 44 }}>Tentar salvar de novo</button>
              <button type="button" onClick={() => goStep(1, step)} style={{ ...btnGhost, minHeight: 44 }}>Voltar à Identificação</button>
            </div>
          </div>
        )}

        {fonte === 'erro' && (
          <div role="alert" style={aviso('crit')}>
            {fotosObrig.erroGeral}
            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={() => void fotosObrig.carregar()} style={{ ...btnAccent, minHeight: 44 }}>Tentar de novo</button>
            </div>
          </div>
        )}

        {modoAntigo && (
          <div role="status" style={aviso('warn')}>
            As fotos obrigatórias ainda não estão ativas neste ambiente (falta rodar <code>backend/sql/ordens_fotos.sql</code> no Supabase).
            Você pode seguir; as 5 fotos não serão exigidas por enquanto.
          </div>
        )}

        {!modoAntigo && !orderId && !falhaSalvar && (
          <div role="status" style={{ ...aviso('warn'), borderLeftColor: tokens.color.muted }}>Preparando a OS para receber as fotos…</div>
        )}

        {!modoAntigo && exigida === false && (
          <div role="status" style={{ ...aviso('warn'), borderLeftColor: tokens.color.muted }}>
            {somenteLeitura
              ? 'Esta OS já passou da fase de orçamento: o registro de entrada não pode mais ser alterado.'
              : 'Esta OS já passou da entrada: as fotos obrigatórias não são exigidas aqui, mas você ainda pode completar o registro.'}
          </div>
        )}

        {!modoAntigo && (
          <>
            {/* Progresso */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: tokens.fontSans, fontSize: '1.35rem', fontWeight: 800, color: liberado && resumo.completo ? tokens.color.ok : tokens.color.text }}>
                  {resumo.resolvidas} de {resumo.total}
                </span>
                <span style={{ fontFamily: tokens.fontMono, fontSize: '0.7rem', color: resumo.completo ? tokens.color.ok : tokens.color.muted }}>
                  {carregando ? 'carregando…' : textoFaltam(faltam)}
                </span>
              </div>
              <div
                role="progressbar" aria-valuemin={0} aria-valuemax={resumo.total} aria-valuenow={resumo.resolvidas}
                aria-label="Fotos obrigatórias resolvidas"
                style={{ height: 8, borderRadius: 999, background: tokens.color.border, overflow: 'hidden', margin: '6px 0 8px' }}
              >
                <div style={{ width: `${pct}%`, height: '100%', background: resumo.completo ? tokens.color.ok : tokens.color.ferrari, transition: 'width .25s ease' }} />
              </div>
              <div style={{ fontFamily: tokens.fontMono, fontSize: '0.68rem', color: tokens.color.muted }}>
                Fotos: {SLOTS_FOTO.map((s) => s.rotulo).join(', ')}
              </div>
            </div>

            {/* Os 5 itens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resumo.itens.map((item) => (
                <FotoObrigatoriaItem
                  key={item.slot}
                  item={item}
                  miniatura={fotosObrig.miniaturas[item.slot] ?? fotosObrig.falhas[item.slot]?.dataUrl}
                  ocupado={!!fotosObrig.ocupados[item.slot]}
                  erro={pularSlot === item.slot ? undefined : fotosObrig.erros[item.slot]}
                  podeReenviar={!!fotosObrig.falhas[item.slot]}
                  destacar={mostrarFaltas && item.situacao === 'pendente'}
                  desabilitado={!orderId || fonte === 'carregando' || fonte === 'erro' || somenteLeitura}
                  onTirar={() => setCameraSlot(item.slot)}
                  onPular={() => setPularSlot(item.slot)}
                  onReenviar={() => void fotosObrig.reenviar(item.slot)}
                  onVerFoto={(src) => setLightbox(src)}
                />
              ))}
            </div>
          </>
        )}
      </FormBlock>

      <FormBlock title="Fotos adicionais (opcional)">
        <p style={{ fontFamily: tokens.fontMono, fontSize: '0.65rem', color: tokens.color.muted, marginBottom: 14 }}>
          Defeitos, riscos, pontos de atenção — quantas quiser.
        </p>

        <button
          type="button"
          onClick={() => setCameraExtra(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            width: '100%', maxWidth: 360, minHeight: 48, marginBottom: 16, padding: '10px 18px',
            background: tokens.color.accentDim,
            border: `1.5px solid ${tokens.color.ferrari}`,
            borderRadius: tokens.radius.lg,
            color: tokens.color.ferrari,
            fontFamily: tokens.fontMono, fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em',
            cursor: 'pointer', boxShadow: '0 1px 4px rgba(204,20,0,0.10)', transition: tokens.transition.base,
          }}
        >
          <IconeCamera size={18} />
          Tirar foto adicional
        </button>

        <PhotoGrid
          photos={photos}
          handlePhotos={handlePhotos}
          onRemove={removePhoto}
          onPreview={(src) => setLightbox(src)}
        />
      </FormBlock>

      <PanelFooter
        left={
          !modoAntigo && exigida && fonte === 'ok' ? (
            <span style={{ fontFamily: tokens.fontMono, fontSize: '0.72rem', color: resumo.completo ? tokens.color.ok : tokens.color.warn }}>
              {resumo.resolvidas} de {resumo.total} · {textoFaltam(faltam)}
            </span>
          ) : null
        }
        right={
          <>
            <button onClick={() => goStep(1, step)} style={{ ...btnGhost, minHeight: 48, justifyContent: 'center' }}>
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button
              onClick={irParaEncerramento}
              aria-disabled={bloqueado}
              style={{
                ...(bloqueado ? { ...btnDisabled, cursor: 'pointer' } : btnAccent),
                minHeight: 48, justifyContent: 'center',
              }}
            >
              Encerramento
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />

      {/* Portais no <body>: o StepWrapper usa will-change: transform, e isso prende elementos
          position:fixed ao tamanho da página inteira em vez da tela do celular. */}
      {cameraSlot && createPortal(
        <CameraCapture
          titulo={cfgDoSlot(cameraSlot)?.rotulo}
          dica={cfgDoSlot(cameraSlot)?.dica}
          onCapture={(foto) => {
            const slot = cameraSlot;
            setCameraSlot(null);
            void fotosObrig.tirarFoto(slot, foto);
          }}
          onClose={() => setCameraSlot(null)}
        />,
        document.body,
      )}

      {cameraExtra && createPortal(
        <CameraCapture
          titulo="Foto adicional"
          onCapture={(foto) => {
            void addPhotoFromCamera(foto);
            setCameraExtra(false);
          }}
          onClose={() => setCameraExtra(false)}
        />,
        document.body,
      )}

      {pularSlot && itemPular && createPortal(
        <PularFotoSheet
          rotulo={itemPular.rotulo}
          motivoAtual={itemPular.situacao === 'pulada' ? itemPular.motivo : undefined}
          ocupado={!!fotosObrig.ocupados[pularSlot]}
          erro={fotosObrig.erros[pularSlot]}
          onCancelar={() => setPularSlot(null)}
          onConfirmar={async (motivo) => {
            const ok = await fotosObrig.pular(pularSlot, motivo);
            if (ok) setPularSlot(null);
          }}
        />,
        document.body,
      )}
    </StepWrapper>
  );
}
