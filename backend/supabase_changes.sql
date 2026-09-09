-- Supabase SQL changes for appointment scheduling improvements
-- Execute these commands in the Supabase SQL editor

-- Adicionar índice único para evitar agendamentos duplicados
-- Evita que o mesmo veículo tenha múltiplos agendamentos no mesmo horário
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_vehicle_date_time_unique
ON appointments (vehicle_id, date, time_slot)
WHERE status IN ('pendente', 'confirmado');

-- Índices para melhorar performance das consultas de disponibilidade
CREATE INDEX IF NOT EXISTS idx_availability_slots_date_time
ON availability_slots (date, time_slot);

CREATE INDEX IF NOT EXISTS idx_availability_slots_available
ON availability_slots (is_available)
WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_date_time
ON appointments (vehicle_id, date, time_slot);

-- Comentário explicativo
COMMENT ON INDEX idx_appointments_vehicle_date_time_unique IS 'Evita agendamentos duplicados para o mesmo veículo na mesma data/hora quando status é pendente ou confirmado';
COMMENT ON INDEX idx_availability_slots_date_time IS 'Melhora desempenho das consultas de disponibilidade por data e horário';
COMMENT ON INDEX idx_availability_slots_available IS 'Melhora desempenho das consultas de slots disponíveis';
COMMENT ON INDEX idx_appointments_vehicle_date_time IS 'Melhora desempenho das consultas de agendamentos por veículo, data e horário';