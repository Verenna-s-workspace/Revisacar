import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../../constants';
import { api } from '../../utils/api';
import { useResponsive } from '../../components/ui';
import { BrandPanel } from './BrandPanel';
import { FuncionarioPicker } from './FuncionarioPicker';
import type { FuncionarioPublico } from './FuncionarioPicker';
import { PinEntry } from './PinEntry';
import type { AuthResult } from '../../types';

const DEVICE_OFICINA_KEY = 'revisacarDeviceOficinaDoc';

type Step = 'pareamento' | 'login' | 'esqueci-solicitar' | 'esqueci-enviado';

const normalizeDoc = (value: string) => value.replace(/\D/g, '').slice(0, 14);

interface Props {
  onAuthenticated: (result: AuthResult) => void;
  onVoltarParaDono: () => void;
}

export function FuncionarioLoginScreen({ onAuthenticated, onVoltarParaDono }: Props) {
  const { isMobile } = useResponsive();

  const [oficinaDoc, setOficinaDoc] = useState<string>(() => localStorage.getItem(DEVICE_OFICINA_KEY) || '');
  const [step, setStep] = useState<Step>(oficinaDoc ? 'login' : 'pareamento');
  const [docInput, setDocInput] = useState('');

  const [funcionarios, setFuncionarios] = useState<FuncionarioPublico[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<FuncionarioPublico | null>(null);

  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const [emailRecuperacao, setEmailRecuperacao] = useState('');

  const carregarFuncionarios = useCallback((doc: string) => {
    setCarregandoLista(true);
    api.listarFuncionariosPublicos(doc)
      .then((data: FuncionarioPublico[]) => setFuncionarios(data))
      .catch(() => setErro('Não foi possível carregar a lista de funcionários.'))
      .finally(() => setCarregandoLista(false));
  }, []);

  useEffect(() => {
    if (step === 'login' && oficinaDoc) carregarFuncionarios(oficinaDoc);
  }, [step, oficinaDoc, carregarFuncionarios]);

  const handlePareamento = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = normalizeDoc(docInput);
    if (doc.length !== 14) {
      setErro('CNPJ deve ter 14 dígitos');
      return;
    }
    setErro('');
    localStorage.setItem(DEVICE_OFICINA_KEY, doc);
    setOficinaDoc(doc);
    setStep('login');
  };

  const handleSelecionar = (f: FuncionarioPublico) => {
    setSelecionado(f);
    setPickerOpen(false);
    setPin('');
    setErro('');
  };

  const handleEntrar = async () => {
    if (!selecionado || pin.length !== 6) return;
    setEnviando(true);
    setErro('');
    try {
      const result = await api.loginFuncionarioPin({ funcionario_id: selecionado.id, pin });
      onAuthenticated(result as AuthResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(/"/g, '') : 'Não foi possível entrar';
      setErro(msg);
      setPin('');
    } finally {
      setEnviando(false);
    }
  };

  const solicitarPin = async () => {
    setEnviando(true);
    setErro('');
    try {
      await api.esqueciPin(emailRecuperacao.trim().toLowerCase());
      setStep('esqueci-enviado');
    } catch (err) {
      setErro(err instanceof Error ? err.message.replace(/"/g, '') : 'Erro ao solicitar PIN');
    } finally {
      setEnviando(false);
    }
  };

  const handleSolicitarPin = (e: React.FormEvent) => {
    e.preventDefault();
    solicitarPin();
  };

  const voltarAoLogin = () => {
    setStep('login');
    setErro('');
    setPin('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: tokens.color.bg }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        position: 'relative',
      }}>
        {isMobile && (
          <div style={{ fontFamily: tokens.fontLogo, fontSize: '1.6rem', color: tokens.color.ferrari, marginBottom: 28 }}>
            RevisaCar
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 380 }}>
          {step === 'pareamento' && (
            <form onSubmit={handlePareamento}>
              <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', color: tokens.color.text }}>Configurar este dispositivo</h1>
              <p style={{ margin: '0 0 22px', fontSize: '0.86rem', color: tokens.color.muted }}>
                Digite o CNPJ da oficina pra habilitar o login dos funcionários neste aparelho. Só precisa fazer isso uma vez.
              </p>
              <label style={fieldLabel}>CNPJ DA OFICINA</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={docInput}
                onChange={e => setDocInput(e.target.value)}
                placeholder="00.000.000/0000-00"
                style={fieldInput}
              />
              {erro && <p style={errorText}>{erro}</p>}
              <button type="submit" style={primaryButton}>Continuar</button>
            </form>
          )}

          {step === 'login' && (
            <div>
              <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', color: tokens.color.text }}>Login de Funcionário</h1>
              <p style={{ margin: '0 0 22px', fontSize: '0.86rem', color: tokens.color.muted }}>
                Escolha seu nome pra começar.
              </p>

              <FuncionarioPicker
                funcionarios={funcionarios}
                loading={carregandoLista}
                open={pickerOpen}
                onToggleOpen={() => setPickerOpen(o => !o)}
                selecionado={selecionado}
                onSelect={handleSelecionar}
              />

              {selecionado && (
                <div style={{ marginTop: 28 }}>
                  <p style={{ textAlign: 'center', fontSize: '0.86rem', fontWeight: 600, color: tokens.color.text, marginBottom: 16 }}>
                    Digite seu PIN pra confirmar
                  </p>

                  <PinEntry value={pin} onChange={setPin} disabled={enviando} />

                  <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button type="button" onClick={() => setStep('esqueci-solicitar')} style={linkButton}>
                      Esqueceu o PIN?
                    </button>
                  </div>

                  {erro && <p style={{ ...errorText, textAlign: 'center' }}>{erro}</p>}

                  <button
                    type="button"
                    onClick={handleEntrar}
                    disabled={pin.length !== 6 || enviando}
                    style={{ ...primaryButton, marginTop: 16, opacity: pin.length !== 6 || enviando ? 0.6 : 1 }}
                  >
                    {enviando ? 'Entrando…' : 'Entrar'}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'esqueci-solicitar' && (
            <form onSubmit={handleSolicitarPin}>
              <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', color: tokens.color.text }}>Esqueceu seu PIN?</h1>
              <p style={{ margin: '0 0 22px', fontSize: '0.86rem', color: tokens.color.muted }}>
                Sem problema — vamos te mandar um PIN novo por email.
              </p>
              <label style={fieldLabel}>EMAIL CADASTRADO</label>
              <input
                type="email"
                autoFocus
                required
                value={emailRecuperacao}
                onChange={e => setEmailRecuperacao(e.target.value)}
                placeholder="seu@email.com"
                style={fieldInput}
              />
              {erro && <p style={errorText}>{erro}</p>}
              <button type="submit" disabled={enviando} style={{ ...primaryButton, opacity: enviando ? 0.6 : 1 }}>
                {enviando ? 'Enviando…' : 'Solicitar novo PIN'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button type="button" onClick={voltarAoLogin} style={linkButton}>Voltar ao login</button>
              </div>
            </form>
          )}

          {step === 'esqueci-enviado' && (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem', color: tokens.color.text }}>Verifique seu email</h1>
              <p style={{ margin: '0 0 22px', fontSize: '0.86rem', color: tokens.color.muted }}>
                Enviamos um novo PIN para <strong style={{ color: tokens.color.text }}>{emailRecuperacao}</strong>
              </p>
              <button type="button" onClick={solicitarPin} style={linkButton}>
                Não recebeu? Reenviar
              </button>
              <div style={{ marginTop: 16 }}>
                <button type="button" onClick={voltarAoLogin} style={linkButton}>Voltar ao login</button>
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={onVoltarParaDono} style={{ ...linkButton, position: 'absolute', bottom: 20, fontSize: '0.78rem' }}>
          Sou o dono da oficina →
        </button>
      </div>

      {!isMobile && (
        <div style={{ width: '42%', minWidth: 340 }}>
          <BrandPanel />
        </div>
      )}
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.76rem',
  fontWeight: 700,
  color: tokens.color.textSecond,
  marginBottom: 6,
};

const fieldInput: React.CSSProperties = {
  width: '100%',
  padding: 12,
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 10,
  color: tokens.color.text,
  fontSize: '0.92rem',
  marginBottom: 18,
};

const primaryButton: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  background: tokens.color.ferrari,
  color: 'white',
  border: 'none',
  borderRadius: 10,
  fontSize: '0.92rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const linkButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: tokens.color.ferrari,
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 4,
};

const errorText: React.CSSProperties = {
  color: tokens.color.crit,
  fontSize: '0.8rem',
  fontWeight: 600,
  margin: '-8px 0 14px',
};