import { useState, useEffect } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { StatusBadge, Skeleton, OS_STATUS_TOM, rotuloStatusOS } from './Primitives';
import { Sidebar, MobileNav, MobileSafeTop } from './Navigation';
import { DesktopShell } from '../../components/DesktopShell';
import { DesktopTopBar } from '../../components/DesktopTopBar';
import { useAbrirRegistro } from '../../hooks/useAbrirRegistro';
import { api } from '../../utils/api';
import { mensagemDoErro } from '../../utils/api_erro';
import { Input } from '../../components/inputs/input';
import {
  Button, Modal, ModalBadge, ModalBody, ModalDetail, ModalDetails, ModalFooter, ModalHeader, ModalSection,
} from '../../components/system';
import { formatCpfCnpj, formatPhoneBR, formatKm } from '../../components/inputs/masks';
import type { AbrirRegistro } from '../../types/busca';
import type { OrdemRow, NavPage } from '../../types/dashboard';
import { OrdensDesktop } from './Ordens/OrdensDesktop';
import { OrdensMobile } from './Ordens/OrdensMobile';
import type { FiltroStatus } from './Ordens/ordensUtils';
// ── Date formatter ────────────────────────────────────────────────────────────

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ', ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── OSRow ─────────────────────────────────────────────────────────────────────

export function OSRow({ ordem, onClick }: { ordem: OrdemRow; onClick: () => void }) {
  // A margem negativa (pro fundo do hover encostar na borda do card) vem do
  // CSS: era -20px fixo e, na tela de Ordens (padding 14px), gerava rolagem
  // horizontal no celular. role/tabIndex: a linha abre a OS também pelo teclado.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir OS ${ordem.os_num} de ${ordem.cliente}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="dashboard-order-row"
    >
      <div className="dashboard-order-row__icon" style={{ width: 52, height: 40, borderRadius: 8, background: tokens.color.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted, flexShrink: 0 }}>
        {Icons.car}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: tokens.color.text }}>OS #{ordem.os_num}</div>
        <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 1 }}>
          Cliente: {ordem.cliente}
        </div>
        {/* A lista de OS não traz os serviços: aqui é o veículo (antes vinha rotulado como "Serviço"). */}
        <div style={{ fontSize: '0.75rem', color: tokens.color.subtle, marginTop: 1 }}>
          Veículo: {[ordem.modelo, ordem.placa].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="dashboard-order-row__status">
        <StatusBadge status={ordem.status} />
        <span style={{ fontSize: '0.75rem', color: tokens.color.muted }}>{formatDate(ordem.created_at)}</span>
      </div>
    </div>
  );
}

// ── OSModal ───────────────────────────────────────────────────────────────────

interface OSModalProps {
  ordem: OrdemRow;
  onClose: () => void;
  onEdit: () => void;
}

