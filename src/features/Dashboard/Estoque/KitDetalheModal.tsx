import {
  Button, Modal, ModalHeader, ModalBody, ModalColumns, ModalSection, ModalRows, ModalRow,
  ModalBadge, ModalNotice, ModalFooter,
} from '../../../components/system';
import type { EstoqueItem, EstoqueKit } from '../../../types/estoque';
import { Icons } from '../Icons';
import { EstoqueFoto } from './EstoqueFoto';
import { formatarQuantidade } from './estoqueFormat';
import { IcEditar, IcImagem } from './icones';
import { ProdutoFotoPreview } from './ProdutoFotoPreview';

interface KitDetalheModalProps {
  kit: EstoqueKit;
  itensPorId: Map<string, EstoqueItem>;
  /** Quantos kits dá pra montar com o saldo atual. */
  disponibilidade: number;
  aplicando: boolean;
  /** Erro do último "Aplicar kit" (ex.: peça sem saldo) — nunca aplica parcial. */
  erro: string | null;
  onClose: () => void;
  onAplicar: (kit: EstoqueKit) => void;
  onEditar: (kit: EstoqueKit) => void;
  onExcluir: (kit: EstoqueKit) => void;
}

/** Detalhes do kit em modo leitura (celular): componentes com saldo, disponibilidade e as ações do kit. */
export function KitDetalheModal({ kit, itensPorId, disponibilidade, aplicando, erro, onClose, onAplicar, onEditar, onExcluir }: KitDetalheModalProps) {
  const indisponivel = disponibilidade <= 0;

  return (
    <Modal size="lg" onClose={onClose}>
      <ModalHeader
        icon={Icons.box}
        title={kit.nome}
        description={kit.descricao || 'Kit de itens do estoque'}
        meta={
          indisponivel
            ? <ModalBadge tone="error">Indisponível</ModalBadge>
            : <ModalBadge tone="success">Dá pra montar {disponibilidade}</ModalBadge>
        }
      />

      <ModalBody>
        <ModalColumns
          asideFirst
          aside={
            <ModalSection icon={IcImagem} title="Foto do kit">
              <ProdutoFotoPreview foto={kit.fotoDataUrl} alt="Foto do kit" />
            </ModalSection>
          }
        >
          <ModalSection
            icon={Icons.box}
            title="Componentes"
            description="Itens dados baixa ao aplicar o kit"
          >
            {kit.itens.length === 0 ? (
              <p className="kd-vazio">Este kit não tem itens.</p>
            ) : (
              <ModalRows label="Componentes do kit">
                {kit.itens.map(r => {
                  const item = itensPorId.get(r.itemId);
                  const saldo = item?.quantidade ?? 0;
                  const falta = Math.max(0, r.quantidade - saldo);
                  return (
                    <ModalRow
                      key={r.itemId}
                      leading={<EstoqueFoto src={item?.fotoDataUrl} />}
                      title={item?.nome ?? 'Item removido'}
                      subtitle={
                        falta > 0
                          ? <span className="kd-falta">Faltam {formatarQuantidade(falta)} · em estoque {formatarQuantidade(saldo)}</span>
                          : `Em estoque: ${formatarQuantidade(saldo)}`
                      }
                      aside={`${formatarQuantidade(r.quantidade)}x`}
                    />
                  );
                })}
              </ModalRows>
            )}
          </ModalSection>
        </ModalColumns>
      </ModalBody>

      <ModalFooter notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}>
        <Button variant="danger" onClick={() => onExcluir(kit)}>Excluir</Button>
        <Button variant="secondary" onClick={() => onEditar(kit)}>{IcEditar} Editar</Button>
        <Button variant="primary" loading={aplicando} disabled={indisponivel} onClick={() => onAplicar(kit)}>
          {aplicando ? 'Aplicando…' : 'Aplicar kit'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
