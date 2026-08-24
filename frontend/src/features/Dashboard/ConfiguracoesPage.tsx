import { useState, useEffect } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';
import { useTheme } from '../../hooks/useTheme';
import { FuncionariosCard } from './Configuracoes/FuncionariosCard';
import { Input } from '../../components/inputs/input';
import { DEFAULT_HORA_ABERTURA, DEFAULT_HORA_FECHAMENTO } from '../../utils/agenda';
import { notificarHorarioAtualizado } from '../../utils/horario_funcionamento';

const WORKSHOP_DEFAULTS = {
  nome: 'RevisaCar Premium',
  cnpj: '12.345.678/0001-95',
  telefone: '(11) 98765-4321',
  email: 'contato@revisacarpremium.com.br',
  endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  valorHora: 120,
  horaAbertura: DEFAULT_HORA_ABERTURA,
  horaFechamento: DEFAULT_HORA_FECHAMENTO,
};

export function ConfiguracoesPage({ isMobile }: { isMobile: boolean }) {
  const { theme, toggleTheme } = useTheme();
  
  // Connection state
  const [online, setOnline] = useState(navigator.onLine);
  
  // PWA installable prompt
  const [installable, setInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Workshop state loaded/saved to localStorage. Mescla com WORKSHOP_DEFAULTS
  // pra preencher campos novos (como o horário de funcionamento) que não
  // existiam ainda em configurações salvas antes dessa funcionalidade.
  const [workshop, setWorkshop] = useState(() => {
    const saved = localStorage.getItem('oficina_config');
    if (saved) {
      try {
        return { ...WORKSHOP_DEFAULTS, ...JSON.parse(saved) };
      } catch {
        return WORKSHOP_DEFAULTS;
      }
    }
    return WORKSHOP_DEFAULTS;
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [horarioTentouSalvar, setHorarioTentouSalvar] = useState(false);
  const horarioInvalido = workshop.horaFechamento <= workshop.horaAbertura;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check PWA prompt status
    const prompt = (window as any).deferredPrompt;
    if (prompt) {
      setInstallable(true);
      setDeferredPrompt(prompt);
    }

    const handleBeforePrompt = (e: any) => {
      setInstallable(true);
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforePrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
    };
  }, []);

  const handleSaveWorkshop = (e: React.FormEvent) => {
    e.preventDefault();
    if (horarioInvalido) {
      setHorarioTentouSalvar(true);
      return;
    }
    localStorage.setItem('oficina_config', JSON.stringify(workshop));
    notificarHorarioAtualizado();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Instalação resultado: ${outcome}`);
    setDeferredPrompt(null);
    setInstallable(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Area */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Configurações do Sistema</h2>
        <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Personalize sua oficina, altere o tema visual e gerencie o app PWA.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* General Form */}
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ color: 'var(--color-ferrari)', display: 'flex' }}>{Icons.cog}</span>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Dados da Oficina</h3>
          </div>

          <form onSubmit={handleSaveWorkshop} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              name="workshop_nome"
              label="Nome Comercial da Oficina"
              required
              value={workshop.nome}
              onChangeValue={v => setWorkshop({ ...workshop, nome: v })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Input
                name="workshop_cnpj"
                type="cpf_cnpj"
                label="CNPJ"
                required
                value={workshop.cnpj}
                onChangeValue={v => setWorkshop({ ...workshop, cnpj: v })}
              />
              <Input
                name="workshop_valor_hora"
                type="currency"
                label="Taxa de Mão de Obra (R$/hora)"
                required
                value={workshop.valorHora ? String(workshop.valorHora) : ''}
                onChangeValue={v => setWorkshop({ ...workshop, valorHora: Number(v) || 0 })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Input
                name="workshop_telefone"
                type="phone"
                label="Telefone / WhatsApp"
                required
                value={workshop.telefone}
                onChangeValue={v => setWorkshop({ ...workshop, telefone: v })}
              />
              <Input
                name="workshop_email"
                type="email"
                label="Email de Atendimento"
                required
                value={workshop.email}
                onChangeValue={v => setWorkshop({ ...workshop, email: v })}
              />
            </div>
            <Input
              name="workshop_endereco"
              label="Endereço da Oficina"
              required
              value={workshop.endereco}
              onChangeValue={v => setWorkshop({ ...workshop, endereco: v })}
            />

            <div>
              <div style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>
                Horário de Funcionamento
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <Input
                  name="workshop_hora_abertura"
                  type="time"
                  label="Abertura"
                  required
                  value={workshop.horaAbertura}
                  onChangeValue={v => setWorkshop({ ...workshop, horaAbertura: v })}
                />
                <Input
                  name="workshop_hora_fechamento"
                  type="time"
                  label="Fechamento"
                  required
                  value={workshop.horaFechamento}
                  onChangeValue={v => setWorkshop({ ...workshop, horaFechamento: v })}
                  error={horarioTentouSalvar && horarioInvalido ? 'Deve ser depois do horário de abertura.' : undefined}
                />
              </div>
              <span style={{ fontSize: '0.7rem', color: tokens.color.muted }}>
                Define automaticamente os horários disponíveis na tela de Agendamentos.
              </span>
            </div>
            
            {savedSuccess && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--color-ok-bg)',
                color: 'var(--color-ok)',
                border: '1px solid var(--color-ok-border)',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'center',
              }}>
                Configurações da oficina salvas com sucesso!
              </div>
            )}

            <button
              type="submit"
              style={{
                alignSelf: 'flex-end',
                padding: '10px 22px',
                background: 'var(--color-ferrari)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              Salvar Dados
            </button>
          </form>
        </Card>

        {/* Sidebar Controls (Theme & Network) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Theme card */}
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Aparência do Sistema
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={theme === 'dark' ? toggleTheme : undefined}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: theme === 'light' ? 'var(--color-ferrari-glow)' : 'transparent',
                  color: theme === 'light' ? 'var(--color-ferrari)' : tokens.color.textSecond,
                  border: `1px solid ${theme === 'light' ? 'var(--color-ferrari)' : tokens.color.border}`,
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                Claro
              </button>
              <button
                onClick={theme === 'light' ? toggleTheme : undefined}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: theme === 'dark' ? 'var(--color-ferrari-glow)' : 'transparent',
                  color: theme === 'dark' ? 'var(--color-ferrari)' : tokens.color.textSecond,
                  border: `1px solid ${theme === 'dark' ? 'var(--color-ferrari)' : tokens.color.border}`,
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                Carbono
              </button>
            </div>
          </Card>

          {/* Network & PWA Card */}
          <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Status de Conectividade
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: online ? 'var(--color-ok)' : 'var(--color-crit)',
                  boxShadow: online ? '0 0 8px var(--color-ok)' : '0 0 8px var(--color-crit)',
                }} />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: tokens.color.text }}>
                  {online ? 'Dispositivo Online' : 'Modo Offline Ativo'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 6, lineHeight: 1.4 }}>
                {online 
                  ? 'Você está sincronizado com a nuvem em tempo real.' 
                  : 'Suas ordens e fotos de inspeção serão salvas localmente e sincronizadas quando restabelecer a conexão.'}
              </p>
            </div>

            {installable && (
              <div style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: 14 }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Aplicativo Instalável
                </div>
                <button
                  onClick={handleInstallPWA}
                  style={{
                    width: '100%',
                    padding: '11px',
                    background: 'var(--color-ferrari)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {Icons.plus} Instalar RevisaCar
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <FuncionariosCard isMobile={isMobile} />
    </div>
  );
}