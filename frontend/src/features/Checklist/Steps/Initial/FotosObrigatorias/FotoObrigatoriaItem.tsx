import { tokens } from '../../../../../constants';
import { btnAccent, btnSolid, useResponsive } from '../../../../../components/ui';
import { formatarQuando, type ItemFoto } from '../../../../../utils/fotos_obrigatorias';
import { IconeCamera, IconeCheck, IconeSlot } from './IconesFoto';

interface FotoObrigatoriaItemProps {
  item: ItemFoto;
  miniatura?: string;
  /** Enviando/registrando agora. */
  ocupado?: boolean;
  /** Mensagem de erro do último envio. */
  erro?: string;
  /** Há uma foto já comprimida esperando "Tentar de novo". */
  podeReenviar?: boolean;
  /** Realça como pendente (o usuário tentou avançar sem ela). */
  destacar?: boolean;
  /** Sem OS ainda, ou OS que já não aceita mudança. */
  desabilitado?: boolean;
  /** OS já passou da entrada: o registro não muda mais, então não mostra os botões (só o estado). */
  somenteLeitura?: boolean;
  onTirar: () => void;
  onPular: () => void;
  onReenviar: () => void;
  onVerFoto: (src: string) => void;
}

/** Uma linha das 5 fotos obrigatórias: ícone, estado (pendente / miniatura / pulada) e os botões. */
export function FotoObrigatoriaItem({
  item, miniatura, ocupado, erro, podeReenviar, destacar, desabilitado, somenteLeitura,
  onTirar, onPular, onReenviar, onVerFoto,
}: FotoObrigatoriaItemProps) {
  const { isMobile } = useResponsive();
  const { situacao } = item;
  const travado = !!ocupado || !!desabilitado;

  const cor = situacao === 'foto' ? tokens.color.ok : situacao === 'pulada' ? tokens.color.warn : destacar ? tokens.color.crit : tokens.color.muted;
  const fundo = situacao === 'foto' ? tokens.color.okBg : situacao === 'pulada' ? tokens.color.warnBg : destacar ? tokens.color.critBg : tokens.color.surface;
  const borda = situacao === 'foto' ? tokens.color.okBorder : situacao === 'pulada' ? tokens.color.warnBorder : destacar ? tokens.color.critBorder : tokens.color.borderMd;

  const quando = formatarQuando(item.em);
  const quem = [item.porNome, quando].filter(Boolean).join(' · ');
  const rotuloEstado = ocupado ? 'Enviando…' : situacao === 'foto' ? 'Foto ok' : situacao === 'pulada' ? 'Pulada' : 'Pendente';

  const botaoPrincipal: React.CSSProperties = {
    ...(situacao === 'pendente' ? btnAccent : btnSolid),
    justifyContent: 'center', minHeight: 48, fontSize: '0.8rem',
    width: isMobile ? '100%' : undefined, flex: isMobile ? undefined : '0 0 auto',
    opacity: travado ? 0.5 : 1, cursor: travado ? 'not-allowed' : 'pointer',
  };
  const botaoSecundario: React.CSSProperties = {
    background: 'transparent', border: 'none', color: tokens.color.muted, textDecoration: 'underline',
    fontFamily: tokens.fontSans, fontSize: '0.88rem', minHeight: 44, padding: '8px 12px',
    cursor: travado ? 'not-allowed' : 'pointer', opacity: travado ? 0.5 : 1,
    width: isMobile ? '100%' : undefined,
  };

  return (
    <section
      id={`foto-${item.slot}`}
      aria-label={`Foto obrigatória: ${item.rotulo}`}
      style={{
        border: `1.5px ${situacao === 'pendente' ? 'dashed' : 'solid'} ${borda}`,
        background: fundo, borderRadius: tokens.radius.lg, padding: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {situacao === 'foto' && miniatura ? (
          <button
            type="button"
            onClick={() => onVerFoto(miniatura)}
            aria-label={`Ver foto: ${item.rotulo}`}
            style={{ width: 64, height: 64, padding: 0, border: `1px solid ${borda}`, borderRadius: tokens.radius.md, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: '#000' }}
          >
            <img src={miniatura} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ) : (
          <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: tokens.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cor, background: tokens.color.bgAlt }}>
            <IconeSlot slot={item.slot} size={30} />
          </div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: tokens.fontSans, fontSize: '1rem', fontWeight: 700, color: tokens.color.text }}>{item.rotulo}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: tokens.fontMono, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: cor }}>
              {situacao === 'foto' && !ocupado && <IconeCheck size={12} />}
              {rotuloEstado}
            </span>
          </div>
          {situacao === 'pendente' && item.dica && (
            <div style={{ fontFamily: tokens.fontSans, fontSize: '0.82rem', color: tokens.color.muted, marginTop: 2 }}>{item.dica}</div>
          )}
          {situacao === 'pulada' && (
            <div style={{ fontFamily: tokens.fontSans, fontSize: '0.88rem', color: tokens.color.textSecond, marginTop: 2, overflowWrap: 'anywhere' }}>
              Motivo: {item.motivo}
            </div>
          )}
          {situacao !== 'pendente' && quem && (
            <div style={{ fontFamily: tokens.fontMono, fontSize: '0.75rem', color: tokens.color.subtle, marginTop: 2 }}>
              {situacao === 'foto' ? 'Tirada por' : 'Pulada por'} {quem}{item.refeitas ? ` · refeita ${item.refeitas}x` : ''}
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div role="alert" style={{ color: tokens.color.crit, fontFamily: tokens.fontSans, fontSize: '0.85rem' }}>{erro}</div>
      )}

      {!somenteLeitura && <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 6, alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap' }}>
        {podeReenviar ? (
          <button type="button" disabled={travado} onClick={onReenviar} style={{ ...btnAccent, justifyContent: 'center', minHeight: 48, fontSize: '0.8rem', width: isMobile ? '100%' : undefined, opacity: travado ? 0.5 : 1 }}>
            Tentar enviar de novo
          </button>
        ) : null}
        <button type="button" disabled={travado} onClick={onTirar} aria-label={`${situacao === 'foto' ? 'Refazer' : 'Tirar'} foto: ${item.rotulo}`} style={botaoPrincipal}>
          <IconeCamera />
          {situacao === 'foto' ? 'Refazer foto' : situacao === 'pulada' ? 'Tirar a foto agora' : 'Tirar foto'}
        </button>
        {situacao !== 'foto' && (
          <button type="button" disabled={travado} onClick={onPular} style={botaoSecundario}>
            {situacao === 'pulada' ? 'Alterar motivo' : 'Não consigo tirar esta foto'}
          </button>
        )}
      </div>}
    </section>
  );
}
