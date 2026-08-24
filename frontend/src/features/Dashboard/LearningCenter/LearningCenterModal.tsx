import { useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { useResponsive } from '../../../components/ui';
import { LEARNING_MODULES } from './modules';
import type { LearningModule } from './modules';

interface LearningCenterModalProps {
  onClose: () => void;
}

export function LearningCenterModal({ onClose }: LearningCenterModalProps) {
  const { isMobile } = useResponsive();
  // Sempre começa do módulo 1 — a central não guarda progresso entre aberturas.
  const [index, setIndex] = useState(0);
  const total = LEARNING_MODULES.length;
  const mod = LEARNING_MODULES[index];

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(total - 1, i + 1));
  const atStart = index === 0;
  const atEnd = index === total - 1;

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Central de Aprendizado"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isMobile ? '100%' : 960,
          height: isMobile ? '100%' : 'min(88vh, 720px)',
          maxHeight: isMobile ? '100%' : '88vh',
          background: 'white',
          borderRadius: isMobile ? 0 : 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header — título fixo + fechar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '14px 16px' : '16px 22px',
          borderBottom: `1px solid ${tokens.color.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ color: tokens.color.ferrari, display: 'flex' }}>{Icons.help}</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: tokens.color.text }}>Central de Aprendizado</span>
          </div>
          <button onClick={onClose} className="dashboard-button--close" aria-label="Fechar">×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: isMobile ? 'column' : 'row' }}>
          {isMobile ? (
            /* Navegação mobile: tira horizontal de chips, uma linha, rolável */
            <div style={{
              display: 'flex', gap: 8, padding: '12px 14px', overflowX: 'auto',
              borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0,
              WebkitOverflowScrolling: 'touch',
            }}>
              {LEARNING_MODULES.map((m, i) => {
                const active = i === index;
                return (
                  <button
                    key={m.id}
                    onClick={() => setIndex(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      padding: '7px 12px', borderRadius: 99,
                      border: `1px solid ${active ? tokens.color.ferrari : tokens.color.border}`,
                      background: active ? tokens.color.ferrariMid : 'transparent',
                      color: active ? tokens.color.ferrari : tokens.color.muted,
                      fontWeight: active ? 700 : 500, fontSize: '0.78rem',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ display: 'flex', color: tokens.color.ferrari }}>{m.icon}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Navegação desktop: sidebar vertical fixa */
            <nav style={{
              width: 250, flexShrink: 0, borderRight: `1px solid ${tokens.color.border}`,
              padding: 12, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto',
            }}>
              {LEARNING_MODULES.map((m, i) => {
                const active = i === index;
                return (
                  <button
                    key={m.id}
                    onClick={() => setIndex(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 12px', borderRadius: 10, border: 'none', textAlign: 'left',
                      background: active ? tokens.color.ferrariMid : 'transparent',
                      color: active ? tokens.color.ferrari : tokens.color.textSecond,
                      fontWeight: active ? 700 : 500, fontSize: '0.85rem',
                      cursor: 'pointer', transition: 'background 0.12s',
                    }}
                  >                                                                      {/* RETIREI m.icons */}
                    <span style={{ display: 'flex', flexShrink: 0, color: tokens.color.ferrari }}>{}</span>
                    <span style={{ flex: 1 }}>{m.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Conteúdo do módulo atual */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: isMobile ? '20px 16px' : '28px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: tokens.color.ferrari, marginBottom: 10 }}>
              <span style={{ display: 'flex' }}>{mod.icon}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Módulo {index + 1}
              </span>
            </div>
            <h1 style={{ fontSize: isMobile ? '1.4rem' : '1.7rem', fontWeight: 800, color: tokens.color.text, margin: '0 0 8px', lineHeight: 1.15 }}>
              {mod.title}
            </h1>
            <p style={{ fontSize: '0.92rem', color: tokens.color.muted, margin: '0 0 22px', lineHeight: 1.5 }}>
              {mod.description}
            </p>

            <VideoBlock module={mod} />

            <div style={{
              marginTop: 20, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`,
              borderRadius: 14, padding: isMobile ? 16 : 20,
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: tokens.color.ferrariMid, color: tokens.color.ferrari,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {Icons.lightbulb}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: tokens.color.text, marginBottom: 10 }}>
                  O que você vai ver
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {mod.highlights.map((h) => (
                    <li key={h} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: '0.85rem', color: tokens.color.textSecond, lineHeight: 1.45 }}>
                      <span style={{ color: tokens.color.ok, flexShrink: 0, marginTop: 2, display: 'flex' }}>{Icons.check}</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé: anterior / progresso / próximo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '14px 22px',
          borderTop: `1px solid ${tokens.color.border}`, flexShrink: 0, gap: 10,
        }}>
          <button
            onClick={goPrev}
            disabled={atStart}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9,
              border: `1px solid ${tokens.color.border}`, background: 'transparent',
              color: atStart ? tokens.color.ghost : tokens.color.text,
              fontWeight: 600, fontSize: '0.8rem', cursor: atStart ? 'default' : 'pointer',
            }}
          >
            <span style={{ display: 'flex' }}>{Icons.chevL}</span>
            {!isMobile && 'Anterior'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: tokens.color.muted, fontFamily: tokens.fontMono }}>
              {index + 1} de {total}
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              {LEARNING_MODULES.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    width: i === index ? 16 : 5, height: 4, borderRadius: 99,
                    background: i === index ? tokens.color.ferrari : tokens.color.border,
                    transition: 'width 0.15s, background 0.15s',
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={atEnd}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
              border: 'none',
              background: atEnd ? tokens.color.border : tokens.color.ferrari,
              color: atEnd ? tokens.color.muted : 'white',
              fontWeight: 700, fontSize: '0.8rem', cursor: atEnd ? 'default' : 'pointer',
              boxShadow: atEnd ? 'none' : tokens.shadow.ferrari,
            }}
          >
            {!isMobile && 'Próximo'}
            <span style={{ display: 'flex' }}>{Icons.arrow}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoBlock({ module }: { module: LearningModule }) {
  if (module.videoUrl) {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
        <iframe
          src={module.videoUrl}
          title={module.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    );
  }
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 14,
      background: tokens.color.surfaceHigh, border: `1.5px dashed ${tokens.color.borderMd}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%', background: tokens.color.bg,
        border: `1px solid ${tokens.color.border}`, color: tokens.color.ghost,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {Icons.play}
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: tokens.color.subtle }}>Vídeo em breve</span>
    </div>
  );
}
