import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Button, Input, Divider } from '../ui';
import { AuthLayout } from '../layout';

/* ─── Schemas ───────────────────────────────────────────── */
const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
const registerSchema = z.object({
  name:             z.string().min(2, 'Nome muito curto'),
  email:            z.string().email('E-mail inválido'),
  phone:            z.string().min(10, 'Telefone inválido'),
  password:         z.string().min(6, 'Mínimo 6 caracteres'),
  password_confirm: z.string(),
}).refine(d => d.password === d.password_confirm, {
  path: ['password_confirm'],
  message: 'As senhas não coincidem',
});

type LoginForm    = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

/* ─── Hero ──────────────────────────────────────────────── */
function Hero() {
  return (
    <div className="relative bg-gradient-to-br from-brand via-[#A81000] to-brand-deep
                    px-6 pt-16 pb-14 flex flex-col items-center gap-3 overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/[0.04]" />
      <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/[0.03]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,_rgba(255,255,255,0.07)_0%,_transparent_60%)]" />

      {/* Logo mark */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-[72px] h-[72px] bg-white/12 backdrop-blur-sm rounded-[22px]
                   flex items-center justify-center border border-white/20 shadow-xl"
      >
        <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
          <circle cx="20" cy="20" r="17" stroke="white" strokeWidth="2" />
          <path d="M11 21.5 Q15.5 13.5 20 16 Q24.5 18.5 29 13.5"
                stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <circle cx="13" cy="28" r="3" fill="white" />
          <circle cx="27" cy="28" r="3" fill="white" />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        className="relative z-10 text-center"
      >
        <div className="font-logo text-[2.2rem] font-semibold text-white leading-none tracking-tight">
          Revisa<span className="text-white/70">car</span>
        </div>
        <div className="text-[0.72rem] font-semibold text-white/60 uppercase tracking-[0.2em] mt-2">
          Área do Cliente
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Google Button ─────────────────────────────────────── */
function GoogleButton() {
  return (
    <button
      type="button"
      onClick={() => toast('Login com Google em breve')}
      className="w-full flex items-center justify-center gap-3 py-3 px-4
                 border-[1.5px] border-border rounded-xl text-sm font-semibold text-text-2
                 bg-white hover:bg-surface-2 hover:border-border-md transition-all active:scale-[0.98]"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continuar com Google
    </button>
  );
}

/* ─── Login Form ────────────────────────────────────────── */
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [showPw, setShowPw] = useState(false);
  const { setSession } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await authApi.login(data.email, data.password);
      setSession({
        id: res.data.customer.id,
        name: res.data.customer.name,
        email: res.data.customer.email,
        access: res.data.access,
        refresh: res.data.refresh,
      });
      toast.success(`Bem-vindo de volta, ${res.data.customer.name.split(' ')[0]}!`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'E-mail ou senha incorretos');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="E-mail"
        type="email"
        placeholder="seu@email.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Senha"
        type={showPw ? 'text' : 'password'}
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password?.message}
        suffix={
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="text-text-subtle hover:text-text transition-colors p-1">
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...register('password')}
      />

      <div className="flex justify-end -mt-1">
        <Link to="/esqueci-senha"
          className="text-xs font-semibold text-brand hover:underline underline-offset-2">
          Esqueci minha senha
        </Link>
      </div>

      <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-1">
        <LogIn size={17} />
        Entrar na conta
      </Button>

      <Divider label="ou" className="my-1" />
      <GoogleButton />
    </form>
  );
}

/* ─── Register Form ─────────────────────────────────────── */
function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [showPw, setShowPw] = useState(false);
  const { setSession } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const res = await authApi.register(data);
      setSession({
        id: res.data.customer.id,
        name: res.data.customer.name,
        email: res.data.customer.email,
        access: res.data.access,
        refresh: res.data.refresh,
      });
      toast.success('Conta criada com sucesso! 🎉');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao criar conta');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="Nome completo" type="text" placeholder="João Silva"
        error={errors.name?.message} {...register('name')} />
      <Input label="E-mail" type="email" placeholder="seu@email.com"
        error={errors.email?.message} {...register('email')} />
      <Input label="Telefone" type="tel" placeholder="(11) 99999-9999"
        error={errors.phone?.message} {...register('phone')} />
      <Input
        label="Senha"
        type={showPw ? 'text' : 'password'}
        placeholder="Mínimo 6 caracteres"
        error={errors.password?.message}
        suffix={
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="text-text-subtle hover:text-text transition-colors p-1">
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...register('password')}
      />
      <Input label="Confirmar senha" type="password" placeholder="Repita a senha"
        error={errors.password_confirm?.message} {...register('password_confirm')} />

      <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-1">
        <UserPlus size={17} />
        Criar minha conta
      </Button>

      <p className="text-xs text-center text-text-subtle leading-relaxed">
        Ao criar uma conta você concorda com nossos{' '}
        <span className="text-brand font-semibold cursor-pointer">Termos de Uso</span>
        {' '}e{' '}
        <span className="text-brand font-semibold cursor-pointer">Política de Privacidade</span>.
      </p>
    </form>
  );
}

/* ─── Auth Screen ───────────────────────────────────────── */
export function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <Hero />

      <div className="flex-1 bg-bg px-5 py-6">
        {/* Segmented control */}
        <div className="flex bg-surface-3 rounded-2xl p-1 mb-6 gap-1">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors duration-150"
            >
              {tab === t && (
                <motion.div
                  layoutId="auth-tab"
                  className="absolute inset-0 bg-white rounded-xl shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className={`relative z-10 ${tab === t ? 'text-text' : 'text-text-muted'}`}>
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </span>
            </button>
          ))}
        </div>

        {/* Forms */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === 'login' ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === 'login' ? 12 : -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {tab === 'login'
              ? <LoginForm onSuccess={() => navigate('/')} />
              : <RegisterForm onSuccess={() => navigate('/')} />
            }
          </motion.div>
        </AnimatePresence>
      </div>
    </AuthLayout>
  );
}
