import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useNomeOficina } from '../../../hooks/UseNomeOficina';
import { useAlertasResumo } from '../../../hooks/useAlertasResumo';
import { useAtendimento } from '../../../hooks/useAtendimento';
import { useEstoque } from '../../../hooks/useEstoque';
import { rotuloDoCargo } from '../../../utils/cargo';
import { Icons } from '../Icons';
import { ICONES_PAGINA, ICONES_SIDEBAR } from '../SidebarIcons';
import { AgendaIcons } from '../Agendamentos/icons';
import { IcInstalar } from '../Configuracoes/icones';
import type { NavPage } from '../../../types/dashboard';
import './MaisPage.css';

interface MaisPageProps {
  onNav: (p: NavPage) => void;
}

interface ItemMais {
  key: string;
  label: string;
  icon: ReactNode;
  detalhe?: string;
  perigo?: boolean;
  semSeta?: boolean;
  onClick: () => void;
}

export function MaisPage({ onNav }: MaisPageProps) {
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const nomeOficina = useNomeOficina();
  const { total: totalAlertas, loading: loadingAlertas } = useAlertasResumo();
  const { resumo: resumoAtendimento, loading: loadingAtendimento } = useAtendimento();
  const { stats: statsEstoque, carregando: loadingEstoque } = useEstoque();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(
    () => (window as any).deferredPrompt ?? null,
  );

  useEffect(() => {
    const aoOferecerInstalacao = (e: any) => setDeferredPrompt(e);
    window.addEventListener('beforeinstallprompt', aoOferecerInstalacao);
    return () => window.removeEventListener('beforeinstallprompt', aoOferecerInstalacao);
  }, []);

  const instalarApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    (window as any).deferredPrompt = null;
    setDeferredPrompt(null);
  };

  const cargo = rotuloDoCargo(user);
  const subtitulo = [
    nomeOficina || 'Oficina',
    user?.nome ? (cargo ? `${user.nome} (${cargo.toLowerCase()})` : user.nome) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const operacao: ItemMais[] = [
    {
      key: 'atendimento',
      label: 'Atendimento',
      icon: ICONES_PAGINA.atendimento ?? Icons.clipboardCheck,
      detalhe:
        !loadingAtendimento && resumoAtendimento.emExecucao > 0
          ? `${resumoAtendimento.emExecucao} em execução`
          : undefined,
      onClick: () => onNav('atendimento'),
    },
    {
      key: 'alertas',
      label: 'Alertas',
      icon: Icons.alert,
      detalhe: !loadingAlertas && totalAlertas > 0 ? String(totalAlertas) : undefined,
      onClick: () => onNav('alertas'),
    },
  ];

  const cadastros: ItemMais[] = [
    {
      key: 'veiculos',
      label: 'Veículos',
      icon: ICONES_PAGINA.veiculos ?? Icons.car,
      onClick: () => onNav('veiculos'),
    },
    {
      key: 'estoque',
      label: 'Estoque',
      icon: ICONES_PAGINA.estoque ?? Icons.box,
      detalhe:
        !loadingEstoque && statsEstoque.itensBaixoEstoque > 0
          ? `${statsEstoque.itensBaixoEstoque} ${statsEstoque.itensBaixoEstoque === 1 ? 'baixo' : 'baixos'}`
          : undefined,
      onClick: () => onNav('estoque'),
    },
    {
      key: 'servicos',
      label: 'Catálogo de Serviços',
      icon: ICONES_PAGINA.servicos ?? Icons.wrench,
      onClick: () => onNav('servicos'),
    },
  ];

  const gestao: ItemMais[] = [
    ...(can('financeiro.ver')
      ? [
          {
            key: 'financeiro',
            label: 'Financeiro',
            icon: ICONES_PAGINA.financeiro ?? Icons.money,
            onClick: () => onNav('financeiro'),
          },
        ]
      : []),
    {
      key: 'relatorios',
      label: 'Relatórios',
      icon: ICONES_PAGINA.relatorios ?? Icons.chart,
      onClick: () => onNav('relatorios'),
    },
  ];

  const sistema: ItemMais[] = [
    {
      key: 'configuracoes',
      label: 'Configurações',
      icon: ICONES_PAGINA.configuracoes ?? Icons.cog,
      onClick: () => onNav('configuracoes'),
    },
    {
      key: 'dicas',
      label: 'Dicas',
      icon: ICONES_PAGINA.dicas ?? Icons.help,
      onClick: () => onNav('dicas'),
    },
    ...(deferredPrompt
      ? [
          {
            key: 'instalar',
            label: 'Instalar o aplicativo',
            icon: IcInstalar,
            onClick: instalarApp,
          },
        ]
      : []),
    {
      key: 'sair',
      label: 'Sair',
      icon: ICONES_SIDEBAR.sair,
      perigo: true,
      semSeta: true,
      onClick: logout,
    },
  ];

  const secoes: { titulo: string; itens: ItemMais[] }[] = [
    { titulo: 'Operação', itens: operacao },
    { titulo: 'Cadastros', itens: cadastros },
    { titulo: 'Gestão', itens: gestao },
    { titulo: 'Sistema', itens: sistema },
  ];

  return (
    <div className="mais-page">
      <header className="mais-topo">
        <h1 className="mais-titulo">Mais</h1>
        {subtitulo && <p className="mais-subtitulo">{subtitulo}</p>}
      </header>

      {secoes.map(secao => (
        <div key={secao.titulo}>
          <h2 className="mais-secao">{secao.titulo}</h2>
          <div className="mais-grupo">
            {secao.itens.map(item => (
              <button
                key={item.key}
                type="button"
                className={`mais-item${item.perigo ? ' mais-item--perigo' : ''}`}
                onClick={item.onClick}
              >
                <span className="mais-item__icone" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="mais-item__rotulo">{item.label}</span>
                {item.detalhe && <span className="mais-item__detalhe">{item.detalhe}</span>}
                {!item.semSeta && (
                  <span className="mais-item__seta" aria-hidden="true">
                    {AgendaIcons.chevR}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="mais-nota">
        Financeiro e Relatórios aparecem só para dono e gerente.
      </p>
    </div>
  );
}