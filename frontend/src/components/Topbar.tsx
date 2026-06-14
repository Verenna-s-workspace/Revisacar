import { useResponsive } from "./ui";
import type { SaveStatus } from "../types";
import "../styles/topbar.css";

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
  const { isDesktop, isMobile } = useResponsive();

  const saveIndicatorClass = [
    "topbar-status",
    saveStatus ? `topbar-status--${saveStatus}` : undefined,
    isDesktop ? "topbar-status--desktop" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const Logo = (
    <div className="topbar__logo">
      <div className="topbar__logo-mark" />
      <img
        src="/Logorevisavermelha.svg"
        alt="Logo RevisaCar"
        width="70"
        height="70"
        loading="eager"
        fetchPriority="high"
      />
      <div>
        <div className="topbar__title">
          Revisa<span>Car</span>
        </div>
        <div className="topbar__subtitle">Inspeção Veicular</div>
      </div>
    </div>
  );

  const SaveIndicator = (
    <div className={saveIndicatorClass}>
      {saveStatus === "saving" && (
        <>
          <svg width={11} height={11} viewBox="0 0 11 11" className="topbar-icon-spin">
            <circle
              cx={5.5}
              cy={5.5}
              r={4}
              fill="none"
              stroke="var(--color-ghost)"
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
            width={11}
            height={11}
            viewBox="0 0 11 11"
            fill="none"
            stroke="var(--color-ok)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1.5,5.5 4,8 9,2.5" />
          </svg>
          <span>salvo às {savedAt}</span>
        </>
      )}
      {saveStatus === "error" && (
        <>
          <svg
            width={11}
            height={11}
            viewBox="0 0 11 11"
            fill="none"
            stroke="var(--color-crit)"
            strokeWidth={1.5}
            strokeLinecap="round"
          >
            <circle cx={5.5} cy={5.5} r={4} />
            <line x1="5.5" y1="3.5" x2="5.5" y2="5.8" />
            <circle cx="5.5" cy="7.5" r="0.5" fill="var(--color-crit)" stroke="none" />
          </svg>
          <span>erro ao fazer envio para o db</span>
        </>
      )}
    </div>
  );

  const buttonClass = (accent = false, small = false) => [
    "topbar-button",
    accent ? "topbar-button--accent" : undefined,
    small ? "topbar-button--small" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  if (isDesktop) {
    return (
      <nav className="topbar topbar--desktop topbar-glass">
        <div className="topbar__inner">
          {Logo}
          <div className="topbar__actions">
            {SaveIndicator}
            {onBackToStart && (
              <button className={buttonClass()} onClick={onBackToStart}>
                ← Voltar
              </button>
            )}
            <button className={buttonClass()} onClick={onReset}>
              Limpar tudo
            </button>
            <button className={buttonClass(true)} onClick={onExportPDF}>
              <svg
                width={11}
                height={11}
                viewBox="0 0 11 11"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              >
                <path d="M5.5 1v6.5M3 5l2.5 2.5L8 5M1 9.5h9" />
              </svg>
              Gerar PDF
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="topbar topbar--mobile topbar-glass">
      <div className="topbar-mobile-row">
        <div className="topbar-mobile-slot">
          {onBackToStart ? (
            <button className={buttonClass(false, true)} onClick={onBackToStart}>
              ←{!isMobile && " Voltar"}
            </button>
          ) : (
            <div />
          )}
        </div>
        <div className="topbar-mobile-logo">{Logo}</div>
        <div className="topbar-mobile-end">
          <button className={buttonClass(true)} onClick={onExportPDF}>
            <svg
              width={11}
              height={11}
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <path d="M5.5 1v6.5M3 5l2.5 2.5L8 5M1 9.5h9" />
            </svg>
            {!isMobile && " Gerar PDF"}
          </button>
        </div>
      </div>
      <div className="topbar-row-separator">
        {SaveIndicator}
        <button className="topbar-button topbar-button--smaller" onClick={onReset}>
          Limpar tudo
        </button>
      </div>
    </nav>
  );
}