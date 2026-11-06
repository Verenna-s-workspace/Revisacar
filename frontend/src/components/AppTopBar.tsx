import type { ReactNode } from "react";
import "../styles/apptopbar.css";

/**
 * Barra superior global do RevisaCar (layout compacto/mobile).
 *
 * Usada pelos checklists (via <Topbar>) e pelo app geral (<MobileTopbar>).
 *
 * Regras de layout:
 *  - A logo (SÓ o símbolo do carro, sem texto) fica ESTRITAMENTE no centro da
 *    barra: posicionamento absoluto em left:50%, então nenhum botão nas
 *    extremidades consegue empurrá-la para o lado.
 *  - Clicar na logo leva à visão geral (`onLogoClick`).
 *  - Esquerda: por padrão o botão "Voltar" (`onBack` = volta uma etapa do
 *    checklist). Telas sem etapas (app geral) passam outro conteúdo em `start`.
 *  - Direita: `end` (ações da tela).
 *  - `footer`: faixa opcional abaixo da linha (ex.: indicador de salvamento).
 */
interface AppTopBarProps {
  /** Logo → visão geral. Sem a prop, a logo vira só um símbolo (sem clique). */
  onLogoClick?: () => void;
  logoLabel?: string;
  /** Atalho para o botão voltar do slot esquerdo. */
  onBack?: () => void;
  /** Texto visível do botão voltar. */
  backText?: string;
  /** Rótulo para leitores de tela (descreve para onde o botão leva). */
  backAriaLabel?: string;
  /** Substitui o botão voltar (ex.: botão de menu no app geral). */
  start?: ReactNode;
  end?: ReactNode;
  footer?: ReactNode;
  /** Classes extras no elemento raiz (herdam sticky, fundo e safe-area da tela). */
  className?: string;
}

const LOGO_SRC = "/Logorevisavermelha.svg";

export function AppTopBar({
  onLogoClick,
  logoLabel = "Ir para a visão geral",
  onBack,
  backText = "Voltar",
  backAriaLabel = "Voltar uma etapa",
  start,
  end,
  footer,
  className,
}: AppTopBarProps) {
  const left =
    start ??
    (onBack && (
      <button
        type="button"
        className="app-topbar__back"
        onClick={onBack}
        aria-label={backAriaLabel}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>{backText}</span>
      </button>
    ));

  const logoImg = (
    <img src={LOGO_SRC} alt="" width={92} height={92} loading="eager" draggable={false} />
  );

  return (
    <header className={["app-topbar", className].filter(Boolean).join(" ")}>
      <div className="app-topbar__row">
        <div className="app-topbar__side app-topbar__side--start">{left}</div>

        {onLogoClick ? (
          <button
            type="button"
            className="app-topbar__logo"
            onClick={onLogoClick}
            aria-label={logoLabel}
            title={logoLabel}
          >
            {logoImg}
          </button>
        ) : (
          <div className="app-topbar__logo app-topbar__logo--static" role="img" aria-label="RevisaCar">
            {logoImg}
          </div>
        )}

        <div className="app-topbar__side app-topbar__side--end">{end}</div>
      </div>
      {footer}
    </header>
  );
}
