import { useState } from 'react';
import { Icons } from '../Icons';
import {
  Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalRow, ModalRows, ModalSection, ModalTabs,
} from '../../../components/system';
import { LEARNING_MODULES } from './modules';
import type { LearningModule } from './modules';

interface LearningCenterModalProps {
  onClose: () => void;
}

export function LearningCenterModal({ onClose }: LearningCenterModalProps) {
  // Sempre começa do módulo 1 — a central não guarda progresso entre aberturas.
  const [index, setIndex] = useState(0);
  const total = LEARNING_MODULES.length;
  const mod = LEARNING_MODULES[index];

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(total - 1, i + 1));
  const atStart = index === 0;
  const atEnd = index === total - 1;

  const tabs = LEARNING_MODULES.map((m, i) => ({ value: String(i), label: m.label }));

  return (
    <Modal size="xl" onClose={onClose}>
      <ModalHeader
        icon={Icons.help}
        title="Central de Aprendizado"
        description={`Módulo ${index + 1} de ${total} · ${mod.label}`}
      />

      <ModalTabs label="Módulos" value={String(index)} tabs={tabs} onChange={v => setIndex(Number(v))} />

      <ModalBody>
        {/* Altura mínima: o rodapé (Anterior/Próximo) não pula de lugar ao trocar de módulo. */}
        <div style={{ minHeight: 'min(52dvh, 460px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ModalSection icon={mod.icon} title={mod.title} description={mod.description}>
            <VideoBlock module={mod} />
          </ModalSection>

          <ModalSection icon={Icons.lightbulb} title="O que você vai ver">
            <ModalRows label="O que você vai ver neste módulo">
              {mod.highlights.map(h => (
                <ModalRow key={h} leading={<span className="sys-modal__row-icon">{Icons.check}</span>} title={h} />
              ))}
            </ModalRows>
          </ModalSection>
        </div>
      </ModalBody>

      <ModalFooter
        hint={
          <div className="sys-modal__progress">
            <span className="sys-modal__progress-texto">{index + 1} de {total}</span>
            <div className="sys-modal__progress-dots" aria-hidden="true">
              {LEARNING_MODULES.map((m, i) => (
                <span key={m.id} className={`sys-modal__progress-dot${i === index ? ' sys-modal__progress-dot--ativo' : ''}`} />
              ))}
            </div>
          </div>
        }
      >
        <Button variant="secondary" icon={Icons.chevL} onClick={goPrev} disabled={atStart}>Anterior</Button>
        <Button variant="primary" onClick={goNext} disabled={atEnd}>Próximo {Icons.arrow}</Button>
      </ModalFooter>
    </Modal>
  );
}

function VideoBlock({ module }: { module: LearningModule }) {
  if (module.videoUrl) {
    return (
      <div className="sys-modal__video">
        <iframe
          src={module.videoUrl}
          title={module.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <div className="sys-modal__video sys-modal__video--vazio">
      {Icons.play}
      <span className="sys-modal__video-legenda">Vídeo em breve</span>
    </div>
  );
}
