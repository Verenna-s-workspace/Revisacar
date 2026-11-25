import { useState } from 'react';
import type { FormEvent } from 'react';
import { labelCategoria, LABEL_FORMA_PAGAMENTO } from './categoriaLabels';
import type { Categorias, Transacao } from './types';
import { mensagemDoErro } from '../../../utils/api_erro';
import { hojeLocal } from '../../../utils/financeiro_utils';
import { formatBRL } from '../../../utils/dashboard';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import {
  Button, Modal, ModalBody, ModalChoices, ModalFields, ModalFooter, ModalHeader, ModalHighlight, ModalHighlights,
  ModalNotice, ModalSection,
} from '../../../components/system';
import { Icons } from '../Icons';

/** Meios em que a maquininha (ou o app de pagamento) costuma descontar taxa. */
const MEIOS_COM_TAXA = new Set(['debito', 'credito', 'pix']);

interface Props {
  categorias: Categorias;
  /** Quando vem, o modal edita este lançamento (o tipo não muda). */
  transacao?: Transacao;
  onFechar: () => void;
  onSalvar: (payload: Record<string, unknown>) => Promise<void>;
}

export function TransacaoModal({ categorias, transacao, onFechar, onSalvar }: Props) {
  const editando = !!transacao;
  const [tipo, setTipo] = useState<'entrada' | 'saida'>(transacao?.tipo ?? 'entrada');
  const [categoria, setCategoria] = useState(transacao?.categoria ?? categorias.entrada[0] ?? '');
  const [descricao, setDescricao] = useState(transacao?.descricao ?? '');
  const [valor, setValor] = useState(transacao ? String(transacao.valor) : '');
  // Taxa que a maquininha descontou (R$). Vazio = sem taxa.
  const [taxa, setTaxa] = useState(transacao && transacao.taxa > 0 ? transacao.taxa.toFixed(2) : '');
  const [formaPagamento, setFormaPagamento] = useState(transacao?.forma_pagamento ?? 'pix');
  const [statusPago, setStatusPago] = useState(transacao ? transacao.status === 'pago' : true);
  const [dataCompetencia, setDataCompetencia] = useState(transacao?.data_competencia ?? hojeLocal());
  const [dataVencimento, setDataVencimento] = useState(transacao?.data_vencimento ?? '');
  const [clienteNome, setClienteNome] = useState(transacao?.cliente_nome ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const listaCategorias = tipo === 'entrada' ? categorias.entrada : categorias.saida;

  const trocarTipo = (novo: 'entrada' | 'saida') => {
    if (editando) return;
    setTipo(novo);
    const lista = novo === 'entrada' ? categorias.entrada : categorias.saida;
    setCategoria(lista[0] ?? '');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const valorNum = Number(valor);
    if (!valorNum || valorNum <= 0) {
      setErro('Informe um valor maior que zero (ex.: 150,00).');
      return;
    }
    const taxaNum = tipo === 'entrada' && MEIOS_COM_TAXA.has(formaPagamento) ? Number(taxa) || 0 : 0;
    if (taxaNum >= valorNum) {
      setErro('A taxa não pode ser igual ou maior que o valor do lançamento. Reduza a taxa ou corrija o valor.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        // Na edição o tipo não vai: o backend não deixa mudar.
        ...(editando ? {} : { tipo }),
        categoria,
        descricao,
        valor: valorNum,
        // Só manda a taxa quando ela existe (ou existia e agora foi zerada): quem não usa nem a envia.
        ...(taxaNum > 0 || (editando && (transacao?.taxa ?? 0) > 0) ? { taxa: taxaNum } : {}),
        forma_pagamento: formaPagamento,
        status: statusPago ? 'pago' : 'pendente',
        data_competencia: dataCompetencia,
        data_vencimento: !statusPago && dataVencimento ? dataVencimento : null,
        cliente_nome: tipo === 'entrada' ? clienteNome : '',
      });
    } catch (err) {
      setErro(mensagemDoErro(err, 'Não foi possível salvar o lançamento. Confira valor, data e categoria e tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  const aReceber = Number(taxa) > 0 && Number(valor) > Number(taxa);

  return (
    <Modal size="md" onClose={onFechar} onSubmit={handleSubmit} closeOnBackdrop={!salvando}>
      <ModalHeader
        icon={Icons.dollar}
        title={editando ? 'Editar Lançamento' : 'Novo Lançamento'}
        description={editando ? 'Atualize os dados deste lançamento.' : 'Registre uma entrada ou uma saída do caixa.'}
      />

      <ModalBody>
        <ModalHighlights>
          <ModalHighlight label="Valor" htmlFor="transacao_valor" icon={Icons.dollar} required>
            <Input name="transacao_valor" type="currency" required placeholder="R$ 0,00" value={valor} onChangeValue={setValor} />
          </ModalHighlight>
        </ModalHighlights>

        <ModalSection title="Lançamento">
          <ModalChoices
            label={editando ? 'Tipo (não muda depois de criado)' : 'Tipo'}
            value={tipo}
            disabled={editando}
            onChange={trocarTipo}
            options={[{ value: 'entrada', label: 'Entrada (+)' }, { value: 'saida', label: 'Saída (-)' }]}
          />
          <Input name="transacao_descricao" label="Descrição" placeholder="Ex: Troca de óleo ou Aluguel" value={descricao} onChangeValue={setDescricao} />
          <ModalFields>
            <Select
              name="transacao_categoria"
              label="Categoria"
              value={categoria}
              onChangeValue={setCategoria}
              options={listaCategorias.map(c => ({ value: c, label: labelCategoria(tipo, c) }))}
            />
            {tipo === 'entrada' && (
              <Input name="transacao_cliente" label="Cliente (opcional)" placeholder="Nome do cliente" value={clienteNome} onChangeValue={setClienteNome} />
            )}
          </ModalFields>
        </ModalSection>

        <ModalSection title="Pagamento">
          <ModalFields>
            <Input name="transacao_data" type="date" label="Data" value={dataCompetencia} onChangeValue={setDataCompetencia} />
            <Select
              name="transacao_forma_pagamento"
              label="Forma de Pagamento"
              value={formaPagamento}
              onChangeValue={setFormaPagamento}
              options={categorias.formas_pagamento.map(f => ({ value: f, label: LABEL_FORMA_PAGAMENTO[f] ?? f }))}
            />
          </ModalFields>

          {tipo === 'entrada' && MEIOS_COM_TAXA.has(formaPagamento) && (
            <>
              <Input
                name="transacao_taxa"
                type="currency"
                label="Taxa da maquininha (opcional)"
                placeholder="R$ 0,00"
                hint="Quanto a maquininha descontou. Está no extrato dela; dá para preencher depois, editando o lançamento."
                value={taxa}
                onChangeValue={setTaxa}
              />
              {aReceber && <ModalNotice tone="info">Cai na conta: <strong>{formatBRL(Number(valor) - Number(taxa))}</strong></ModalNotice>}
            </>
          )}

          <ModalChoices
            label="Situação"
            value={statusPago ? 'pago' : 'pendente'}
            onChange={v => setStatusPago(v === 'pago')}
            options={[{ value: 'pago', label: `Já ${tipo === 'entrada' ? 'recebido' : 'pago'}` }, { value: 'pendente', label: 'Pendente' }]}
          />
          {!statusPago && (
            <Input name="transacao_vencimento" type="date" label="Vence em (opcional)" value={dataVencimento} onChangeValue={setDataVencimento} />
          )}
        </ModalSection>
      </ModalBody>

      <ModalFooter
        hint="* Campos obrigatórios"
        notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={salvando}>
          {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Registrar Lançamento'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
