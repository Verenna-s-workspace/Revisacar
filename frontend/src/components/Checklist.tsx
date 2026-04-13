import { useState, useRef, useEffect } from 'react';
import { STATUS_CONFIG, tokens } from '../constants';
import { SectionIcon } from './ui';

// ── ChecklistItem ─────────────────────────────────────────────────────────────

interface ChecklistItemProps {
  sid: string;
  name: string;
  data: { status: string | null; obs: string } | undefined;
  onSetStatus: (key: string, val: string) => void;
  onSetObs: (key: string, val: string) => void;
}

export function ChecklistItem({
  sid,
  name,
  data,
  onSetStatus,
  onSetObs,
}: ChecklistItemProps) {
  const [obsOpen, setObsOpen] = useState(false);
  const key           = `${sid}:${name}`;
  const currentStatus = data?.status ?? null;

  const accentColor =
    currentStatus === 'ok'   ? tokens.color.ok   :
    currentStatus === 'warn' ? tokens.color.warn  :
    currentStatus === 'crit' ? tokens.color.crit  :
    currentStatus === 'na'   ? tokens.color.na    :
    tokens.color.border;

  return (
    <div
      className="checklist-item"
      style={{
        background: tokens.color.surface,
        borderLeft: `2.5px solid ${accentColor}`,
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '11px 16px',
        gap: 12,
        minHeight: 50,
      }}>
        <span style={{
          flex: 1,
          fontSize: '0.86rem',
          color: currentStatus ? tokens.color.text : tokens.color.textSecond,
          transition: 'color 0.12s',
          lineHeight: 1.4,
        }}>
          {name}
        </span>

        {/* Note toggle */}
        <button
          onClick={() => setObsOpen((o) => !o)}
          title={data?.obs ? 'Ver observação' : 'Adicionar observação'}
          style={{
            background: data?.obs ? tokens.color.warnBg : 'none',
            border: data?.obs
              ? `1px solid ${tokens.color.warnBorder}`
              : '1px solid transparent',
            cursor: 'pointer',
            fontFamily: tokens.fontMono,
            fontSize: '0.58rem',
            letterSpacing: '0.06em',
            color: data?.obs ? tokens.color.warn : tokens.color.subtle,
            padding: '3px 8px',
            textTransform: 'uppercase',
            flexShrink: 0,
            borderRadius: tokens.radius.sm,
            transition: tokens.transition.fast,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
          aria-label="Abrir/fechar observação"
        >
          <svg
            width={9} height={9} viewBox="0 0 9 9"
            fill="none" stroke="currentColor"
            strokeWidth={1.3} strokeLinecap="round"
          >
            <path d="M1 1.5h7M1 4.5h5M1 7.5h6" />
          </svg>
          {data?.obs ? 'Nota' : 'Obs.'}
        </button>

        {/* Status buttons */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {Object.entries(STATUS_CONFIG).map(([val, cfg]) => {
            const active = currentStatus === val;
            return (
              <button
                key={val}
                onClick={() => onSetStatus(key, val)}
                style={{
                  fontFamily: tokens.fontMono,
                  fontSize: '0.58rem',
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '0.03em',
                  padding: '4px 10px',
                  border: `1px solid ${active ? cfg.border : tokens.color.border}`,
                  background: active ? cfg.bg : 'transparent',
                  color: active ? cfg.color : tokens.color.subtle,
                  cursor: 'pointer',
                  borderRadius: tokens.radius.sm,
                  transition: 'all 0.12s cubic-bezier(0.4,0,0.2,1)',
                  whiteSpace: 'nowrap',
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Obs textarea */}
      {(obsOpen || data?.obs) && (
        <div style={{
          padding: '0 16px 11px 19px',
          animation: 'fadeUp 0.16s ease forwards',
        }}>
          <textarea
            value={data?.obs || ''}
            onChange={(e) => onSetObs(key, e.target.value)}
            rows={2}
            placeholder="Observação técnica..."
            autoFocus={obsOpen && !data?.obs}
            style={{
              width: '100%',
              fontFamily: tokens.fontSans,
              fontSize: '0.83rem',
              color: tokens.color.text,
              background: tokens.color.bgAlt,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.sm,
              padding: '7px 11px',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.5,
              boxSizing: 'border-box',
              transition: 'border-color 0.18s, box-shadow 0.18s',
            }}
            onFocus={(e) => (e.target.style.borderColor = tokens.color.ferrari)}
            onBlur={(e)  => (e.target.style.borderColor = tokens.color.border)}
          />
        </div>
      )}
    </div>
  );
}

// ── AddItemRow ────────────────────────────────────────────────────────────────

interface AddItemRowProps {
  onAdd: (name: string) => void;
}

function AddItemRow({ onAdd }: AddItemRowProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  }

  const hasValue = value.trim().length > 0;

  return (
    <div style={{
      background: tokens.color.surface,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      borderTop: `1px dashed ${tokens.color.border}`,
    }}>
      {/* + icon */}
      <span style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hasValue ? tokens.color.accentDim : tokens.color.bgAlt,
        border: `1px solid ${hasValue ? tokens.color.ferrari : tokens.color.border}`,
        borderRadius: tokens.radius.sm,
        flexShrink: 0,
        transition: tokens.transition.fast,
      }}>
        <svg
          width={11} height={11} viewBox="0 0 11 11"
          fill="none" stroke={hasValue ? tokens.color.ferrari : tokens.color.subtle}
          strokeWidth={1.8} strokeLinecap="round"
          style={{ transition: tokens.transition.fast }}
        >
          <path d="M5.5 1v9M1 5.5h9" />
        </svg>
      </span>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nome da peça — pressione Enter para adicionar"
        style={{
          flex: 1,
          fontFamily: tokens.fontSans,
          fontSize: '0.83rem',
          color: tokens.color.text,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '4px 0',
          lineHeight: 1.5,
        }}
      />

      <button
        onClick={commit}
        disabled={!hasValue}
        style={{
          fontFamily: tokens.fontMono,
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          padding: '5px 14px',
          background: hasValue ? tokens.color.ferrari : 'transparent',
          color: hasValue ? '#fff' : tokens.color.ghost,
          border: `1px solid ${hasValue ? tokens.color.ferrari : tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          cursor: hasValue ? 'pointer' : 'default',
          transition: tokens.transition.fast,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Adicionar
      </button>
    </div>
  );
}

// ── DynamicItem ───────────────────────────────────────────────────────────────

interface DynamicItemProps {
  sid: string;
  name: string;
  index: number;
  data: { status: string | null; obs: string } | undefined;
  onSetStatus: (key: string, val: string) => void;
  onSetObs: (key: string, val: string) => void;
  onRemove: (index: number) => void;
}

function DynamicItem({
  sid,
  name,
  index,
  data,
  onSetStatus,
  onSetObs,
  onRemove,
}: DynamicItemProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChecklistItem
          sid={sid}
          name={name}
          data={data}
          onSetStatus={onSetStatus}
          onSetObs={onSetObs}
        />
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        title="Remover item"
        style={{
          background: tokens.color.surface,
          border: 'none',
          borderLeft: `1px solid ${tokens.color.border}`,
          cursor: 'pointer',
          padding: '0 14px',
          color: tokens.color.subtle,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: tokens.transition.fast,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color      = tokens.color.crit;
          e.currentTarget.style.background = tokens.color.critBg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color      = tokens.color.subtle;
          e.currentTarget.style.background = tokens.color.surface;
        }}
      >
        <svg
          width={12} height={12} viewBox="0 0 12 12"
          fill="none" stroke="currentColor"
          strokeWidth={1.7} strokeLinecap="round"
        >
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </button>
    </div>
  );
}

// ── ChecklistSection ──────────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  icon: string;
  items: string[];
  isDynamic?: boolean;
}

interface ChecklistSectionProps {
  sec: Section;
  checklist: Record<string, { status: string | null; obs: string }>;
  onSetStatus: (key: string, val: string) => void;
  onSetObs: (key: string, val: string) => void;
  // Props exclusivos de seções dinâmicas — opcionais para seções estáticas
  itensAdicionais?: string[];
  onAddItem?: (name: string) => void;
  onRemoveItem?: (index: number) => void;
}

export function ChecklistSection({
  sec,
  checklist,
  onSetStatus,
  onSetObs,
  itensAdicionais = [],
  onAddItem,
  onRemoveItem,
}: ChecklistSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Seções estáticas usam sec.items; dinâmicas usam itensAdicionais
  const allItems = sec.isDynamic ? itensAdicionais : sec.items;

  const filled = allItems.filter(
    (n) => checklist[`${sec.id}:${n}`]?.status != null
  ).length;

  const isComplete = allItems.length > 0 && filled === allItems.length;
  const hasCrit    = allItems.some(
    (n) => checklist[`${sec.id}:${n}`]?.status === 'crit'
  );
  const progress = allItems.length ? (filled / allItems.length) * 100 : 0;

  return (
    <div style={{
      marginBottom: 24,
      border: `1px solid ${hasCrit ? tokens.color.critBorder : tokens.color.border}`,
      borderRadius: tokens.radius.lg,
      overflow: 'hidden',
      transition: 'border-color 0.18s',
      background: tokens.color.surface,
      boxShadow: tokens.shadow.xs,
    }}>

      {/* ── Section header ── */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '13px 18px',
          background: isComplete
            ? tokens.color.okBg
            : tokens.color.surfaceHigh,
          border: 'none',
          cursor: 'pointer',
          gap: 11,
          borderBottom: collapsed
            ? 'none'
            : `1px solid ${tokens.color.border}`,
          transition: 'background 0.15s',
        }}
      >
        {/* Icon */}
        <span style={{
          color: hasCrit
            ? tokens.color.crit
            : isComplete
              ? tokens.color.ok
              : tokens.color.muted,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          transition: 'color 0.15s',
        }}>
          <SectionIcon id={sec.id} size={15} />
        </span>

        {/* Label */}
        <span style={{
          fontFamily: tokens.fontMono,
          fontSize: '0.7rem',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: hasCrit ? tokens.color.crit : tokens.color.text,
          flex: 1,
          textAlign: 'left',
          transition: 'color 0.15s',
        }}>
          {sec.label}
          {sec.isDynamic && (
            <span style={{
              marginLeft: 8,
              fontFamily: tokens.fontMono,
              fontSize: '0.55rem',
              letterSpacing: '0.08em',
              color: tokens.color.subtle,
              textTransform: 'uppercase',
              background: tokens.color.bgAlt,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.full,
              padding: '1px 7px',
              verticalAlign: 'middle',
            }}>
              dinâmico
            </span>
          )}
        </span>

        {/* Progress pill */}
        <span style={{
          fontFamily: tokens.fontMono,
          fontSize: '0.6rem',
          padding: '2px 9px',
          borderRadius: tokens.radius.full,
          background: isComplete ? tokens.color.okBg : tokens.color.bg,
          border: `1px solid ${
            isComplete ? tokens.color.okBorder : tokens.color.border
          }`,
          color: isComplete ? tokens.color.ok : tokens.color.muted,
          transition: 'all 0.18s',
        }}>
          {filled}/{allItems.length}
        </span>

        {/* Mini progress bar */}
        <div style={{
          width: 52,
          height: 2,
          background: tokens.color.border,
          borderRadius: 1,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: hasCrit
              ? tokens.color.crit
              : isComplete
                ? tokens.color.ok
                : tokens.color.warn,
            borderRadius: 1,
            transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>

        {/* Collapse chevron */}
        <svg
          width={13} height={13} viewBox="0 0 13 13"
          fill="none" stroke={tokens.color.subtle}
          strokeWidth={1.5} strokeLinecap="round"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
            transition: 'transform 0.18s ease',
            flexShrink: 0,
          }}
        >
          <path d="M2.5 4.5l4 4 4-4" />
        </svg>
      </button>

      {/* ── Items ── */}
      {!collapsed && (
        <div style={{
          background: tokens.color.border,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          animation: 'fadeUp 0.18s ease forwards',
        }}>

          {/* Empty state para seções dinâmicas sem itens */}
          {allItems.length === 0 && sec.isDynamic && (
            <div style={{
              background: tokens.color.surface,
              padding: '22px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}>
              <svg
                width={28} height={28} viewBox="0 0 28 28"
                fill="none" stroke={tokens.color.ghost}
                strokeWidth={1.2} strokeLinecap="round"
              >
                <rect x={4} y={6} width={20} height={16} rx={2} />
                <path d="M9 11h10M9 15h6" />
                <path d="M19 19l4 4" strokeWidth={1.5} />
              </svg>
              <span style={{
                fontFamily: tokens.fontMono,
                fontSize: '0.65rem',
                color: tokens.color.ghost,
                textAlign: 'center',
                letterSpacing: '0.04em',
              }}>
                Nenhuma peça adicionada
              </span>
            </div>
          )}

          {/* Static section items */}
          {!sec.isDynamic && allItems.map((name) => (
            <ChecklistItem
              key={name}
              sid={sec.id}
              name={name}
              data={checklist[`${sec.id}:${name}`]}
              onSetStatus={onSetStatus}
              onSetObs={onSetObs}
            />
          ))}

          {/* Dynamic section items com botão de remover */}
          {sec.isDynamic && allItems.map((name, index) => (
            <DynamicItem
              key={`${name}-${index}`}
              sid={sec.id}
              name={name}
              index={index}
              data={checklist[`${sec.id}:${name}`]}
              onSetStatus={onSetStatus}
              onSetObs={onSetObs}
              onRemove={(i) => onRemoveItem?.(i)}
            />
          ))}

          {/* Input para adicionar — só em seções dinâmicas */}
          {sec.isDynamic && (
            <AddItemRow onAdd={(name) => onAddItem?.(name)} />
          )}
        </div>
      )}
    </div>
  );
}