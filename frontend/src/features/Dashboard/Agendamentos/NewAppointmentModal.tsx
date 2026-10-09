import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarPlus, Check, Clock, Car } from 'lucide-react';
import { Button, Input, Select } from '../../../components/ui';
import { MainLayout, Topbar, BottomSheet } from '../../../components/layout';
import type { Vehicle } from '../../../types';
import { appointmentsApi, vehiclesApi } from '../../../services/api';

// Appointment form schema
const appointmentSchema = z.object({
  vehicleId: z.string(),
  serviceType: z.string().min(1, 'Selecione um tipo de serviço'),
  date: z.string().refine((date) => {
    // Validate that the date is not in the past
    const today = new Date();
    const inputDate = new Date(date);
    return inputDate.setHours(0,0,0,0) >= today.setHours(0,0,0,0);
  }, 'A data não pode ser no passado'),
  timeSlot: z.string().min(1, 'Selecione um horário'),
});

export const NewAppointmentModal = ({
  onClose,
  customerId
}: {
  onClose: () => void;
  customerId: string;
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      vehicleId: '',
      serviceType: '',
      date: '',
      timeSlot: '',
    },
  });

  // Fetch vehicles for the select
  const { data: vehicles = [], isLoading: isLoadingVehicles, refetch } = useQuery({
    queryKey: ['vehicles', customerId],
    queryFn: () => vehiclesApi.list(customerId),
  });

  const onSubmit = async (data: z.infer<typeof appointmentSchema>) => {
    setIsLoading(true);
    try {
      await appointmentsApi.create({
        customer_id: customerId,
        vehicle_id: data.vehicleId,
        service_type: data.serviceType,
        date: data.date,
        time_slot: data.timeSlot,
      });

      toast.success('Agendamento criado com sucesso!');
      reset();
      onClose();

      // Refetch appointments and dashboard
      queryClient.invalidateQueries({ queryKey: ['appointments', customerId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar agendamento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end p-4"
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          exit={{ y: 20 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-lg"
        >
          <div className="flex justify-between items-start p-6">
            <h2 className="text-xl font-bold text-gray-900">Agendar Novo Horário</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="p-1"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
            <div>
              <Label htmlFor="vehicle">Veículo</Label>
              <Select
                id="vehicle"
                placeholder="Selecione um veículo"
                {...register('vehicleId')}
              >
                {isLoadingVehicles ? (
                  <option>Carregando...</option>
                ) : (
                  <>
                    <option value="">Selecione um veículo</option>
                    {vehicles.map((vehicle: Vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.placa} - {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </option>
                    ))}
                  </>
                )}
              </Select>
              {errors.vehicleId && (
                <p className="text-sm text-red-600">{errors.vehicleId.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="serviceType">Tipo de Serviço</Label>
              <Input
                id="serviceType"
                placeholder="Ex: Troca de óleo, Revisão, etc."
                {...register('serviceType')}
              />
              {errors.serviceType && (
                <p className="text-sm text-red-600">{errors.serviceType.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  {...register('date')}
                />
                {errors.date && (
                  <p className="text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="timeSlot">Horário</Label>
                <Select
                  id="timeSlot"
                  placeholder="Selecione um horário"
                  {...register('timeSlot')}
                >
                  <option value="">Selecione um horário</option>
                  {[...Array(24).keys()].map((hour) => {
                    const formattedHour = String(hour).padStart(2, '0');
                    return (
                      <option key={formattedHour} value={`${formattedHour}:00`}>
                        {formattedHour}:00
                      </option>
                    );
                  })}
                </Select>
                {errors.timeSlot && (
                  <p className="text-sm text-red-600">{errors.timeSlot.message}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Agendando...' : 'Agendar Horário'}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const Label = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);