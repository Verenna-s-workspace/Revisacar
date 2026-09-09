import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addMonths, subMonths, startOfMonth, getDaysInMonth,
  getDay, format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Check, Car,
  Wrench, RotateCcw, Gauge, Wind, Plus, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { vehiclesApi, availabilityApi, appointmentsApi } from '../../services/api';
import { Button, Spinner } from '../ui';
import { MainLayout, Topbar } from '../layout';
import { clsx } from 'clsx';

/* ─── Step Progress ─────────────────────────────────────── */
const STEP_LABELS = ['Serviço', 'Data', 'Horário', 'Confirmar'];

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center px-4 py-4 bg-white border-b border-border">
      {STEP_LABELS.map((label, i) => {
        const num  = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all z-10',
                done   ? 'bg-brand border-brand text-white'       :
                active ? 'bg-crit-bg border-brand text-brand'     :
                         'bg-white border-border text-text-subtle'
              )}>
                {done ? <Check size={13} strokeWidth={3} /> : num}
              </div>
              <span className={clsx(
                'text-2xs font-semibold whitespace-nowrap',
                active ? 'text-brand' : done ? 'text-text-3' : 'text-text-subtle'
              )}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={clsx(
                'flex-1 h-0.5 mx-1.5 mb-4 rounded-full transition-all duration-300',
                done ? 'bg-brand' : 'bg-border'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Vehicle Picker ────────────────────────────────────── */
function VehiclePicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.list().then(r => r.data),
  });
  useEffect(() => {
    if (!selected && vehicles.length > 0)
      onSelect(vehicles.find(v => v.is_active)?.id || vehicles[0].id);
  }, [vehicles, selected, onSelect]);

  const active = vehicles.find(v => v.id === selected) ?? vehicles[0];
  if (!active) return null;

  return (
    <div className="mx-4 mt-4 bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-xs">
      <div className="w-9 h-9 bg-crit-bg rounded-xl flex items-center justify-center">
        <Car size={17} className="text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-text leading-tight truncate">
          {active.brand} {active.model} {active.year}
        </p>
        <p className="text-xs text-text-muted">{active.plate} · {active.mileage?.toLocaleString('pt-BR')} km</p>
      </div>
      {vehicles.length > 1 && (
        <button className="text-xs font-bold text-brand hover:underline">Trocar</button>
      )}
    </div>
  );
}

/* ─── Services ──────────────────────────────────────────── */
const SERVICES = [
  { id: 'oleo',        name: 'Troca de Óleo e Filtros',        desc: 'Óleo motor + filtro de óleo + filtro de ar',  icon: Gauge,    bg: 'bg-crit-bg',     ic: 'text-crit'     },
  { id: 'revisao',     name: 'Revisão Geral',                  desc: 'Inspeção completa de 50+ itens do veículo',   icon: Wrench,   bg: 'bg-info-bg',     ic: 'text-info'     },
  { id: 'freios',      name: 'Revisão dos Freios',             desc: 'Pastilhas, discos, fluido e sistema ABS',     icon: RotateCcw,bg: 'bg-warn-bg',     ic: 'text-warn'     },
  { id: 'alinhamento', name: 'Alinhamento e Balanceamento',    desc: 'Geometria e equilíbrio das rodas',            icon: Zap,      bg: 'bg-ok-bg',       ic: 'text-ok'       },
  { id: 'ar',          name: 'Manutenção do Ar-condicionado',  desc: 'Higienização, carga de gás e filtros',        icon: Wind,     bg: 'bg-surface-3',   ic: 'text-text-muted' },
  { id: 'outro',       name: 'Outro serviço',                  desc: 'Descreva o que seu veículo precisa',          icon: Plus,     bg: 'bg-surface-3',   ic: 'text-text-muted' },
];

function Step1({ selected, onSelect, onNext }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void;
}) {
  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest px-0.5">
        Selecione o serviço
      </p>
      {SERVICES.map(({ id, name, desc, icon: Icon, bg, ic }) => {
        const sel = selected === id;
        return (
          <motion.button
            key={id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(id)}
            className={clsx(
              'flex items-center gap-3.5 p-4 rounded-2xl border-[1.5px] text-left transition-all duration-150',
              sel ? 'border-brand bg-crit-bg shadow-sm' : 'border-border bg-white hover:border-border-md'
            )}
          >
            <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', bg, ic)}>
              <Icon size={21} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-text leading-tight">{name}</p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <div className={clsx(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
              sel ? 'bg-brand border-brand' : 'border-border'
            )}>
              {sel && <Check size={11} strokeWidth={3} className="text-white" />}
            </div>
          </motion.button>
        );
      })}
      <Button fullWidth size="lg" disabled={!selected} onClick={onNext} className="mt-1">
        Próximo: Escolher Data <ChevronRight size={17} />
      </Button>
    </div>
  );
}

