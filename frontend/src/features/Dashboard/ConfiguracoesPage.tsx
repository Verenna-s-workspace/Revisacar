import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCpfCnpj } from '../../components/inputs/masks';
import { NavSecoes, PainelSecao } from './Configuracoes/cfgUi';
import { useOficinaConfig } from './Configuracoes/useOficinaConfig';
import { SECOES } from './Configuracoes/secoes';
import type { IdSecao } from './Configuracoes/secoes';
import { DadosOficinaSecao, HorarioFuncionamentoSecao } from './Configuracoes/OficinaSecoes';
import { FuncionariosCard } from './Configuracoes/FuncionariosCard';
import { AcessoEquipeCard } from './Configuracoes/AcessoEquipeCard';
import { ReservaCaixaCard } from './Configuracoes/ReservaCaixaCard';
import { AplicativoSecao } from './Configuracoes/AplicativoSecao';
import { PlanoCobrancaSecao } from './Configuracoes/PlanoCobrancaSecao';
import { MinhaContaCard, detalheDaConta } from './Configuracoes/MinhaContaCard';
import './Configuracoes/configuracoes.css';

/**
 * Configurações. Desktop: menu de seções à esquerda + um painel por vez à direita (redesign do Figma).
 * Celular/tablet: ainda sem o redesign — os mesmos painéis aparecem empilhados, um abaixo do outro.
 *
 * Os dados da oficina (seções "Dados da oficina" e "Horário de funcionamento") vivem aqui, em um único
 * hook, porque as duas seções editam e salvam o mesmo conjunto: trocar de seção não perde o que foi digitado.
 */
export function ConfiguracoesPage({ isMobile }: { isMobile: boolean }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const cfg = useOficinaConfig();

  // Esconder uma seção sem permissão é só UX — quem barra de verdade é o backend.
  const visiveis = SECOES.filter(s => !s.permissao || can(s.permissao));
  const [idAtivo, setIdAtivo] = useState<IdSecao>(visiveis[0].id);
  const ativa = visiveis.find(s => s.id === idAtivo) ?? visiveis[0];

  const conteudo = (id: IdSecao): ReactNode => {
    switch (id) {
      case 'dados':      return <DadosOficinaSecao cfg={cfg} />;
      case 'equipe':     return <FuncionariosCard />;
      case 'acesso':     return <AcessoEquipeCard nomeOficina={cfg.workshop.nome} />;
      case 'horario':    return <HorarioFuncionamentoSecao cfg={cfg} />;
      case 'reserva':    return <ReservaCaixaCard />;
      case 'aplicativo': return <AplicativoSecao />;
      case 'plano':      return <PlanoCobrancaSecao />;
      case 'conta':      return <MinhaContaCard />;
    }
  };

  const descricaoDe = (id: IdSecao, padrao?: string) => (id === 'conta' ? detalheDaConta(user) : padrao);

  // Subtítulo: o que está salvo (não o que está sendo digitado).
  const { nome, cnpj } = cfg.original;
  const subtitulo = [nome, cnpj && `CNPJ ${formatCpfCnpj(cnpj)}`].filter(Boolean).join(' · ');

  const trocarSecao = (id: string) => {
    setIdAtivo(id as IdSecao);
    cfg.limparAvisos();
  };

  return (
    <div className={`cfg-page${isMobile ? ' cfg-page--compacto' : ''}`}>
      <header className="cfg-header">
        <div className="cfg-header__titulos">
          <h1 className="cfg-titulo">Configurações</h1>
          {subtitulo && <p className="cfg-subtitulo">{subtitulo}</p>}
        </div>
      </header>

      {isMobile ? (
        <div className="cfg-empilhado">
          {visiveis.map(s => (
            <PainelSecao key={s.id} id={s.id} titulo={s.titulo} descricao={descricaoDe(s.id, s.descricao)}>
              {conteudo(s.id)}
            </PainelSecao>
          ))}
        </div>
      ) : (
        <div className="cfg-layout">
          <NavSecoes
            itens={visiveis.map(s => ({ id: s.id, rotulo: s.rotulo, emBreve: s.emBreve }))}
            ativo={ativa.id}
            onSelecionar={trocarSecao}
          />
          <PainelSecao key={ativa.id} id={ativa.id} titulo={ativa.titulo} descricao={descricaoDe(ativa.id, ativa.descricao)}>
            {conteudo(ativa.id)}
          </PainelSecao>
        </div>
      )}
    </div>
  );
}
