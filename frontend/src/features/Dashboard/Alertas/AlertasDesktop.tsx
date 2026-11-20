

import { useEffect, useMemo, useRef, useState } from 'react';
import { tokens } from '../../../constants';
import { Skeleton } from '../Primitives';
import { ProdutoModal } from '../Estoque/ProdutoModal';
import { TransacaoModal } from '../Financeiro/TransacaoModal';
import { Input } from '../../../components/inputs/input';
import { api } from '../../../utils/api';
import { limparOpcionais, mensagemDoErro } from '../../../utils/api_erro';
import { telefoneParaWhatsApp } from '../../../utils/orcamento_link_utils';
import { OPCOES_ADIAR, formatarAte, maisGrave } from '../../../utils/alertas';
import type { AcaoAlerta, AlertaEscondido, AlertaItem, FonteAlertaId, GrupoAlertas, SeveridadeAlerta } from '../../../utils/alertas';
import type { EstoqueItem, NovoEstoqueItemInput } from '../../../types/estoque';
import type { OrdemRow } from '../../../types/dashboard';
import type { Categorias, Transacao } from '../Financeiro/types';
import { ALVO } from '../../../utils/destaque';
import './alertas.css';

type Filtro = 'todos' | SeveridadeAlerta;

const LIMITE_POR_GRUPO = 2;

const svgBase = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const ICONE_WALLET = (
  <svg {...svgBase}>
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
);

