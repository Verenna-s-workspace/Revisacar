import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '../../../components/inputs/input';
import {
  Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalHighlight, ModalHighlights, ModalNotice, ModalSection, ModalValue,
} from '../../../components/system';
import { mensagemDoErro } from '../../../utils/api_erro';
import { formatBRL } from '../../../utils/dashboard';
import { Icons } from '../Icons';

interface Props {
  saldo: number;
  onFechar: () => void;
  onRetirar: (valor: number, descricao: string) => Promise<void>;
}

/** Registra uma retirada da reserva. O servidor confere o saldo de novo: dois cliques ao mesmo tempo não estouram. */
export function RetiradaReservaModal({ saldo, onFechar, onRetirar }: Props) {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const valorNum = Number(valor);
  const valorOk = valorNum > 0 && valorNum <= saldo;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (salvando) return;
    if (!(valorNum > 0)) { setErro('Informe um valor maior que zero para a retirada.'); return; }
    if (valorNum > saldo) { setErro(`O valor passa do saldo da reserva (${formatBRL(saldo)}). Informe um valor igual ou menor que o saldo.`); return; }
    setSalvando(true);
    setErro('');
    try {
      await onRetirar(valorNum, descricao.trim());
      onFechar();
    } catch (err) {
      setErro(mensagemDoErro(err, 'Não foi possível registrar a retirada. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal size="sm" onClose={onFechar} onSubmit={handleSubmit} closeOnBackdrop={!salvando}>
      <ModalHeader icon={Icons.dollar} title="Retirar da reserva" description="Registre o dinheiro que saiu da reserva." />

      <ModalBody>
        <ModalHighlights>
          <ModalHighlight label="Saldo da reserva" icon={Icons.dollar}>
            <ModalValue>{formatBRL(saldo)}</ModalValue>
          </ModalHighlight>
        </ModalHighlights>

        <ModalSection title="Retirada">
          <Input name="reserva_retirada_valor" type="currency" label="Valor" required autoFocus placeholder="R$ 0,00" value={valor} onChangeValue={setValor} />
          <Input name="reserva_retirada_motivo" label="Motivo (opcional)" placeholder="Ex: Conserto do compressor" maxLength={200} value={descricao} onChangeValue={setDescricao} />
        </ModalSection>

        <ModalNotice tone="info">
          A retirada só abate o saldo da reserva. Se o dinheiro pagou uma despesa, lance a saída em Novo Lançamento.
        </ModalNotice>
      </ModalBody>

      <ModalFooter
        hint="* Campos obrigatórios"
        notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" type="submit" loading={salvando} disabled={!valorOk}>
          {salvando ? 'Registrando…' : 'Retirar'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
