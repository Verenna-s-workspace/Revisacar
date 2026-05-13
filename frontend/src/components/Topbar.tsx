import { useState } from "react";
import { tokens } from "../constants";
import { useResponsive } from "./ui";
import type { SaveStatus } from "../types";

interface TopbarProps {
  saveStatus: SaveStatus;
  savedAt: string | null;
  onReset: () => void;
  onExportPDF: () => void;
  onBackToStart?: () => void;
}

export function Topbar({
  saveStatus,
  savedAt,
  onReset,
  onExportPDF,
  onBackToStart,
}: TopbarProps) {
  const [resetHover, setResetHover] = useState(false);
  const [exportHover, setExportHover] = useState(false);
  const [backHover, setBackHover] = useState(false);
  const { isDesktop, isMobile } = useResponsive();

  // ── Logo (shared between layouts) ──────────────────────────────────────────
  const Logo = (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      <div
        style={{
          width: 3,
          height: 28,
          background: tokens.color.ferrari,
          borderRadius: 1.5,
          marginRight: 0,
          flexShrink: 0,
        }}
      />
      <img
        src="/Logorevisavermelha.svg"
        alt="Logo RevisaCar"
        width="70"
        height="70"
        loading="eager"
        fetchPriority="high"
      />
      <div>
        <div
          style={{
            marginLeft: -10,
            fontFamily: tokens.fontLogo,
            fontSize: "1.02rem",
            fontWeight: 500,
            color: tokens.color.text,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Revisa
          <span style={{ color: tokens.color.ferrari, fontFamily: tokens.fontLogo }}>
            Car
          </span>
        </div>
        <div
          style={{
            marginLeft: -10,
            whiteSpace: "nowrap",
            fontFamily: tokens.fontMono,
            fontSize: "0.54rem",
            color: tokens.color.ghost,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Inspeção Veicular
        </div>
      </div>
    </div>
  );

  // ── Save status indicator ───────────────────────────────────────────────────
  const SaveIndicator = (
    <div
      style={{
        fontFamily: tokens.fontMono,
        fontSize: "0.64rem",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: tokens.transition.base,
        opacity: saveStatus ? 1 : 0,
        color: tokens.color.muted,
        // on desktop keep fixed minWidth so layout doesn't jump
        ...(isDesktop ? { minWidth: 156, justifyContent: "flex-end" } : {}),
      }}
    >
      {saveStatus === "saving" && (
        <>
          <svg
            width={11}
            height={11}
            viewBox="0 0 11 11"
            style={{ animation: "spin 1s linear infinite" }}
          >
            <circle
              cx={5.5} cy={5.5} r={4}
              fill="none"
              stroke={tokens.color.ghost}
              strokeWidth={1.5}
              strokeDasharray="6 6"
            />
          </svg>
          <span>salvando...</span>
        </>
      )}
      {saveStatus === "saved" && (
        <>
          <svg
            width={11} height={11} viewBox="0 0 11 11"
            fill="none" stroke={tokens.color.ok}
            strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="1.5,5.5 4,8 9,2.5" />
          </svg>
          <span style={{ color: tokens.color.ok }}>salvo às {savedAt}</span>
        </>
      )}
      {saveStatus === "error" && (
        <>
          <svg
            width={11} height={11} viewBox="0 0 11 11"
            fill="none" stroke={tokens.color.crit}
            strokeWidth={1.5} strokeLinecap="round"
          >
            <circle cx={5.5} cy={5.5} r={4} />
            <line x1="5.5" y1="3.5" x2="5.5" y2="5.8" />
            <circle cx="5.5" cy="7.5" r="0.5" fill={tokens.color.crit} stroke="none" />
          </svg>
          <span style={{ color: tokens.color.crit }}>erro ao fazer envio para o db</span>
        </>
      )}
    </div>
  );

  // ── Shared button styles ────────────────────────────────────────────────────
  const ghostBtn = (hovered: boolean): React.CSSProperties => ({
    fontFamily: tokens.fontMono,
    fontSize: "0.64rem",
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "7px 15px",
    borderRadius: tokens.radius.md,
    border: `1px solid ${hovered ? tokens.color.borderHigh : tokens.color.border}`,
    background: hovered ? tokens.color.surfaceHigh : "transparent",
    color: hovered ? tokens.color.textSecond : tokens.color.subtle,
    cursor: "pointer",
    transition: tokens.transition.fast,
  });

  const accentBtn = (hovered: boolean): React.CSSProperties => ({
    fontFamily: tokens.fontMono,
    fontSize: "0.64rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "7px 16px",
    borderRadius: tokens.radius.md,
    border: "none",
    background: hovered ? tokens.color.accentHover : tokens.color.ferrari,
    color: "#fff",
    cursor: "pointer",
    transition: tokens.transition.fast,
    boxShadow: hovered
      ? "0 2px 8px rgba(204,20,0,0.35)"
      : "0 1px 3px rgba(204,20,0,0.25)",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  });

  // ── DESKTOP layout (≥980px) — original, unchanged ──────────────────────────
  if (isDesktop) {
    return (
      <nav
        className="topbar-glass"
        style={{
          background: "rgba(247,246,243,0.9)",
          borderBottom: `1px solid ${tokens.color.border}`,
          padding: "0 40px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 300,
        }}
      >
        {Logo}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {SaveIndicator}

          {onBackToStart && (
            <button
              onClick={onBackToStart}
              onMouseEnter={() => setBackHover(true)}
              onMouseLeave={() => setBackHover(false)}
              style={ghostBtn(backHover)}
            >
              ← Voltar
            </button>
          )}

          <button
            onClick={onReset}
            onMouseEnter={() => setResetHover(true)}
            onMouseLeave={() => setResetHover(false)}
            style={ghostBtn(resetHover)}
          >
            Limpar tudo
          </button>

          <button
            onClick={onExportPDF}
            onMouseEnter={() => setExportHover(true)}
            onMouseLeave={() => setExportHover(false)}
            style={accentBtn(exportHover)}
          >
            <svg
              width={11} height={11} viewBox="0 0 11 11"
              fill="none" stroke="currentColor"
              strokeWidth={1.5} strokeLinecap="round"
            >
              <path d="M5.5 1v6.5M3 5l2.5 2.5L8 5M1 9.5h9" />
            </svg>
            Gerar PDF
          </button>
        </div>
      </nav>
    );
  }

  // ── MOBILE / TABLET layout (<980px) ────────────────────────────────────────
  // Row 1: [← Voltar]   [Logo centrado]   [Gerar PDF]
  // Row 2 (thin): save status + limpar, centrados
  return (
    <nav
      className="topbar-glass"
      style={{
        background: "rgba(247,246,243,0.9)",
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: "0 16px",
        position: "sticky",
        top: 0,
        zIndex: 300,
      }}
    >
      {/* Row 1 — logo centrada com ações nas pontas */}
      <div
        style={{
          height: 56,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
        }}
      >
        {/* Left slot: Voltar (ou espaço vazio) */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          {onBackToStart ? (
            <button
              onClick={onBackToStart}
              onMouseEnter={() => setBackHover(true)}
              onMouseLeave={() => setBackHover(false)}
              style={{ ...ghostBtn(backHover), padding: "7px 10px" }}
            >
              ←{!isMobile && " Voltar"}
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Center: Logo */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {Logo}
        </div>

        {/* Right slot: Gerar PDF */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onExportPDF}
            onMouseEnter={() => setExportHover(true)}
            onMouseLeave={() => setExportHover(false)}
            style={{ ...accentBtn(exportHover), padding: "7px 12px" }}
          >
            <svg
              width={11} height={11} viewBox="0 0 11 11"
              fill="none" stroke="currentColor"
              strokeWidth={1.5} strokeLinecap="round"
            >
              <path d="M5.5 1v6.5M3 5l2.5 2.5L8 5M1 9.5h9" />
            </svg>
            {!isMobile && "Gerar PDF"}
          </button>
        </div>
      </div>

      {/* Row 2 — save status + limpar (thin strip) */}
      <div
        style={{
          borderTop: `1px solid ${tokens.color.border}`,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 2,
        }}
      >
        {SaveIndicator}

        <button
          onClick={onReset}
          onMouseEnter={() => setResetHover(true)}
          onMouseLeave={() => setResetHover(false)}
          style={{
            ...ghostBtn(resetHover),
            padding: "4px 10px",
            fontSize: "0.58rem",
          }}
        >
          Limpar tudo
        </button>
      </div>
    </nav>
  );
}