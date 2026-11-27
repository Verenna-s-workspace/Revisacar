import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { Button } from '../../../components/system';
import { CameraCapture } from '../../../components/Camera/CameraCapture';
import { PhotoGrid } from '../../../components/ui';
import { PularFotoSheet } from '../Steps/Initial/FotosObrigatorias/PularFotoSheet';
import { IconeCamera } from '../Steps/Initial/FotosObrigatorias/IconesFoto';
import { SLOTS_FOTO, formatarQuando, type SlotFoto } from '../../../utils/fotos_obrigatorias';
import '../../../components/os/os-fase.css';

/** Nomes curtos dos slots na tela nova (os ids e a ordem são os do servidor; o rótulo do PDF não muda). */
const ROTULO_TELA: Record<SlotFoto, string> = {
  hodometro: 'Painel (km)', frente: 'Frente', traseira: 'Traseira', lateral_direita: 'Lateral dir.', lateral_esquerda: 'Lateral esq.',
};

interface Props {
  os: ReturnType<typeof useOrdemServico>;
  /** O usuário tentou avançar sem as 5 resolvidas: realça as que faltam. */
  destacarFaltas: boolean;
}

/** Sub-etapa 3: as 5 fotos obrigatórias (câmera, "Não consigo tirar", refazer) + fotos livres. Lógica = useFotosObrigatorias. */
export function EtapaFotos({ os, destacarFaltas }: Props) {
  const { orderId, fotosObrig, photos, handlePhotos, removePhoto, setLightbox, addPhotoFromCamera } = os;
  const { resumo, fonte, exigida, somenteLeitura } = fotosObrig;
  const [cameraSlot, setCameraSlot] = useState<SlotFoto | null>(null);
  const [cameraExtra, setCameraExtra] = useState(false);
  const [pularSlot, setPularSlot] = useState<SlotFoto | null>(null);

  const modoAntigo = fonte === 'indisponivel';
  const carregando = !modoAntigo && fonte !== 'ok' && fonte !== 'erro';
  const travado = !orderId || fonte === 'carregando' || fonte === 'erro' || somenteLeitura;
  const pct = resumo.total ? Math.round((resumo.resolvidas / resumo.total) * 100) : 0;
  const itemPular = pularSlot ? resumo.itens.find((i) => i.slot === pularSlot) : undefined;

  useEffect(() => { if (destacarFaltas) document.getElementById(`foto-${resumo.faltam[0]}`)?.scrollIntoView({ block: 'center' }); }, [destacarFaltas]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="osf-sec" aria-labelledby="et3-titulo">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h2 id="et3-titulo" className="osf-card__titulo">Fotos obrigatórias</h2>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600 }} aria-live="polite">{resumo.resolvidas} de {resumo.total}</span>
      </div>
      <div className="osf-barra" role="progressbar" aria-valuemin={0} aria-valuemax={resumo.total} aria-valuenow={resumo.resolvidas} aria-label="Fotos obrigatórias resolvidas">
        <div style={{ width: `${pct}%` }} />
      </div>

      {fonte === 'erro' && (
        <div className="osf-aviso" data-tom="crit" role="alert">
          {fotosObrig.erroGeral}
          <div style={{ marginTop: 10 }}><Button variant="primary" onClick={() => void fotosObrig.carregar()} style={{ minHeight: 44 }}>Tentar de novo</Button></div>
        </div>
      )}
      {modoAntigo && (
        <div className="osf-aviso" data-tom="warn" role="status">
          As fotos obrigatórias ainda não estão ativas neste ambiente (falta rodar a migração de fotos no Supabase). Você pode seguir; as 5 fotos não serão exigidas por enquanto.
        </div>
      )}
      {!modoAntigo && !orderId && <div className="osf-aviso" role="status">Preparando a OS para receber as fotos…</div>}
      {!modoAntigo && exigida === false && (
        <div className="osf-aviso" role="status">
          {somenteLeitura ? 'Esta OS já passou da fase de orçamento: o registro de entrada não pode mais ser alterado.' : 'Esta OS já passou da entrada: as fotos obrigatórias não são exigidas aqui, mas você ainda pode completar o registro.'}
        </div>
      )}

      {!modoAntigo && (
        <div className="osf-slots">
          {resumo.itens.map((item) => {
            const miniatura = fotosObrig.miniaturas[item.slot] ?? fotosObrig.falhas[item.slot]?.dataUrl;
            const ocupado = !!fotosObrig.ocupados[item.slot];
            const rotulo = ROTULO_TELA[item.slot] ?? item.rotulo;
            const cfg = SLOTS_FOTO.find((s) => s.id === item.slot);
            const falta = destacarFaltas && item.situacao === 'pendente';
            const quando = formatarQuando(item.em);
            const erro = pularSlot === item.slot ? undefined : fotosObrig.erros[item.slot];
            return (
              <div key={item.slot} id={`foto-${item.slot}`} className="osf-slot">
                <button
                  type="button" className="osf-slot__btn" data-estado={item.situacao} data-destaque={falta ? 'true' : undefined}
                  disabled={travado || ocupado}
                  aria-label={item.situacao === 'pendente' ? `Tirar foto: ${rotulo}` : item.situacao === 'foto' ? `Ver foto: ${rotulo}` : `${rotulo}: sem foto`}
                  onClick={() => {
                    if (item.situacao === 'pendente') setCameraSlot(item.slot);
                    else if (item.situacao === 'foto' && miniatura) setLightbox(miniatura);
                    else if (item.situacao === 'pulada') setPularSlot(item.slot);
                  }}
                >
                  {item.situacao === 'foto' && miniatura && <img className="osf-slot__img" src={miniatura} alt="" />}
                  {item.situacao === 'pendente' && (<><IconeCamera size={26} /><span>{ocupado ? 'Enviando…' : 'Tirar foto'}</span></>)}
                  {item.situacao === 'foto' && !miniatura && <span>Foto registrada</span>}
                  {item.situacao === 'pulada' && (
                    <>
                      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></svg>
                      <span>Sem foto</span>
                      {item.motivo && <span style={{ fontSize: '0.75rem' }}>{item.motivo}</span>}
                    </>
                  )}
                </button>
                <div className="osf-slot__rotulo">{rotulo}</div>
                {cfg?.dica && <div className="osf-slot__dica">{cfg.dica}</div>}
                {item.situacao !== 'pendente' && quando && <div className="osf-slot__dica">{item.porNome ? `${item.porNome} · ` : ''}{quando}</div>}
                {erro && <div className="osf-slot__erro" role="alert">{erro}</div>}
                {fotosObrig.falhas[item.slot] && <button type="button" className="osf-link" style={{ minHeight: 44 }} onClick={() => void fotosObrig.reenviar(item.slot)}>Tentar de novo</button>}
                {!travado && (
                  <div className="osf-slot__acoes">
                    {item.situacao === 'pendente' && <button type="button" className="osf-link" onClick={() => setPularSlot(item.slot)}>Não consigo tirar</button>}
                    {item.situacao !== 'pendente' && <button type="button" className="osf-link" onClick={() => setCameraSlot(item.slot)}>Refazer</button>}
                    {item.situacao === 'pulada' && <button type="button" className="osf-link" onClick={() => setPularSlot(item.slot)}>Alterar motivo</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!modoAntigo && <p className="osf-nota">Cada foto guarda quem tirou e quando. “Não consigo tirar” pede um motivo curto e conta como resolvida.{carregando ? ' Carregando…' : ''}</p>}

      <div className="osf-sec" style={{ gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Fotos adicionais <span style={{ fontWeight: 500, color: 'var(--color-muted)' }}>· opcional</span></h3>
        <p className="osf-nota">Defeitos, riscos, pontos de atenção — quantas quiser.</p>
        <div><Button variant="secondary" icon={<IconeCamera size={18} />} onClick={() => setCameraExtra(true)} style={{ minHeight: 44 }}>Tirar foto adicional</Button></div>
        <PhotoGrid photos={photos} handlePhotos={handlePhotos} onRemove={removePhoto} onPreview={(src) => setLightbox(src)} />
      </div>

      {cameraSlot && createPortal(
        <CameraCapture
          titulo={ROTULO_TELA[cameraSlot]} dica={SLOTS_FOTO.find((s) => s.id === cameraSlot)?.dica}
          onCapture={(foto) => { const slot = cameraSlot; setCameraSlot(null); void fotosObrig.tirarFoto(slot, foto); }}
          onClose={() => setCameraSlot(null)}
        />, document.body)}
      {cameraExtra && createPortal(
        <CameraCapture titulo="Foto adicional" onCapture={(foto) => { void addPhotoFromCamera(foto); setCameraExtra(false); }} onClose={() => setCameraExtra(false)} />,
        document.body)}
      {pularSlot && itemPular && createPortal(
        <PularFotoSheet
          rotulo={ROTULO_TELA[pularSlot]} motivoAtual={itemPular.situacao === 'pulada' ? itemPular.motivo : undefined}
          ocupado={!!fotosObrig.ocupados[pularSlot]} erro={fotosObrig.erros[pularSlot]}
          onCancelar={() => setPularSlot(null)}
          onConfirmar={async (motivo) => { const ok = await fotosObrig.pular(pularSlot, motivo); if (ok) setPularSlot(null); }}
        />, document.body)}
    </section>
  );
}
