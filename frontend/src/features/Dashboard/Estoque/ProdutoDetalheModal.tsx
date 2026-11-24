import { Valor } from '../../../components/Privacidade';
import {
  Button, Modal, ModalHeader, ModalBody, ModalColumns, ModalSection, ModalHighlights, ModalHighlight,
  ModalValue, ModalDetails, ModalDetail, ModalBadge, ModalFooter,
} from '../../../components/system';
import { formatBRL } from '../../../utils/dashboard';
import { itemEstaBaixo } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';
import { Icons } from '../Icons';
import { formatarDataBR, formatarQuantidade } from './estoqueFormat';
import { IcEditar, IcImagem, IcInfo, IcTexto } from './icones';
import { ProdutoFotoPreview } from './ProdutoFotoPreview';

interface ProdutoDetalheModalProps {
  item: EstoqueItem;
  /** Custo é dado sensível (financeiro.ver_margem): só aparece pra quem pode ver. */
  mostrarCusto: boolean;
  onClose: () => void;
  /** Inicia a edição: quem chama fecha este modal e abre o ProdutoModal. */
  onEditar: (item: EstoqueItem) => void;
  onExcluir: (item: EstoqueItem) => void;
}

/**
 * Todas as informações de um produto, em modo leitura — é o que o celular abre ao tocar numa linha
 * (a lista não comporta todos os campos). Mesma estrutura do ProdutoModal de edição, com valores em
 * vez de campos; "Editar" leva pra ele.
 */
export function ProdutoDetalheModal({ item, mostrarCusto, onClose, onEditar, onExcluir }: ProdutoDetalheModalProps) {
  const baixo = itemEstaBaixo(item);
  const emQuarentena = item.status === 'quarentena';
  const reservado = item.reservado ?? 0;
  const q = item.quarentena;

  return (
    <Modal size="xl" onClose={onClose}>
      <ModalHeader
        icon={Icons.box}
        title={item.nome}
        description="Detalhes do produto no estoque"
        meta={
          (emQuarentena || baixo) ? (
            <>
              {emQuarentena && <ModalBadge tone="attention">Quarentena</ModalBadge>}
              {baixo && <ModalBadge tone="error">Estoque baixo</ModalBadge>}
            </>
          ) : undefined
        }
      />

      <ModalBody>
        <ModalColumns
          asideFirst
          aside={
            <>
              <ModalSection icon={IcImagem} title="Foto do produto">
                <ProdutoFotoPreview foto={item.fotoDataUrl} />
              </ModalSection>

              {emQuarentena && (
                <ModalSection icon={Icons.alert} title="Quarentena" tone="attention">
                  <ModalDetails columns={1}>
                    <ModalDetail label="Motivo">{q?.motivo}</ModalDetail>
                    <ModalDetail label="Fornecedor">{q?.fornecedor}</ModalDetail>
                    <ModalDetail label="Data de entrada">{formatarDataBR(q?.dataEntrada)}</ModalDetail>
                  </ModalDetails>
                </ModalSection>
              )}
            </>
          }
        >
          <ModalHighlights>
            <ModalHighlight
              label="Quantidade"
              icon={baixo ? Icons.alert : Icons.box}
              tone={baixo ? 'error' : 'default'}
              hint={reservado > 0 ? `${formatarQuantidade(reservado)} reservado${reservado === 1 ? '' : 's'}` : 'Unidades em estoque'}
            >
              <ModalValue>{formatarQuantidade(item.quantidade)}</ModalValue>
            </ModalHighlight>
            <ModalHighlight label="Estoque Mínimo" icon={Icons.alert} hint="Abaixo ou igual a isso, vira estoque baixo">
              <ModalValue>{formatarQuantidade(item.minimo)}</ModalValue>
            </ModalHighlight>
            <ModalHighlight label="Preço" icon={Icons.dollar} hint="Valor cobrado por unidade">
              <ModalValue><Valor texto={formatBRL(item.preco)} /></ModalValue>
            </ModalHighlight>
            {mostrarCusto && item.custo !== undefined && (
              <ModalHighlight label="Custo" icon={Icons.dollar} hint="Valor pago por unidade">
                <ModalValue><Valor texto={formatBRL(item.custo)} /></ModalValue>
              </ModalHighlight>
            )}
          </ModalHighlights>

          <ModalSection icon={IcInfo} title="Informações básicas">
            <ModalDetails>
              <ModalDetail label="Nome do Produto" wide>{item.nome}</ModalDetail>
              <ModalDetail label="Categoria">{item.categoria}</ModalDetail>
              <ModalDetail label="Localização">{item.localizacao}</ModalDetail>
            </ModalDetails>
          </ModalSection>

          <ModalSection icon={IcTexto} title="Detalhes">
            <ModalDetails columns={1}>
              <ModalDetail label="Aplicação">{item.aplicacao}</ModalDetail>
              <ModalDetail label="Descrição">{item.descricao}</ModalDetail>
            </ModalDetails>
          </ModalSection>
        </ModalColumns>
      </ModalBody>

      <ModalFooter>
        <Button variant="danger" onClick={() => onExcluir(item)}>Excluir</Button>
        <Button variant="primary" onClick={() => onEditar(item)}>{IcEditar} Editar</Button>
      </ModalFooter>
    </Modal>
  );
}