export function OSModal({ ordem, onClose, onEdit }: OSModalProps) {
  const raw = ordem.payload;
  const pl = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw ?? {});
  const h = pl.os_header ?? {}, cli = pl.cliente ?? {}, vei = pl.veiculo ?? {}, tec = pl.tecnico ?? {};
  const dataBR = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

  return (
    <Modal size="lg" onClose={onClose}>
      <ModalHeader
        icon={Icons.orders}
        title={`OS #${ordem.os_num}`}
        description={new Date(ordem.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        meta={<ModalBadge tone={OS_STATUS_TOM[ordem.status] ?? 'info'}>{rotuloStatusOS(ordem.status)}</ModalBadge>}
      />

      <ModalBody>
        <ModalSection icon={Icons.clipboardCheck} title="Identificação">
          <ModalDetails>
            <ModalDetail label="Nº OS">{h.os_num || ordem.os_num}</ModalDetail>
            <ModalDetail label="Data">{dataBR(h.os_date)}</ModalDetail>
            <ModalDetail label="Hora">{h.os_time}</ModalDetail>
            <ModalDetail label="KM">{formatKm(h.os_km)}</ModalDetail>
          </ModalDetails>
        </ModalSection>

        <ModalSection icon={Icons.user} title="Cliente">
          <ModalDetails>
            <ModalDetail label="Nome">{cli.nome || ordem.cliente}</ModalDetail>
            <ModalDetail label="Documento" mono>{formatCpfCnpj(cli.doc)}</ModalDetail>
            <ModalDetail label="Telefone">{formatPhoneBR(cli.tel)}</ModalDetail>
            <ModalDetail label="E-mail">{cli.email}</ModalDetail>
          </ModalDetails>
        </ModalSection>

        <ModalSection icon={Icons.car} title="Veículo">
          <ModalDetails>
            <ModalDetail label="Placa" mono>{vei.placa || ordem.placa}</ModalDetail>
            <ModalDetail label="Modelo">{vei.modelo || ordem.modelo}</ModalDetail>
            <ModalDetail label="Ano">{vei.ano}</ModalDetail>
            <ModalDetail label="Cor">{vei.cor}</ModalDetail>
            <ModalDetail label="Combustível">{vei.combustivel}</ModalDetail>
          </ModalDetails>
        </ModalSection>

        {tec.nome && (
          <ModalSection icon={Icons.wrench} title="Técnico">
            <ModalDetails>
              <ModalDetail label="Nome">{tec.nome}</ModalDetail>
              <ModalDetail label="Registro">{tec.registro}</ModalDetail>
              <ModalDetail label="Data de saída">{dataBR(tec.data_saida)}</ModalDetail>
              <ModalDetail label="KM de saída">{formatKm(tec.km_saida)}</ModalDetail>
              {tec.parecer_geral && <ModalDetail label="Parecer geral" wide>{tec.parecer_geral}</ModalDetail>}
            </ModalDetails>
          </ModalSection>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button variant="primary" icon={Icons.edit} onClick={onEdit}>Editar</Button>
      </ModalFooter>
    </Modal>
  );
}

// ── OrdensPage ────────────────────────────────────────────────────────────────
// Desktop e celular: telas redesenhadas em ./Ordens (OrdensDesktop / OrdensMobile).
// OSRow continua exportado porque outras telas ainda usam.

interface OrdensPageProps {
  ordens: OrdemRow[];
  loading: boolean;
  onNewOS: () => void;
  onLoadOS?: (id: string) => void;
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  /** Busca global (⌘K): abre o modal de resumo desta OS assim que a lista carregar. */
  abrirRegistro?: AbrirRegistro | null;
  onRegistroAberto?: () => void;
}

export function OrdensPage({ ordens, loading, onNewOS, onLoadOS, onNav, isMobile, abrirRegistro, onRegistroAberto }: OrdensPageProps) {
  const [filter, setFilter] = useState<FiltroStatus>('todas');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<OrdemRow | null>(null);
  const [del, setDel] = useState<string | null>(null);

  useAbrirRegistro({ pedido: abrirRegistro, tipo: 'ordem', pronto: !loading, itens: ordens, idDe: o => o.id, abrir: setSel, consumido: onRegistroAberto });

  const handleDel = async (id: string) => {
    if (!window.confirm('Excluir esta OS permanentemente?')) return;
    setDel(id);
    try { await api.deletarOrdem(id); window.location.reload(); } catch (e) { setDel(null); window.alert(mensagemDoErro(e, 'Não foi possível excluir a OS. Tente de novo.')); }
  };

  const modal = sel && (
    <OSModal ordem={sel} onClose={() => setSel(null)} onEdit={() => { onLoadOS?.(sel.id); setSel(null); }} />
  );

  if (!isMobile) {
    return (
      <>
        <DesktopShell page="ordens" onNav={onNav} onNewOS={onNewOS}>
          <OrdensDesktop
            ordens={ordens}
            loading={loading}
            filtro={filter}
            onFiltro={setFilter}
            busca={search}
            onBusca={setSearch}
            onNewOS={onNewOS}
            onAbrir={setSel}
            onEditar={id => onLoadOS?.(id)}
            onExcluir={handleDel}
            excluindoId={del}
          />
        </DesktopShell>
        {modal}
      </>
    );
  }

  // ── Celular: lista redesenhada em ./Ordens (OrdensMobile) ──
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
      <MobileSafeTop />
      <OrdensMobile
        ordens={ordens}
        loading={loading}
        onAbrir={setSel}
        onEditar={id => onLoadOS?.(id)}
        onExcluir={handleDel}
        excluindoId={del}
      />
      {modal}
      <MobileNav active="ordens" onNav={onNav} onNewOS={onNewOS} />
    </div>
  );
}