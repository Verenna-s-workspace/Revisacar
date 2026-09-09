import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, UserPlus, Mail, Phone, MapPin, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Button, Input, Divider } from '../ui';
import { AuthLayout } from '../layout';

/* ─── Schemas ───────────────────────────────────────── */
const mechanicClientSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone inválido').optional(),
  document: z.string()
    .refine(
      (value) => {
        const digits = value.replace(/\D/g, '');
        return digits.length === 11 || digits.length === 14;
      },
      { message: 'Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)' }
    )
    .transform((value) => value.replace(/\D/g, '')),
  pincode: z.string().length(6, 'PIN deve ter exatamente 6 dígitos').regex(/^\d+$/, 'PIN deve conter apenas números'),
});

type MechanicClientForm = z.infer<typeof mechanicClientSchema>;

/* ─── Mechanic Client Register Screen ───────────────────── */
export function MechanicClientRegister() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const navigate = useNavigate();
  const { session } = useAuthStore.getState();

  // Check if user is authenticated as mechanic
  if (!session) {
    toast.error('Você precisa estar logado para cadastrar clientes');
    navigate('/auth');
    return null;
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MechanicClientForm>({
    resolver: zodResolver(mechanicClientSchema),
  });

  const onSubmit = async (data: MechanicClientForm) => {
    try {
      await apiClient.post('/customer/mechanic/clients', data);
      setStep('success');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao cadastrar cliente');
    }
  };

  return (
    <AuthLayout>
      <div className="flex-1 bg-bg px-5 py-6">
        {step === 'form' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-text">
                  Pré-cadastro de Cliente
                </h2>
                <p className="text-sm text-text-muted">
                  Mecanico: <span className="font-medium">{session.name}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Nome completo"
                  type="text"
                  placeholder="João Silva"
                  error={errors.name?.message}
                  {...register('name')}
                />

                <Input
                  label="E-mail"
                  type="email"
                  placeholder="joao@email.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Input
                  label="Telefone (opcional)"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  error={errors.phone?.message}
                  {...register('phone')}
                />

                <Input
                  label="CPF ou CNPJ"
                  type="tel"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  error={errors.document?.message}
                  {...register('document')}
                />

                <Input
                  label="PIN de 6 dígitos"
                  type="password"
                  placeholder="Digite um PIN de 6 dígitos"
                  error={errors.pincode?.message}
                  {...register('pincode')}
                />

                <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-2">
                  <UserPlus size={17} />
                  Cadastrar Cliente
                </Button>
              </form>

              <div className="text-center text-xs text-text-muted mt-6">
                <Link to="/auth">
                  Voltar para login
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="text-center space-y-6 py-12">
              <div className="flex items-center justify-center w-16 h-16 bg-ok-bg rounded-xl">
                <Check size={20} className="text-ok" />
              </div>

              <h2 className="text-2xl font-bold text-text">Cliente cadastrado!</h2>

              <p className="text-sm text-text-muted max-w-md">
                O cliente foi cadastrado com sucesso e já pode usar seu PIN de 6 dígitos para fazer login no aplicativo.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="outline"
                  fullWidth
                  sm:fullWidth="false"
                  onClick={() => navigate('/auth')}
                >
                  Fazer login como mecânico
                </Button>

                <Button
                  fullWidth
                  sm:fullWidth="false"
                  onClick={() => navigate('/')}
                >
                  Ir para o painel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </AuthLayout>
  );
}