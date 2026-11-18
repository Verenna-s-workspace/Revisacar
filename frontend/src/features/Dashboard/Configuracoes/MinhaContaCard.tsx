import { useEffect, useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Card } from '../Primitives';
import { Input } from '../../../components/inputs/input';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../utils/api';
import { mensagemDoErro } from '../../../utils/api_erro';
import {
  NOME_CONTA_MAX, PALAVRA_CONFIRMACAO, confirmacaoCorreta, limparDadosLocaisDaOficina,
  normalizarNome, problemaNoNome,
} from '../../../utils/conta_utils';

const caixaDeErro = {
  padding: '10px 14px', background: 'var(--color-crit-bg)', color: 'var(--color-crit)',
  border: '1px solid var(--color-crit-border)', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
} as const;

const botaoSecundario = {
  padding: '9px 16px', background: 'transparent', color: tokens.color.text,
  border: `1px solid ${tokens.color.border}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
} as const;

const ROTULO_CARGO: Record<string, string> = {
  dono: 'Dono', gerente: 'Gerente', mecanico: 'Mecânico', atendente: 'Atendente',
};

/**
 * Minha conta — vale para qualquer pessoa logada (dono, gerente, mecânico, atendente), sem permissão
 * especial: cada um mexe só na PRÓPRIA conta (o servidor usa o token, nunca um id enviado daqui).
 *  • Seu nome: o da pessoa, que aparece no topo e nos registros. NÃO é o nome da oficina (esse fica em
 *    "Dados da Oficina", acima).
 *  • Excluir minha conta: dono apaga a oficina inteira (confirma com a senha); funcionário apaga só o
 *    próprio cadastro (confirma com o PIN). Nos dois casos é preciso digitar EXCLUIR.
 */
export function MinhaContaCard({ isMobile }: { isMobile: boolean }) {
  const { user, atualizarNome, logout } = useAuth();
  const ehDono = user?.tipo !== 'funcionario';

  const [nome, setNome] = useState(user?.nome ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erroNome, setErroNome] = useState('');
  const [nomeSalvo, setNomeSalvo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Se o nome mudar por fora (outra renovação de sessão), o campo acompanha — sem pisar no que a pessoa digita.
  const nomeDaConta = user?.nome ?? '';
  useEffect(() => { setNome(nomeDaConta); }, [nomeDaConta]);

  if (!user) return null;

  const normalizado = normalizarNome(nome);
  const problema = nome.length > 0 ? problemaNoNome(nome) : null;
  const mudou = normalizado !== nomeDaConta;
  const podeSalvar = mudou && !problemaNoNome(nome) && !salvando;

  const salvarNome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;
    setSalvando(true);
    setErroNome('');
    setNomeSalvo(false);
    try {
      const r: { nome: string; accessToken: string } = await api.atualizarMeuNome(normalizado);
      atualizarNome(r.nome, r.accessToken);
      setNomeSalvo(true);
      window.setTimeout(() => setNomeSalvo(false), 3000);
    } catch (err) {
      setErroNome(mensagemDoErro(err, 'Não foi possível salvar o seu nome.'));
    } finally {
      setSalvando(false);
    }
  };

  const detalhe = ehDono
    ? (user.doc ? `Dono · CNPJ ${user.doc}` : 'Dono')
    : `${ROTULO_CARGO[user.cargo ?? ''] ?? 'Funcionário'}${user.email ? ` · ${user.email}` : ''}`;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-ferrari)', display: 'flex' }}>{Icons.user}</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>Minha conta</div>
            <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>{detalhe}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <form onSubmit={salvarNome} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {erroNome && <div role="alert" style={caixaDeErro}>{erroNome}</div>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ flex: 1, width: '100%' }}>
              <Input
                name="meu-nome"
                label="Seu nome"
                value={nome}
                maxLength={NOME_CONTA_MAX}
                error={problema ?? undefined}
                hint={ehDono
                  ? 'É o seu nome de usuário, que aparece no topo e nos registros. O nome da oficina fica em "Dados da Oficina".'
                  : 'Aparece no topo e nos registros que você faz (ordens, lançamentos).'}
                onChangeValue={v => { setNome(v); setNomeSalvo(false); setErroNome(''); }}
              />
            </div>
            <button
              type="submit"
              disabled={!podeSalvar}
              style={{
                padding: '10px 18px', background: 'var(--color-ferrari)', color: 'white', border: 'none',
                borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, boxShadow: 'var(--shadow-sm)',
                cursor: podeSalvar ? 'pointer' : 'not-allowed', opacity: podeSalvar ? 1 : 0.5,
                width: isMobile ? '100%' : 'auto', whiteSpace: 'nowrap',
              }}
            >
              {salvando ? 'Salvando…' : nomeSalvo ? <>{Icons.check} Salvo</> : 'Salvar nome'}
            </button>
          </div>
        </form>

        <div style={{
          padding: 16, border: '1px solid var(--color-crit-border)', background: 'var(--color-crit-bg)',
          borderRadius: 10, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-crit)' }}>Excluir minha conta</div>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: tokens.color.text, lineHeight: 1.45 }}>
              {ehDono
                ? 'Apaga a oficina inteira: ordens, orçamentos, estoque, financeiro, agenda, clientes cadastrados por você e o acesso de todos os funcionários. Não dá para desfazer.'
                : 'Remove o seu cadastro e o seu acesso à oficina. Os registros que você já fez continuam com o seu nome. Não dá para desfazer.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExcluindo(true)}
            style={{
              padding: '9px 16px', background: 'transparent', color: 'var(--color-crit)',
              border: '1px solid var(--color-crit)', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700,
              cursor: 'pointer', width: isMobile ? '100%' : 'auto',
            }}
          >
            Excluir conta
          </button>
        </div>
      </div>

      {excluindo && (
        <ExcluirContaModal
          ehDono={ehDono}
          onCancelar={() => setExcluindo(false)}
          onExcluida={() => {
            // A conta (e, para o dono, a oficina) já não existe: sai da sessão e esquece a cópia local.
            if (ehDono) limparDadosLocaisDaOficina();
            logout();
          }}
        />
      )}
    </Card>
  );
}

function ExcluirContaModal({ ehDono, onCancelar, onExcluida }: {
  ehDono: boolean; onCancelar: () => void; onExcluida: () => void;
}) {
  const [segredo, setSegredo] = useState('');          // senha do dono ou PIN do funcionário
  const [palavra, setPalavra] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const segredoOk = ehDono ? segredo.length > 0 : /^\d{6}$/.test(segredo);
  const pode = segredoOk && confirmacaoCorreta(palavra) && !ocupado;

  // Esc fecha — menos no meio do envio (a exclusão já está a caminho).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onCancelar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [ocupado, onCancelar]);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pode) return;
    setOcupado(true);
    setErro('');
    try {
      await api.excluirMinhaConta({
        confirmacao: PALAVRA_CONFIRMACAO,
        ...(ehDono ? { senha: segredo } : { pin: segredo }),
      });
      onExcluida();
    } catch (err) {
      setErro(mensagemDoErro(err, 'Não foi possível excluir a conta.'));
      setOcupado(false);
    }
  };

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={e => { if (e.target === e.currentTarget && !ocupado) onCancelar(); }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Excluir conta"
        style={{
          background: tokens.color.card, borderRadius: 16, width: '100%', maxWidth: 460,
          border: `1px solid ${tokens.color.border}`, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          maxHeight: '100%', overflowY: 'auto',
        }}
      >
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.color.border}` }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-crit)' }}>
            {ehDono ? 'Excluir a oficina e a sua conta?' : 'Excluir a sua conta?'}
          </h3>
        </div>
        <form onSubmit={confirmar} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ehDono ? (
            <div style={{ fontSize: '0.84rem', color: tokens.color.text, lineHeight: 1.5 }}>
              Isto apaga <strong>tudo</strong> da oficina, para sempre:
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>ordens de serviço, fotos e orçamentos;</li>
                <li>estoque, catálogo de serviços e financeiro;</li>
                <li>agenda, clientes e veículos cadastrados pela oficina;</li>
                <li>todos os funcionários (eles perdem o acesso).</li>
              </ul>
              <p style={{ margin: '10px 0 0' }}>
                A conta de cliente que usa o aplicativo não é apagada — só deixa de estar ligada à oficina.
              </p>
            </div>
          ) : (
            <div style={{ fontSize: '0.84rem', color: tokens.color.text, lineHeight: 1.5 }}>
              O seu cadastro e o seu acesso à oficina serão removidos. Os registros que você já fez
              (ordens, lançamentos) continuam, com o seu nome. A oficina e os outros funcionários não são afetados.
            </div>
          )}

          {erro && <div role="alert" style={caixaDeErro}>{erro}</div>}

          <Input
            name="excluir-segredo"
            type={ehDono ? 'password' : 'digits'}
            label={ehDono ? 'Sua senha' : 'Seu PIN (6 números)'}
            maxLength={ehDono ? undefined : 6}
            autoFocus
            value={segredo}
            onChangeValue={v => { setSegredo(v); setErro(''); }}
          />
          <Input
            name="excluir-palavra"
            label={`Para confirmar, digite ${PALAVRA_CONFIRMACAO}`}
            placeholder={PALAVRA_CONFIRMACAO}
            value={palavra}
            onChangeValue={setPalavra}
          />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={onCancelar} disabled={ocupado} style={botaoSecundario}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!pode}
              style={{
                padding: '9px 16px', background: 'var(--color-crit)', color: 'white', border: 'none',
                borderRadius: 10, fontSize: '0.82rem', fontWeight: 700,
                cursor: pode ? 'pointer' : 'not-allowed', opacity: pode ? 1 : 0.5,
              }}
            >
              {ocupado ? 'Excluindo…' : ehDono ? 'Excluir tudo definitivamente' : 'Excluir minha conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
