import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../components/ui';
import { NewAppointmentModal } from '../Agendamentos/NewAppointmentModal';
import { customersApi } from '../../../services/api';
import type { CustomerProfile } from '../../../types';
import { CalendarPlus } from 'lucide-react';

export function ClientesPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch customer data
  useEffect(() => {
    const loadCustomer = async () => {
      try {
        setIsLoading(true);
        const data = await customersApi.getById(customerId);
        setCustomer(data);
      } catch (err) {
        console.error('Failed to load customer:', err);
        navigate('/dashboard/clientes');
      } finally {
        setIsLoading(false);
      }
    };

    if (customerId) {
      loadCustomer();
    }
  }, [customerId, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-[20vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand rounded-full border-t-brand-transparent animate-spin"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-text">Cliente não encontrado</p>
        <Button onClick={() => navigate('/dashboard/clientes')}>
          Voltar
        </Button>
      </div>
    );
  }

  const handleOpenModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const handleAppointmentCreated = () => {
    setIsModalOpen(false);
    // Optionally refetch customer data to show updated appointments
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-text">Dados do Cliente</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/clientes')}>
              Voltar para lista
            </Button>
          </div>
        </div>

        {/* Customer Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-info-bg rounded-xl flex items-center justify-center">
              <span className="text-text font-bold text-[24px]">{customer.name?.charAt(0) ?? '?'}</span>
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-bold text-text">{customer.name}</p>
              <p className="text-text-muted">
                {customer.email ?? 'Email não informado'}
              </p>
              {customer.phone && (
                <p className="text-text-muted">
                  {customer.phone}
                </p>
              )}
              {customer.address && (
                <p className="text-text-muted">
                  {customer.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Section */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-xl font-bold text-text mb-4">Agendamentos</h2>

        {/* New Appointment Button */}
        <div className="mb-6">
          <Button
            onClick={handleOpenModal}
            className="w-full flex items-center justify-center gap-2"
          >
            <CalendarPlus size={20} /> Agendar Novo Horário
          </Button>
        </div>

        {/* Placeholder for existing appointments */}
        <div className="min-h-[200px] bg-border/5 rounded-xl border border-border-dashed">
          <p className="text-text-muted text-center py-12">
            Nenhum agendamento encontrado para este cliente.
          </p>
        </div>
      </div>

      {/* New Appointment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <NewAppointmentModal
              customerId={customer.id}
              onClose={closeModal}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}