const ICONE_CLOCK = (
  <svg {...svgBase}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ICONE_PACKAGE = (
  <svg {...svgBase}>
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" y1="22" x2="12" y2="12" />
  </svg>
);

const ICONE_ALERT = (
  <svg {...svgBase}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const ICONE_CHECK = (
  <svg {...svgBase}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ICONE_BELL = (
  <svg {...svgBase}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const ICONE_MAIS_ACOES = (
  <svg {...svgBase} width={16} height={16}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

function iconeDaFonte(fonte: FonteAlertaId) {
  switch (fonte) {
    case 'os_sem_pagamento':
      return ICONE_WALLET;
    case 'orcamento_sem_resposta':
    case 'os_aprovada_parada':
      return ICONE_CLOCK;
    case 'estoque_baixo':
    case 'reserva_sem_estoque':
    case 'estoque_quarentena':
      return ICONE_PACKAGE;
    case 'orcamento_respondido':
      return ICONE_CHECK;
    case 'cliente_nao_avisado':
      return ICONE_BELL;
    case 'os_bloqueada':
    default:
      return ICONE_ALERT;
  }
}

function idObjetoDoAlerta(alertaId: string): string {
  const pos = alertaId.indexOf(':');
  return pos >= 0 ? alertaId.slice(pos + 1) : alertaId;
}

function textoSubtituloResumo(grupos: GrupoAlertas[], total: number): string {
  if (total === 0) return 'Nenhum alerta pendente no momento';
  const partes = grupos.map(g => {
    const n = g.itens.length;
    switch (g.fonte.id) {
      case 'os_sem_pagamento':
        return `${n} ${n === 1 ? 'pagamento' : 'pagamentos'}`;
      case 'orcamento_sem_resposta':
        return `${n} ${n === 1 ? 'orçamento' : 'orçamentos'}`;
      case 'estoque_baixo':
      case 'reserva_sem_estoque':
        return `${n} ${n === 1 ? 'peça' : 'peças'}`;
      default:
        return g.fonte.resumo(n);
    }
  });
  const base = `${grupos.length} ${grupos.length === 1 ? 'tipo de alerta' : 'tipos de alerta'} · ${total} ${total === 1 ? 'item' : 'itens'}`;
  return partes.length > 0 ? `${base} (${partes.join(', ')})` : base;
}

function textoVerMais(fonte: FonteAlertaId, ocultos: AlertaItem[]): string {
  const n = ocultos.length;
  const exemplos = ocultos
    .slice(0, 2)
    .map(i => i.titulo.split(' · ')[0].split(' — ')[0].toLowerCase())
    .join(', ');
  const substantivo =
    fonte === 'estoque_baixo' || fonte === 'reserva_sem_estoque' || fonte === 'estoque_quarentena'
      ? n === 1 ? 'peça' : 'peças'
      : n === 1 ? 'alerta' : 'alertas';
  return exemplos ? `Ver mais ${n} ${substantivo} (${exemplos})` : `Ver mais ${n} ${substantivo}`;
}

function telefoneDaOrdem(ordem?: OrdemRow): string | null {
  if (!ordem) return null;
  let pl: any = ordem.payload;
  if (typeof pl === 'string') {
    try { pl = JSON.parse(pl); } catch { pl = {}; }
  }
  const tel = pl?.cliente?.tel;
  return typeof tel === 'string' ? telefoneParaWhatsApp(tel) : null;
}

interface RegistrarCompraModalProps {
  item: EstoqueItem;
  salvando: boolean;
  erro: string | null;
  onConfirmar: (quantidadeComprada: number, novoPreco?: number) => Promise<void>;
  onClose: () => void;
}

function RegistrarCompraModal({ item, salvando, erro, onConfirmar, onClose }: RegistrarCompraModalProps) {
  const sugerida = Math.max(1, item.minimo - item.quantidade);
  const [quantidade, setQuantidade] = useState(String(sugerida));
  const [preco, setPreco] = useState(item.preco ? String(item.preco) : '');

  const qtdNum = Number(quantidade);
  const precoNum = Number(preco);
  const valido = Number.isFinite(qtdNum) && qtdNum > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || salvando) return;
    void onConfirmar(qtdNum, Number.isFinite(precoNum) && precoNum > 0 ? precoNum : undefined);
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">Registrar compra</div>
            <div className="dashboard-modal__subtitle">{item.nome}</div>
          </div>
          <button type="button" onClick={onClose} className="dashboard-button--close" aria-label="Fechar">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dashboard-modal__body">
            <div style={{ fontSize: '0.84rem', color: tokens.color.textSecond, lineHeight: 1.5 }}>
              Estoque atual: <strong style={{ color: tokens.color.text }}>{item.quantidade} un.</strong> (mínimo: {item.minimo} un.)
            </div>

            <Input
              name="compra_quantidade"
              type="number"
              label="Quantidade comprada"
              required
              autoFocus
              min={1}
              value={quantidade}
              onChangeValue={setQuantidade}
            />

            <Input
              name="compra_preco"
              type="currency"
              label="Preço unitário (opcional)"
              value={preco}
              onChangeValue={setPreco}
              placeholder="R$ 0,00"
            />

            <div style={{ fontSize: '0.82rem', color: tokens.color.muted }}>
              Novo estoque após entrada: <strong style={{ color: tokens.color.text }}>{item.quantidade + (valido ? qtdNum : 0)} un.</strong>
            </div>

            {erro && (
              <div role="alert" style={{ padding: '10px 12px', borderRadius: 8, background: tokens.color.critBg, color: tokens.color.crit, fontSize: '0.8rem', fontWeight: 600 }}>
                {erro}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: `1px solid ${tokens.color.border}` }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.textSecond, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!valido || salvando}
              style={{
                padding: '10px 20px',
                background: !valido ? tokens.color.surfaceHigh : tokens.color.ferrari,
                color: !valido ? tokens.color.subtle : 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: !valido || salvando ? 'not-allowed' : 'pointer',
              }}
            >
              {salvando ? 'Salvando…' : 'Confirmar entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface AlertasDesktopProps {
  grupos: GrupoAlertas[];
  alertas: AlertaItem[];
  escondidos: AlertaEscondido[];
  loading: boolean;
  erro: string | null;
  avisos: string[];
  erroAcao: string | null;
  onLimparErroAcao: () => void;
  onRecarregar: () => void;
  onAcao: (acao: AcaoAlerta) => void;
  onAdiar: (alertaId: string, dias: number) => Promise<boolean>;
  onDispensar: (alertaId: string) => Promise<boolean>;
  onRestaurar: (alertaId: string) => Promise<boolean>;
}

export function AlertasDesktop({
  grupos,
  alertas,
  escondidos,
  loading,
  erro,
  avisos,
  erroAcao,
  onLimparErroAcao,
  onRecarregar,
  onAcao,
  onAdiar,
  onDispensar,
  onRestaurar,
}: AlertasDesktopProps) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [mostrarEscondidos, setMostrarEscondidos] = useState(false);
  const [desfazer, setDesfazer] = useState<{ id: string; texto: string } | null>(null);

  // Dados auxiliares para abrir modais específicos e redirecionar WhatsApp sem bloquear popup
  const [ordensMapa, setOrdensMapa] = useState<Map<string, OrdemRow>>(new Map());
  const [estoqueMapa, setEstoqueMapa] = useState<Map<string, EstoqueItem>>(new Map());
  const [categoriasFin, setCategoriasFin] = useState<Categorias | null>(null);

  // Estado dos modais específicos
  const [modalAjustarMinimo, setModalAjustarMinimo] = useState<EstoqueItem | null>(null);
  const [modalCompra, setModalCompra] = useState<EstoqueItem | null>(null);
  const [modalPagamento, setModalPagamento] = useState<{ transacao?: Transacao; ordemId: string } | null>(null);
  const [salvandoModal, setSalvandoModal] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);

  const timerDesfazer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerDesfazer.current) clearTimeout(timerDesfazer.current); }, []);

  // Carrega listas em cache para ações síncronas (WhatsApp) e modais
  useEffect(() => {
    let ativo = true;
    api.listarOrdens()
      .then((lista: OrdemRow[]) => {
        if (!ativo || !Array.isArray(lista)) return;
        setOrdensMapa(new Map(lista.map(o => [o.id, o])));
      })
      .catch(() => {});

    api.listarEstoque()
      .then((lista: EstoqueItem[]) => {
        if (!ativo || !Array.isArray(lista)) return;
        setEstoqueMapa(new Map(lista.map(i => [i.id, i])));
      })
      .catch(() => {});

    return () => { ativo = false; };
  }, [alertas]);

  // Fecha popover de "Adiar / Dispensar" ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!menuAbertoId) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('[data-al-menu]')) setMenuAbertoId(null);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbertoId(null);
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAbertoId]);

  const qtd = useMemo(() => ({
    todos: alertas.length,
    crit: alertas.filter(a => a.severidade === 'crit').length,
    warn: alertas.filter(a => a.severidade === 'warn').length,
    info: alertas.filter(a => a.severidade === 'info').length,
  }), [alertas]);

  const gruposVisiveis = useMemo(
    () =>
      grupos
        .map(g => ({
          ...g,
          itens: filtro === 'todos' ? g.itens : g.itens.filter(i => i.severidade === filtro),
        }))
        .filter(g => g.itens.length > 0),
    [grupos, filtro],
  );

  const totalVisiveis = useMemo(
    () => gruposVisiveis.reduce((s, g) => s + g.itens.length, 0),
    [gruposVisiveis],
  );

  const filtros: { id: Filtro; rotulo: string; n: number }[] = [
    { id: 'todos', rotulo: 'Todos', n: qtd.todos },
    { id: 'crit', rotulo: 'Urgentes', n: qtd.crit },
    { id: 'warn', rotulo: 'Atenção', n: qtd.warn },
    ...(qtd.info > 0 ? [{ id: 'info' as const, rotulo: 'Informativos', n: qtd.info }] : []),
  ];

  const avisarDesfazer = (id: string, texto: string) => {
    setDesfazer({ id, texto });
    if (timerDesfazer.current) clearTimeout(timerDesfazer.current);
    timerDesfazer.current = setTimeout(() => setDesfazer(null), 8000);
  };

  const handleAdiar = async (alertaId: string, dias: number) => {
    setMenuAbertoId(null);
    if (await onAdiar(alertaId, dias)) {
      avisarDesfazer(alertaId, `Alerta adiado por ${dias === 1 ? '1 dia' : `${dias} dias`}.`);
    }
  };

  const handleDispensar = async (alertaId: string) => {
    setMenuAbertoId(null);
    if (await onDispensar(alertaId)) {
      avisarDesfazer(alertaId, 'Alerta dispensado.');
    }
  };

  const handleRestaurar = async (alertaId: string) => {
    setDesfazer(null);
    await onRestaurar(alertaId);
  };

  // ── Ações específicas dos modais / WhatsApp ─────────────────────────────────

  const abrirAjustarMinimo = async (alerta: AlertaItem) => {
    const itemId = idObjetoDoAlerta(alerta.id);
    setErroModal(null);
    setAvisoLocal(null);
    const local = estoqueMapa.get(itemId);
    if (local) {
      setModalAjustarMinimo(local);
      return;
    }
    try {
      const item = (await api.obterItemEstoque(itemId)) as EstoqueItem;
      setModalAjustarMinimo(item);
    } catch (e) {
      setAvisoLocal(mensagemDoErro(e, 'Não foi possível carregar o item do estoque.'));
    }
  };

  const abrirRegistrarCompra = async (alerta: AlertaItem) => {
    const itemId = idObjetoDoAlerta(alerta.id);
    setErroModal(null);
    setAvisoLocal(null);
    const local = estoqueMapa.get(itemId);
    if (local) {
      setModalCompra(local);
      return;
    }
    try {
      const item = (await api.obterItemEstoque(itemId)) as EstoqueItem;
      setModalCompra(item);
    } catch (e) {
      setAvisoLocal(mensagemDoErro(e, 'Não foi possível carregar o item do estoque.'));
    }
  };

  const abrirRegistrarPagamento = async (alerta: AlertaItem) => {
    const ordemId = idObjetoDoAlerta(alerta.id);
    setErroModal(null);
    setAvisoLocal(null);
    try {
      const [cats, pendentes] = await Promise.all([
        categoriasFin ? Promise.resolve(categoriasFin) : (api.categoriasFinanceiro() as Promise<Categorias>),
        api.listarTransacoes({ status: 'pendente', tipo: 'entrada', semPeriodo: true }) as Promise<Transacao[]>,
      ]);
      setCategoriasFin(cats);
      const transacao = Array.isArray(pendentes)
        ? pendentes.find(t => t.ordem_servico_id === ordemId)
        : undefined;
      if (transacao) {
        setModalPagamento({ transacao: { ...transacao, status: 'pago' }, ordemId });
      } else {
        setModalPagamento({ ordemId });
      }
    } catch (e) {
      setAvisoLocal(mensagemDoErro(e, 'Não foi possível carregar os dados financeiros dessa OS.'));
    }
  };

  const abrirWhatsApp = (alerta: AlertaItem) => {
    const ordemId = alerta.acao.destino.tipo === 'ordem' ? alerta.acao.destino.ordemId : idObjetoDoAlerta(alerta.id);
    const numero = telefoneDaOrdem(ordensMapa.get(ordemId));
    const url = numero ? `https://wa.me/${numero}` : 'https://wa.me/';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSalvarProdutoMinimo = async (input: NovoEstoqueItemInput) => {
    if (!modalAjustarMinimo) return;
    setSalvandoModal(true);
    setErroModal(null);
    try {
      await api.atualizarItemEstoque(modalAjustarMinimo.id, limparOpcionais(input, ['fotoDataUrl']));
      setModalAjustarMinimo(null);
      onRecarregar();
    } catch (e) {
      setErroModal(mensagemDoErro(e, 'Não foi possível atualizar o item no estoque.'));
    } finally {
      setSalvandoModal(false);
    }
  };

  const handleConfirmarCompra = async (quantidadeComprada: number, novoPreco?: number) => {
    if (!modalCompra) return;
    setSalvandoModal(true);
    setErroModal(null);
    try {
      await api.atualizarItemEstoque(modalCompra.id, {
        quantidade: modalCompra.quantidade + quantidadeComprada,
        ...(novoPreco !== undefined ? { preco: novoPreco } : {}),
      });
      setModalCompra(null);
      onRecarregar();
    } catch (e) {
      setErroModal(mensagemDoErro(e, 'Não foi possível registrar a entrada no estoque.'));
    } finally {
      setSalvandoModal(false);
    }
  };

  const handleSalvarPagamento = async (payload: Record<string, unknown>) => {
    if (!modalPagamento) return;
    if (modalPagamento.transacao) {
      await api.atualizarTransacao(modalPagamento.transacao.id, payload);
    } else {
      await api.criarTransacao({ ...payload, ordem_servico_id: modalPagamento.ordemId });
    }
    setModalPagamento(null);
    onRecarregar();
  };

  // ── Render de ações por linha ───────────────────────────────────────────────

  const renderAcoesDaLinha = (alerta: AlertaItem) => {
    const menuAberto = menuAbertoId === alerta.id;

    const menuAdiarDispensar = (
      <div className="al-adiar-wrap" data-al-menu>
        <button
          type="button"
          className="al-btn al-btn--icone"
          aria-label={`Adiar ou dispensar: ${alerta.titulo}`}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          onClick={() => setMenuAbertoId(menuAberto ? null : alerta.id)}
        >
          {ICONE_MAIS_ACOES}
        </button>
        {menuAberto && (
          <div className="al-popover" role="menu">
            <div className="al-popover__rotulo">Adiar alerta</div>
            {OPCOES_ADIAR.map(o => (
              <button
                key={o.dias}
                type="button"
                role="menuitem"
                className="al-popover__item"
                onClick={() => void handleAdiar(alerta.id, o.dias)}
              >
                Adiar por {o.rotulo}
              </button>
            ))}
            <div className="al-popover__sep" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="al-popover__item al-popover__item--perigo"
              onClick={() => void handleDispensar(alerta.id)}
            >
              Dispensar
            </button>
          </div>
        )}
      </div>
    );

    if (alerta.fonte === 'os_sem_pagamento') {
      return (
        <>
          <button type="button" className="al-btn al-btn--ghost" onClick={() => void handleAdiar(alerta.id, 3)}>
            Adiar 3 dias
          </button>
          <button type="button" className="al-btn al-btn--secondary" onClick={() => void abrirRegistrarPagamento(alerta)}>
            Registrar pagamento
          </button>
          {menuAdiarDispensar}
        </>
      );
    }

    if (alerta.fonte === 'orcamento_sem_resposta') {
      return (
        <>
          <button type="button" className="al-btn al-btn--ghost" onClick={() => onAcao(alerta.acao)}>
            Abrir OS
          </button>
          <button type="button" className="al-btn al-btn--secondary" onClick={() => abrirWhatsApp(alerta)}>
            Lembrar pelo WhatsApp
          </button>
          {menuAdiarDispensar}
        </>
      );
    }

    if (alerta.fonte === 'estoque_baixo') {
      return (
        <>
          <button type="button" className="al-btn al-btn--ghost" onClick={() => void abrirAjustarMinimo(alerta)}>
            Ajustar mínimo
          </button>
          <button type="button" className="al-btn al-btn--secondary" onClick={() => void abrirRegistrarCompra(alerta)}>
            Registrar compra
          </button>
          {menuAdiarDispensar}
        </>
      );
    }

    if (alerta.fonte === 'reserva_sem_estoque') {
      return (
        <>
          <button type="button" className="al-btn al-btn--ghost" onClick={() => onAcao(alerta.acao)}>
            {alerta.acao.rotulo}
          </button>
          <button type="button" className="al-btn al-btn--secondary" onClick={() => void abrirRegistrarCompra(alerta)}>
            Registrar compra
          </button>
          {menuAdiarDispensar}
        </>
      );
    }

    return (
      <>
        {alerta.acaoSecundaria && (
          <button type="button" className="al-btn al-btn--ghost" onClick={() => onAcao(alerta.acaoSecundaria!)}>
            {alerta.acaoSecundaria.rotulo}
          </button>
        )}
        <button type="button" className="al-btn al-btn--secondary" onClick={() => onAcao(alerta.acao)}>
          {alerta.acao.rotulo}
        </button>
        {menuAdiarDispensar}
      </>
    );
  };

  return (
    <div className="al-page">
      {/* Cabeçalho */}
      <header className="al-header">
        <div className="al-header__titulos">
          <h1 className="al-titulo">Alertas</h1>
          <p className="al-subtitulo">
            {loading ? 'Verificando pendências…' : textoSubtituloResumo(gruposVisiveis, totalVisiveis)}
          </p>
        </div>
        <button type="button" className="al-btn al-btn--secondary" onClick={onRecarregar} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      {/* Avisos de erro / indisponibilidade */}
      {erro && (
        <div className="al-aviso al-aviso--crit" role="alert">
          <span>{erro}</span>
          <button type="button" className="al-btn al-btn--secondary" onClick={onRecarregar}>Tentar de novo</button>
        </div>
      )}

      {(erroAcao || avisoLocal) && (
        <div className="al-aviso al-aviso--crit" role="alert">
          <span>{erroAcao || avisoLocal}</span>
          <button
            type="button"
            className="al-btn al-btn--ghost"
            onClick={() => { onLimparErroAcao(); setAvisoLocal(null); }}
          >
            Fechar
          </button>
        </div>
      )}

      {!loading && avisos.map(a => (
        <div key={a} className="al-aviso al-aviso--warn" role="status">
          <span>{a}</span>
        </div>
      ))}

      {/* Barra de filtros */}
      {!erro && (loading || alertas.length > 0 || escondidos.length > 0) && (
        <div className="al-toolbar">
          <div className="al-chips" role="group" aria-label="Filtrar por urgência">
            {filtros.map(f => (
              <button
                key={f.id}
                type="button"
                className="al-chip"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.rotulo}
                <span className="al-chip__qtd">{loading ? '–' : f.n}</span>
              </button>
            ))}
          </div>

          {!loading && escondidos.length > 0 && (
            <button
              type="button"
              className="al-btn al-btn--ghost"
              aria-expanded={mostrarEscondidos}
              onClick={() => setMostrarEscondidos(v => !v)}
            >
              {mostrarEscondidos ? 'Ocultar adiados e dispensados' : `Adiados e dispensados (${escondidos.length})`}
            </button>
          )}
        </div>
      )}

      {/* Carregando */}
      {loading && alertas.length === 0 && (
        <div className="al-carregando" aria-busy="true" aria-label="Carregando alertas">
          <Skeleton h={140} r={8} />
          <Skeleton h={110} r={8} />
        </div>
      )}

      {/* Estado vazio */}
      {!loading && !erro && totalVisiveis === 0 && (
        <div className="al-vazio">
          <div className="al-vazio__icone">{ICONE_CHECK}</div>
          <div className="al-vazio__titulo">
            {escondidos.length > 0 && filtro === 'todos' ? 'Nenhum alerta à vista' : 'Tudo em dia'}
          </div>
          <div className="al-vazio__texto">
            {escondidos.length > 0 && filtro === 'todos'
              ? `${escondidos.length === 1 ? '1 alerta está adiado ou dispensado' : `${escondidos.length} alertas estão adiados ou dispensados`} por você.`
              : 'Nenhum alerta pendente para este filtro no momento.'}
          </div>
        </div>
      )}

      {/* Grupos de alertas */}
      {!loading && gruposVisiveis.length > 0 && (
        <div className="al-grupos">
          {gruposVisiveis.map(g => {
            const sev = maisGrave(g.itens);
            const aberto = !!expandidos[g.fonte.id];
            const excede = g.itens.length > LIMITE_POR_GRUPO;
            const visiveis = excede && !aberto ? g.itens.slice(0, LIMITE_POR_GRUPO) : g.itens;
            const ocultos = excede ? g.itens.slice(LIMITE_POR_GRUPO) : [];

            return (
              <section
                key={g.fonte.id}
                className="al-grupo"
                aria-label={g.fonte.titulo}
                data-destaque-id={g.fonte.id === 'cliente_nao_avisado' ? ALVO.alertasClientesParaAvisar : undefined}
              >
                <div className="al-grupo__cab">
                  <span className={`al-grupo__ponto al-grupo__ponto--${sev}`} aria-hidden="true" />
                  <h2 className="al-grupo__titulo">{g.fonte.titulo}</h2>
                </div>

                <div className="al-grupo__lista">
                  {visiveis.map(alerta => (
                    <div key={alerta.id} className="al-linha">
                      <span className={`al-linha__icone al-linha__icone--${alerta.severidade}`}>
                        {iconeDaFonte(alerta.fonte)}
                      </span>
                      <div className="al-linha__texto">
                        <div className="al-linha__titulo">{alerta.titulo}</div>
                        {alerta.detalhe && <div className="al-linha__detalhe">{alerta.detalhe}</div>}
                      </div>
                      <div className="al-linha__acoes">{renderAcoesDaLinha(alerta)}</div>
                    </div>
                  ))}
                </div>

                {excede && (
                  <div className="al-grupo__mais">
                    <button
                      type="button"
                      className="al-btn al-btn--ghost"
                      aria-expanded={aberto}
                      onClick={() => setExpandidos(prev => ({ ...prev, [g.fonte.id]: !aberto }))}
                    >
                      {aberto ? 'Mostrar menos' : textoVerMais(g.fonte.id, ocultos)}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Lista de adiados e dispensados */}
      {!loading && !erro && mostrarEscondidos && escondidos.length > 0 && (
        <section className="al-escondidos" aria-label="Alertas adiados e dispensados">
          <div className="al-escondidos__lista">
            {escondidos.map(a => (
              <div key={a.id} className="al-linha">
                <span className={`al-linha__icone al-linha__icone--${a.severidade}`}>
                  {iconeDaFonte(a.fonte)}
                </span>
                <div className="al-linha__texto">
                  <div className="al-linha__titulo">{a.titulo}</div>
                  <div className="al-linha__detalhe">
                    {a.ate ? `Adiado até ${formatarAte(a.ate)}` : 'Dispensado — volta se o problema reaparecer'}
                  </div>
                </div>
                <div className="al-linha__acoes">
                  <button type="button" className="al-btn al-btn--secondary" onClick={() => void handleRestaurar(a.id)}>
                    Voltar a mostrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Toast de desfazer */}
      {desfazer && (
        <div className="al-desfazer" role="status">
          <span>{desfazer.texto}</span>
          <button type="button" className="al-desfazer__btn" onClick={() => void handleRestaurar(desfazer.id)}>
            Desfazer
          </button>
        </div>
      )}

      {/* Modais específicos de cada objeto */}
      {modalAjustarMinimo && (
        <ProdutoModal
          item={modalAjustarMinimo}
          onSave={handleSalvarProdutoMinimo}
          erro={erroModal}
          salvando={salvandoModal}
          onClose={() => { setModalAjustarMinimo(null); setErroModal(null); }}
        />
      )}

      {modalCompra && (
        <RegistrarCompraModal
          item={modalCompra}
          salvando={salvandoModal}
          erro={erroModal}
          onConfirmar={handleConfirmarCompra}
          onClose={() => { setModalCompra(null); setErroModal(null); }}
        />
      )}

      {modalPagamento && categoriasFin && (
        <TransacaoModal
          categorias={categoriasFin}
          transacao={modalPagamento.transacao}
          onFechar={() => setModalPagamento(null)}
          onSalvar={handleSalvarPagamento}
        />
      )}
    </div>
  );
}