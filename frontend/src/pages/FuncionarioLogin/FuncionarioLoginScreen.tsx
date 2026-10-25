import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../utils/api';
import { Input } from '../../components/inputs/input';
import { FuncionarioPicker } from './FuncionarioPicker';
import type { FuncionarioPublico } from './FuncionarioPicker';
import { PinEntry } from './PinEntry';
import type { AuthResult } from '../../types';
import type { AuthFlow } from '../auth/authFlows';

const DEVICE_OFICINA_KEY = 'revisacarDeviceOficinaDoc';

type Step = 'pareamento' | 'login' | 'esqueci-solicitar' | 'esqueci-enviado';

interface Props {
  onAuthenticated: (result: AuthResult) => void;
  /** Avisa o painel da marca em qual fluxo/etapa esta tela está (acende o quadrado). */
  onProgress?: (flow: AuthFlow, step: number) => void;
}

/**
 * Formulário do FUNCIONÁRIO (nome + PIN). O layout, a logo e o botão para
 * voltar ao login do dono ficam no painel da marca (AuthShell) — aqui só
 * existe o conteúdo do lado do formulário.
 */
export function FuncionarioLoginScreen({ onAuthenticated, onProgress }: Props) {
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

  // Quadrados do painel: 1 Selecione um funcionário (inclui o pareamento do
  // aparelho) · 2 Entre na sua conta (PIN) · 3 Recupere seu PIN.
  const quadrado = step === 'login' ? (selecionado ? 1 : 0) : step === 'pareamento' ? 0 : 2;
  useEffect(() => {
    onProgress?.('funcionario', quadrado);
  }, [quadrado, onProgress]);

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

  const handlePareamento = (e: FormEvent) => {
    e.preventDefault();
    const doc = docInput;
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

  const handleSolicitarPin = (e: FormEvent) => {
    e.preventDefault();
    solicitarPin();
  };

  const voltarAoLogin = () => {
    setStep('login');
    setErro('');
    setPin('');
  };

  return (
    <div className="auth-view" key={step}>
      {step === 'pareamento' && (
        <form onSubmit={handlePareamento}>
          <h1 className="auth-title">Configurar este dispositivo</h1>
          <p className="auth-subtitle">
            Digite o CNPJ da oficina pra habilitar o login dos funcionários neste aparelho. Só precisa fazer isso uma vez.
          </p>
          <Input
            name="pareamento_cnpj"
            type="cpf_cnpj"
            label="CNPJ da oficina"
            autoFocus
            value={docInput}
            onChangeValue={setDocInput}
            placeholder="00.000.000/0000-00"
          />
          {erro && <p className="auth-inline-error">{erro}</p>}
          <button type="submit" className="auth-btn">Continuar</button>
        </form>
      )}

      {step === 'login' && (
        <div>
          <h1 className="auth-title">Login de funcionário</h1>
          <p className="auth-subtitle">Escolha seu nome pra começar.</p>

          <FuncionarioPicker
            funcionarios={funcionarios}
            loading={carregandoLista}
            open={pickerOpen}
            onToggleOpen={() => setPickerOpen((o) => !o)}
            selecionado={selecionado}
            onSelect={handleSelecionar}
          />

          {selecionado && (
            <div style={{ marginTop: 24 }}>
              <p className="auth-center" style={{ margin: '0 0 14px', fontSize: '0.86rem', fontWeight: 600 }}>
                Digite seu PIN pra confirmar
              </p>

              <PinEntry value={pin} onChange={setPin} disabled={enviando} />

              <div className="auth-center" style={{ marginTop: 12 }}>
                <button type="button" className="auth-link" onClick={() => setStep('esqueci-solicitar')}>
                  Esqueceu o PIN?
                </button>
              </div>

              {erro && <p className="auth-inline-error">{erro}</p>}

              <button
                type="button"
                className="auth-btn"
                style={{ marginTop: 14 }}
                onClick={handleEntrar}
                disabled={pin.length !== 6 || enviando}
              >
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          )}

          {!selecionado && erro && <p className="auth-inline-error">{erro}</p>}
        </div>
      )}

      {step === 'esqueci-solicitar' && (
        <form onSubmit={handleSolicitarPin}>
          <h1 className="auth-title">Esqueceu seu PIN?</h1>
          <p className="auth-subtitle">Sem problema — vamos te mandar um PIN novo por email.</p>
          <Input
            name="esqueci_pin_email"
            type="email"
            label="Email cadastrado"
            autoFocus
            required
            value={emailRecuperacao}
            onChangeValue={setEmailRecuperacao}
            placeholder="seu@email.com"
          />
          {erro && <p className="auth-inline-error">{erro}</p>}
          <button type="submit" className="auth-btn" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Solicitar novo PIN'}
          </button>
          <p className="auth-foot">
            <button type="button" className="auth-link" onClick={voltarAoLogin}>Voltar ao login</button>
          </p>
        </form>
      )}

      {step === 'esqueci-enviado' && (
        <div className="auth-center">
          <h1 className="auth-title">Verifique seu email</h1>
          <p className="auth-subtitle">
            Enviamos um novo PIN para <strong style={{ color: 'var(--color-text)' }}>{emailRecuperacao}</strong>
          </p>
          <button type="button" className="auth-link" onClick={solicitarPin} disabled={enviando}>
            Não recebeu? Reenviar
          </button>
          {erro && <p className="auth-inline-error">{erro}</p>}
          <p className="auth-foot">
            <button type="button" className="auth-link" onClick={voltarAoLogin}>Voltar ao login</button>
          </p>
        </div>
      )}
    </div>
  );
}
