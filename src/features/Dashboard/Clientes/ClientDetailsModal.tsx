import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icons } from '../Icons';
import { ClienteIcons } from './icons';
import { CLIENTE_STATUS_CONFIG, CLIENTE_STATUS_TOM } from './StatusBadge';
import { VEICULO_STATUS_CONFIG, VEICULO_STATUS_TOM } from '../Veiculos/StatusBadge';
import { AppointmentCard } from '../Agendamentos/AppointmentCard';
import { OSRow } from '../OrdensPage';
import {
  Button, Modal, ModalBadge, ModalBody, ModalColumns, ModalDetail, ModalDetails, ModalFooter, ModalHeader,
  ModalHighlight, ModalHighlights, ModalRow, ModalRows, ModalSection, ModalTabs, ModalValue,
} from '../../../components/system';
import { ownerInitial, formatKm } from '../../../utils/veiculos_utils';
import { formatAgendadoBadge, formatDataCurta } from '../../../utils/clientes_utils';
import { formatBRL } from '../../../utils/dashboard';
import { TICKET } from '../../../utils/relatorios';
import type { ClienteComDados } from '../../../types/cliente';
import type { VeiculoCadastrado } from '../../../types/veiculo';
import type { Agendamento } from '../../../types/agendamento';
import type { OrdemRow } from '../../../types/dashboard';

interface ClientDetailsModalProps {
  cliente: ClienteComDados;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewVeiculo: (veiculo: VeiculoCadastrado) => void;
  onViewOrdem: (ordem: OrdemRow) => void;
  onNovoAgendamento: (cliente: ClienteComDados) => void;
  onGoToAgendamento: (agendamento: Agendamento) => void;
}

type TabId = 'dados' | 'veiculos' | 'historico' | 'agendamentos';

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Agendamentos de um dia: rótulo da data + cartão clicável. */
function GrupoAgendamento({ ag, onGo }: { ag: Agendamento; onGo: (a: Agendamento) => void }): ReactNode {
  return (
    <div className="sys-modal__group">
      <span className="sys-modal__group-label">{formatDataCurta(ag.data)}</span>
      <AppointmentCard agendamento={ag} onClick={() => onGo(ag)} />
    </div>
  );
}

