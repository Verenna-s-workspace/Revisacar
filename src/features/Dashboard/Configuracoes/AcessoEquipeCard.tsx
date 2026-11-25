import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../components/system';
import { Aviso, EstadoMensagem, RodapeAcoes } from './cfgUi';
import { IcCheck } from './icones';
import { api } from '../../../utils/api';
import { mensagemDoErro } from '../../../utils/api_erro';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  formatarCodigo, linkDoWhatsApp, mensagemDoWhatsApp, urlDoAcesso,
} from '../../../utils/acesso_equipe_utils';

type Copiado = 'link' | 'codigo' | null;

/**
 * Acesso da equipe: o dono gera um código curto e um link (/f/<código>). Quem abre o link em
 * qualquer computador já cai na lista de nomes da oficina e só digita o PIN — sem precisar saber
 * o CNPJ. Renovar troca o código (o link antigo para de funcionar); desativar apaga o link.
 */
export function AcessoEquipeCard({ nomeOficina }: { nomeOficina?: string }) {
  const { can } = usePermissions();
  const podeGerenciar = can('funcionarios.gerenciar');

  const [codigo, setCodigo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<Copiado>(null);
  const [confirmando, setConfirmando] = useState<'renovar' | 'desativar' | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    api.obterAcessoEquipe()
      .then((r: { codigo: string | null }) => setCodigo(r?.codigo ?? null))
      .catch((e: unknown) => setErro(mensagemDoErro(e, 'Não foi possível carregar o acesso da equipe.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (podeGerenciar) carregar();
  }, [podeGerenciar, carregar]);

  // Esconder a seção é só UX — quem barra é o funcionarios.gerenciar no backend.
  if (!podeGerenciar) return null;

  const url = codigo ? urlDoAcesso(codigo, window.location.origin) : '';

  const agir = async (acao: () => Promise<{ codigo?: string | null } | null>) => {
    setOcupado(true);
    setErro('');
    setConfirmando(null);
    try {
      const r = await acao();
      setCodigo(r?.codigo ?? null);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível concluir. Tente de novo.'));
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async (o: Exclude<Copiado, null>, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(o);
      window.setTimeout(() => setCopiado(atual => (atual === o ? null : atual)), 2000);
    } catch {
      setErro('Seu navegador não deixou copiar. Selecione o texto e copie manualmente.');
    }
  };

  return (
    <>
      {erro && <Aviso tom="crit">{erro}</Aviso>}

      {loading ? (
        <EstadoMensagem>Carregando…</EstadoMensagem>
      ) : !codigo ? (
        <div className="cfg-bloco">
          <p className="cfg-texto">
            Gere o link e mande para a equipe (WhatsApp, por exemplo). Quem abrir já vê a lista de nomes
            da oficina e só digita o PIN, sem precisar saber o CNPJ.
          </p>
          <Button
            variant="primary"
            loading={ocupado}
            onClick={() => agir(() => api.gerarAcessoEquipe(false))}
          >
            {ocupado ? 'Gerando…' : 'Gerar link de acesso'}
          </Button>
        </div>
      ) : (
        <>
          <div className="cfg-bloco">
            <span className="cfg-rotulo">Código da oficina</span>
            <div className="cfg-linha">
              <span className="cfg-codigo">{formatarCodigo(codigo)}</span>
              <Button size="sm" onClick={() => copiar('codigo', formatarCodigo(codigo))}>
                {copiado === 'codigo' ? <>{IcCheck} Copiado</> : 'Copiar código'}
              </Button>
            </div>
          </div>

          <div className="cfg-bloco" style={{ alignItems: 'stretch' }}>
            <span className="cfg-rotulo">Link</span>
            <div className="cfg-caixa-link">{url}</div>
            <div className="cfg-linha">
              <Button size="sm" onClick={() => copiar('link', url)}>
                {copiado === 'link' ? <>{IcCheck} Copiado</> : 'Copiar link'}
              </Button>
              <a
                className="sys-btn sys-btn--secondary sys-btn--sm"
                href={linkDoWhatsApp(mensagemDoWhatsApp({ url, oficina: nomeOficina }))}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar por WhatsApp
              </a>
            </div>
          </div>

          <RodapeAcoes>
            {confirmando ? (
              <>
                <span className="cfg-texto" style={{ flex: '1 1 auto', textAlign: 'left', color: 'var(--cfg-texto)', fontWeight: 500 }}>
                  {confirmando === 'renovar'
                    ? 'O link e o código atuais deixam de funcionar. Continuar?'
                    : 'O link deixa de funcionar. Quem já entrou neste aparelho continua entrando. Continuar?'}
                </span>
                <Button onClick={() => setConfirmando(null)}>Cancelar</Button>
                <Button
                  variant={confirmando === 'desativar' ? 'danger' : 'primary'}
                  loading={ocupado}
                  onClick={() => agir(() => (confirmando === 'renovar'
                    ? api.gerarAcessoEquipe(true)
                    : api.desativarAcessoEquipe().then(() => ({ codigo: null }))))}
                >
                  Sim, continuar
                </Button>
              </>
            ) : (
              <>
                <Button className="cfg-btn--risco" disabled={ocupado} onClick={() => setConfirmando('desativar')}>
                  Desativar link
                </Button>
                <Button disabled={ocupado} onClick={() => setConfirmando('renovar')}>
                  Gerar novo código
                </Button>
              </>
            )}
          </RodapeAcoes>
        </>
      )}
    </>
  );
}
