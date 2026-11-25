import { Icons } from '../Icons';
import { VeiculoIcons } from './icons';
import { CarroCategoriaSvg } from './ilustracoes';
import { VEICULO_STATUS_CONFIG, VEICULO_STATUS_TOM } from './StatusBadge';
import {
  Button, Modal, ModalBadge, ModalBody, ModalColumns, ModalDetail, ModalDetails, ModalFooter, ModalHeader,
  ModalHighlight, ModalHighlights, ModalSection, ModalValue,
} from '../../../components/system';
import { CATEGORIA_LABEL, formatKm } from '../../../utils/veiculos_utils';
import type { VeiculoCadastrado } from '../../../types/veiculo';

interface VehicleDetailsModalProps {
  veiculo: VeiculoCadastrado;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewOS?: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Todas as informações de um veículo em modo leitura — mesma estrutura do modal de detalhes do produto. */
export function VehicleDetailsModal({ veiculo: v, onClose, onEdit, onDelete, onNewOS }: VehicleDetailsModalProps) {
  const dono = v.proprietario;

  return (
    <Modal size="xl" onClose={onClose}>
      <ModalHeader
        icon={Icons.car}
        title={`${v.marca} ${v.modelo}`}
        description={`Detalhes do veículo · ${v.placa}`}
        meta={
          <>
            <ModalBadge tone={VEICULO_STATUS_TOM[v.status]}>{VEICULO_STATUS_CONFIG[v.status].label}</ModalBadge>
            <ModalBadge tone="info">{CATEGORIA_LABEL[v.categoria]}</ModalBadge>
          </>
        }
      />

      <ModalBody>
        <ModalColumns
          asideFirst
          aside={
            <>
              <ModalSection icon={Icons.camera} title="Foto do veículo">
                <div className="sys-modal__photo sys-modal__photo--tile">
                  {v.fotoPrincipal
                    ? <img className="sys-modal__photo-img" src={v.fotoPrincipal} alt={`${v.marca} ${v.modelo}`} />
                    : <CarroCategoriaSvg categoria={v.categoria} />}
                </div>
              </ModalSection>

              <ModalSection icon={Icons.user} title="Proprietário">
                {dono ? (
                  <ModalDetails columns={1}>
                    <ModalDetail label="Nome">{dono.nome}</ModalDetail>
                    <ModalDetail label="CPF/CNPJ" mono>{dono.docCpfCnpj}</ModalDetail>
                    <ModalDetail label="Telefone">{dono.telefone}</ModalDetail>
                    <ModalDetail label="E-mail">{dono.email}</ModalDetail>
                  </ModalDetails>
                ) : (
                  <p className="sys-modal__empty">Veículo sem proprietário vinculado.</p>
                )}
              </ModalSection>
            </>
          }
        >
          <ModalHighlights>
            <ModalHighlight label="Placa" icon={VeiculoIcons.idCard} hint="Identificação do veículo">
              <ModalValue><span className="sys-modal__mono">{v.placa}</span></ModalValue>
            </ModalHighlight>
            <ModalHighlight label="Ano" icon={Icons.cal} hint="Ano de fabricação">
              <ModalValue>{v.ano}</ModalValue>
            </ModalHighlight>
            <ModalHighlight label="Quilometragem" icon={VeiculoIcons.gauge} hint="Última leitura registrada">
              <ModalValue>{formatKm(v.quilometragem)}</ModalValue>
            </ModalHighlight>
          </ModalHighlights>

          <ModalSection icon={Icons.car} title="Informações gerais">
            <ModalDetails>
              <ModalDetail label="Marca">{v.marca}</ModalDetail>
              <ModalDetail label="Modelo">{v.modelo}</ModalDetail>
              <ModalDetail label="Cor">{v.cor}</ModalDetail>
              <ModalDetail label="Categoria">{CATEGORIA_LABEL[v.categoria]}</ModalDetail>
              <ModalDetail label="Combustível">{v.combustivel}</ModalDetail>
              <ModalDetail label="Câmbio">{v.cambio}</ModalDetail>
              <ModalDetail label="Portas">{`${v.portas} portas`}</ModalDetail>
            </ModalDetails>
          </ModalSection>

          <ModalSection icon={VeiculoIcons.hash} title="Documentos e cadastro">
            <ModalDetails>
              <ModalDetail label="Renavam" mono>{v.renavam}</ModalDetail>
              <ModalDetail label="Chassi" mono>{v.chassi}</ModalDetail>
              <ModalDetail label="Data de cadastro" wide>{formatDate(v.createdAt)}</ModalDetail>
            </ModalDetails>
          </ModalSection>

          {v.observacoes && (
            <ModalSection title="Observações">
              <ModalDetails columns={1}>
                <ModalDetail label="Observações gerais">{v.observacoes}</ModalDetail>
              </ModalDetails>
            </ModalSection>
          )}

          <ModalSection icon={Icons.orders} title="Histórico de Ordens de Serviço">
            <p className="sys-modal__empty">Nenhuma OS registrada para este veículo ainda.</p>
          </ModalSection>
        </ModalColumns>
      </ModalBody>

      <ModalFooter>
        <Button variant="danger" icon={Icons.trash} onClick={onDelete}>Excluir</Button>
        <Button variant="secondary" icon={Icons.edit} onClick={onEdit}>Editar</Button>
        {onNewOS && <Button variant="primary" icon={Icons.plus} onClick={onNewOS}>Nova OS</Button>}
      </ModalFooter>
    </Modal>
  );
}