/* ─── Calendar ──────────────────────────────────────────── */
const WEEKDAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function Step2({ selected, onSelect, onNext, onBack }: {
  selected: string; onSelect: (d: string) => void; onNext: () => void; onBack: () => void;
}) {
  const [view, setView] = useState(new Date());
  const y = view.getFullYear(), m = view.getMonth();

  const { data: avail, isLoading } = useQuery({
    queryKey: ['availability', y, m + 1],
    queryFn: () => availabilityApi.getDays(y, m + 1).then(r => r.data.available_dates),
    staleTime: 60_000,
  });

  const availSet = new Set(avail || []);
  const firstDow = getDay(startOfMonth(view));
  const days     = getDaysInMonth(view);
  const today    = new Date(); today.setHours(0,0,0,0);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <button
            onClick={() => setView(subMonths(view, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-3 text-text-muted transition-colors"
          >
            <ChevronLeft size={19} />
          </button>
          <span className="font-bold text-sm text-text">
            {MONTHS_PT[m]} {y}
          </span>
          <button
            onClick={() => setView(addMonths(view, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-3 text-text-muted transition-colors"
          >
            <ChevronRight size={19} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-3 pt-3 pb-1">
          {WEEKDAYS_SHORT.map(d => (
            <div key={d} className="text-center text-2xs font-bold text-text-subtle uppercase py-1">{d}</div>
          ))}
        </div>

        {/* Days */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner className="text-brand" /></div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5 px-3 pb-4">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dt = new Date(y, m, day);
              const past   = dt < today;
              const isAvail= availSet.has(dateStr) && !past;
              const isSel  = selected === dateStr;
              const isToday= dt.getTime() === today.getTime();
              return (
                <button
                  key={day}
                  disabled={!isAvail}
                  onClick={() => onSelect(dateStr)}
                  className={clsx(
                    'w-full aspect-square rounded-xl text-xs font-medium transition-all duration-100 flex items-center justify-center',
                    isSel    ? 'bg-brand text-white font-bold shadow-sm'       :
                    isAvail  ? 'text-text hover:bg-surface-3 font-semibold'    :
                               'text-text-ghost cursor-not-allowed',
                    isToday && !isSel && 'ring-2 ring-inset ring-brand/20'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-1">
        {[['bg-brand','Selecionado'], ['bg-ok-mid','Disponível'], ['bg-border','Indisponível']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5 text-xs text-text-muted">
            <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
            {l}
          </div>
        ))}
      </div>

      <Button fullWidth size="lg" disabled={!selected} onClick={onNext}>
        Próximo: Escolher Horário <ChevronRight size={17} />
      </Button>
      <Button fullWidth variant="ghost" onClick={onBack}>Voltar</Button>
    </div>
  );
}

/* ─── Time Slots ────────────────────────────────────────── */
const ALL_TIMES = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'];

function Step3({ date, selected, onSelect, onNext, onBack }: {
  date: string; selected: string; onSelect: (t: string) => void; onNext: () => void; onBack: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['availability-times', date],
    queryFn: () => availabilityApi.getTimes(date).then(r => r.data),
    enabled: !!date,
  });

  const avail = new Set(data?.times || []);
  const dateLabel = date
    ? format(new Date(date + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })
    : '';

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* Date display */}
      <div className="bg-white border border-border rounded-xl px-4 py-3 shadow-xs">
        <p className="text-2xs font-bold text-text-subtle uppercase tracking-widest mb-0.5">Data</p>
        <p className="font-bold text-sm text-text capitalize">{dateLabel}</p>
      </div>

      <div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 px-0.5">
          Horários disponíveis
        </p>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="text-brand" /></div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {ALL_TIMES.map(slot => {
              const isAvail = avail.has(slot);
              const isSel   = selected === slot;
              return (
                <button
                  key={slot}
                  disabled={!isAvail}
                  onClick={() => onSelect(slot)}
                  className={clsx(
                    'py-3.5 rounded-xl text-sm font-semibold border-[1.5px] transition-all duration-100 tabular',
                    isSel   ? 'bg-crit-bg border-brand text-brand shadow-sm' :
                    isAvail ? 'bg-white border-border hover:border-border-md text-text' :
                              'bg-surface-3 border-border text-text-ghost cursor-not-allowed line-through'
                  )}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Button fullWidth size="lg" disabled={!selected} onClick={onNext}>
        Próximo: Confirmar <ChevronRight size={17} />
      </Button>
      <Button fullWidth variant="ghost" onClick={onBack}>Voltar</Button>
    </div>
  );
}

/* ─── Confirm ───────────────────────────────────────────── */
function Step4({ vehicleId, serviceType, date, timeSlot, onBack, onConfirm, loading }: {
  vehicleId: string; serviceType: string; date: string; timeSlot: string;
  onBack: () => void; onConfirm: () => void; loading: boolean;
}) {
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.list().then(r => r.data),
  });
  const vehicle = vehicles.find(v => v.id === vehicleId) ?? vehicles[0];
  const serviceName = SERVICES.find(s => s.id === serviceType)?.name ?? serviceType;
  const dateLabel = date
    ? format(new Date(date + 'T00:00:00'), "EEE, d 'de' MMM 'de' yyyy", { locale: ptBR })
    : '';

  const rows = [
    { l: 'Veículo',  v: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : '—' },
    { l: 'Serviço',  v: serviceName },
    { l: 'Data',     v: <span className="capitalize tabular">{dateLabel}</span> },
    { l: 'Horário',  v: <span className="tabular">{timeSlot}</span> },
    { l: 'Oficina',  v: 'RevisaCar — Unidade Centro' },
  ];

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* Hero check */}
      <div className="flex flex-col items-center py-4 gap-2 text-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.05 }}
          className="w-16 h-16 bg-ok-bg rounded-2xl flex items-center justify-center"
        >
          <Check size={30} className="text-ok" strokeWidth={2.5} />
        </motion.div>
        <div>
          <p className="font-bold text-base text-text">Tudo pronto!</p>
          <p className="text-sm text-text-muted mt-0.5">Revise os detalhes e confirme</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
        {rows.map(({ l, v }) => (
          <div key={l} className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0">
            <span className="text-sm text-text-muted">{l}</span>
            <span className="text-sm font-bold text-text text-right max-w-[55%] leading-snug">{v}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-sm text-text-muted">Status</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold
                           bg-warn-bg text-warn border border-warn-border">
            <span className="w-1.5 h-1.5 rounded-full bg-warn-mid" />
            Aguardando aprovação
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-info-bg border border-info-border rounded-xl p-4">
        <div className="w-1.5 flex-shrink-0 mt-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-info" />
        </div>
        <p className="text-xs text-info leading-relaxed">
          O mecânico receberá sua solicitação e confirmará o agendamento em até <strong>24 horas</strong>.
          Você será notificado pelo app.
        </p>
      </div>

      <Button fullWidth size="lg" loading={loading} onClick={onConfirm} className="mt-1">
        <Check size={17} /> Confirmar agendamento
      </Button>
      <Button fullWidth variant="ghost" onClick={onBack}>Voltar e editar</Button>
    </div>
  );
}

/* ─── Schedule Screen ───────────────────────────────────── */
export function ScheduleScreen() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [step, setStep]         = useState<1|2|3|4>(1);
  const [vehicleId, setVehicleId] = useState('');
  const [service, setService]   = useState('');
  const [date, setDate]         = useState('');
  const [time, setTime]         = useState('');

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => appointmentsApi.create({
      vehicle_id: vehicleId, service_type: service,
      date, time_slot: time,
    }),
    onSuccess: () => {
      toast.success('Agendamento enviado! Aguarde a confirmação.');
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/');
    },
    onError: (err: any) => {
      // Mostrar mensagem específica do backend se disponível
      const message = err.response?.data?.detail ||
                     err.response?.data ||
                     'Erro ao agendar';
      toast.error(message);
    },
  });

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
    center: { opacity: 1, x: 0 },
    exit:  (dir: number) => ({ opacity: 0, x: dir * -24 }),
  };
  const [dir, setDir] = useState(1);

  const goTo = (s: 1|2|3|4, direction = 1) => {
    setDir(direction);
    setStep(s);
  };

  return (
    <MainLayout topbar={<Topbar title="Agendar Manutenção" showBack />}>
      <StepProgress current={step} />
      <VehiclePicker selected={vehicleId} onSelect={setVehicleId} />

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {step === 1 && <Step1 selected={service} onSelect={setService} onNext={() => goTo(2)} />}
          {step === 2 && <Step2 selected={date} onSelect={setDate} onNext={() => goTo(3)} onBack={() => goTo(1,-1)} />}
          {step === 3 && <Step3 date={date} selected={time} onSelect={setTime} onNext={() => goTo(4)} onBack={() => goTo(2,-1)} />}
          {step === 4 && (
            <Step4
              vehicleId={vehicleId} serviceType={service} date={date} timeSlot={time}
              onBack={() => goTo(3,-1)} onConfirm={() => create()} loading={isPending}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </MainLayout>
  );
}