export function ClientDetailsModal({ cliente: c, onClose, onEdit, onDelete, onViewVeiculo, onViewOrdem, onNovoAgendamento, onGoToAgendamento }: ClientDetailsModalProps) {
  const [tab, setTab] = useState<TabId>('dados');

  const tabs: { value: TabId; label: string }[] = [
    { value: 'dados', label: 'Dados Pessoais' },
    { value: 'veiculos', label: `Veículos${c.veiculos.length ? ` (${c.veiculos.length})` : ''}` },
    { value: 'historico', label: 'Histórico' },
    { value: 'agendamentos', label: `Agendamentos${c.agendamentosFuturos.length ? ` (${c.agendamentosFuturos.length})` : ''}` },
  ];

  const concluidas = c.ordens.filter(o => o.status === 'finalizada');
  const gastosEstimados = concluidas.length * TICKET;
  const rotuloStatus = c.status === 'agendado' && c.proximoAgendamento
    ? `Agendado • ${formatAgendadoBadge(c.proximoAgendamento)}`
    : CLIENTE_STATUS_CONFIG[c.status].label;

  return (
    <Modal size="xl" onClose={onClose}>
      <ModalHeader
        icon={Icons.user}
        title={c.nome}
        description="Detalhes do cliente"
        meta={
          <>
            <ModalBadge tone={CLIENTE_STATUS_TOM[c.status]}>{rotuloStatus}</ModalBadge>
            <ModalBadge tone="info">{c.veiculos.length} veículo{c.veiculos.length === 1 ? '' : 's'}</ModalBadge>
          </>
        }
      />

      <ModalTabs label="Seções do cliente" value={tab} tabs={tabs} onChange={setTab} />

      <ModalBody>
        {tab === 'dados' && (
          <ModalColumns
            asideFirst
            aside={
              <ModalSection icon={Icons.camera} title="Foto do cliente">
                <div className="sys-modal__photo sys-modal__photo--avatar">
                  {c.fotoPrincipal
                    ? <img className="sys-modal__photo-img" src={c.fotoPrincipal} alt={c.nome} />
                    : <span className="sys-modal__initials">{ownerInitial(c.nome)}</span>}
                </div>
              </ModalSection>
            }
          >
            <ModalSection icon={ClienteIcons.phone} title="Informações de contato">
              <ModalDetails>
                <ModalDetail label="CPF/CNPJ" mono>{c.cpfCnpj}</ModalDetail>
                <ModalDetail label="Telefone">{c.telefone}</ModalDetail>
                <ModalDetail label="E-mail">{c.email}</ModalDetail>
                <ModalDetail label="Endereço">{c.endereco}</ModalDetail>
              </ModalDetails>
            </ModalSection>

            <ModalSection icon={Icons.cal} title="Relacionamento">
              <ModalDetails>
                <ModalDetail label="Cliente desde">{formatDateLong(c.createdAt)}</ModalDetail>
                <ModalDetail label="Última visita">{c.ultimaVisita ? formatDataCurta(c.ultimaVisita) : 'Ainda sem visitas'}</ModalDetail>
              </ModalDetails>
            </ModalSection>

            {c.observacoes && (
              <ModalSection title="Observações">
                <ModalDetails columns={1}>
                  <ModalDetail label="Observações gerais">{c.observacoes}</ModalDetail>
                </ModalDetails>
              </ModalSection>
            )}
          </ModalColumns>
        )}

        {tab === 'veiculos' && (
          <ModalSection icon={Icons.car} title="Veículos vinculados">
            {c.veiculos.length === 0 ? (
              <p className="sys-modal__empty">Nenhum veículo vinculado a este cliente ainda. Cadastre um pela tela de Veículos ou editando este cliente.</p>
            ) : (
              <ModalRows label="Veículos vinculados">
                {c.veiculos.map(v => (
                  <ModalRow
                    key={v.id}
                    leading={<span className="sys-modal__row-icon">{Icons.car}</span>}
                    title={`${v.marca} ${v.modelo}`}
                    subtitle={`${v.placa} · ${v.ano} · ${formatKm(v.quilometragem)}`}
                    aside={<ModalBadge tone={VEICULO_STATUS_TOM[v.status]}>{VEICULO_STATUS_CONFIG[v.status].label}</ModalBadge>}
                    onSelect={() => onViewVeiculo(v)}
                  />
                ))}
              </ModalRows>
            )}
          </ModalSection>
        )}

        {tab === 'historico' && (
          <>
            <ModalHighlights>
              <ModalHighlight label="Ordens de serviço" icon={Icons.orders} hint="Total registrado">
                <ModalValue>{c.ordens.length}</ModalValue>
              </ModalHighlight>
              <ModalHighlight label="Concluídas" icon={ClienteIcons.checkCircle} hint="Finalizadas">
                <ModalValue>{concluidas.length}</ModalValue>
              </ModalHighlight>
              <ModalHighlight label="Gastos estimados" icon={Icons.money} hint="Por ordem concluída">
                <ModalValue>{gastosEstimados > 0 ? formatBRL(gastosEstimados) : '—'}</ModalValue>
              </ModalHighlight>
            </ModalHighlights>

            <ModalSection icon={Icons.orders} title="Ordens de serviço">
              {c.ordens.length === 0 ? (
                <p className="sys-modal__empty">Nenhuma ordem de serviço registrada para este cliente ainda.</p>
              ) : (
                <div>
                  {c.ordens.map(o => <OSRow key={o.id} ordem={o} onClick={() => onViewOrdem(o)} />)}
                </div>
              )}
            </ModalSection>
          </>
        )}

        {tab === 'agendamentos' && (
          <>
            <Button variant="primary" block icon={Icons.plus} onClick={() => onNovoAgendamento(c)}>Novo Agendamento</Button>

            {c.agendamentosFuturos.length > 0 && (
              <ModalSection icon={Icons.cal} title="Próximos agendamentos">
                {c.agendamentosFuturos.map(ag => <GrupoAgendamento key={ag.id} ag={ag} onGo={onGoToAgendamento} />)}
              </ModalSection>
            )}

            {c.agendamentosPassados.length > 0 && (
              <ModalSection icon={Icons.clock} title="Histórico de agendamentos">
                {c.agendamentosPassados.map(ag => <GrupoAgendamento key={ag.id} ag={ag} onGo={onGoToAgendamento} />)}
              </ModalSection>
            )}

            {c.agendamentosFuturos.length === 0 && c.agendamentosPassados.length === 0 && (
              <ModalSection icon={Icons.cal} title="Agendamentos">
                <p className="sys-modal__empty">Nenhum agendamento registrado para este cliente ainda.</p>
              </ModalSection>
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="danger" icon={Icons.trash} onClick={onDelete}>Excluir</Button>
        <Button variant="secondary" icon={Icons.edit} onClick={onEdit}>Editar</Button>
      </ModalFooter>
    </Modal>
  );
}
