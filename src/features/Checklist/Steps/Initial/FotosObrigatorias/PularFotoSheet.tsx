import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '../../../../../components/inputs/input';
import {
  Button, Modal, ModalBody, ModalChoices, ModalFooter, ModalHeader, ModalNotice, ModalSection,
} from '../../../../../components/system';
import {
  MOTIVO_MAX, MOTIVOS_PADRAO, validarMotivo,
} from '../../../../../utils/fotos_obrigatorias';

interface PularFotoSheetProps {
  rotulo: string;
  /** Motivo já registrado (ao alterar). */
  motivoAtual?: string;
  ocupado?: boolean;
  /** Erro vindo do servidor ao confirmar. */
  erro?: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}

const OUTRO = '__outro__';

/** Folha na base da tela: motivo curto de "Não consigo tirar esta foto" (atalhos ou texto livre). */
export function PularFotoSheet({ rotulo, motivoAtual, ocupado, erro, onConfirmar, onCancelar }: PularFotoSheetProps) {
  const inicialPadrao = motivoAtual && MOTIVOS_PADRAO.includes(motivoAtual) ? motivoAtual : '';
  const [escolha, setEscolha] = useState<string>(inicialPadrao || (motivoAtual ? OUTRO : ''));
  const [texto, setTexto] = useState(inicialPadrao ? '' : motivoAtual ?? '');

  const motivoFinal = escolha === OUTRO ? texto : escolha;
  const validacao = validarMotivo(motivoFinal);
  const podeConfirmar = !!escolha && validacao.ok && !ocupado;

  const opcoes = [
    ...MOTIVOS_PADRAO.map(m => ({ value: m, label: m })),
    { value: OUTRO, label: 'Outro motivo' },
  ];

  const confirmar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (podeConfirmar && validacao.ok) onConfirmar(validacao.motivo);
  };

  return (
    <Modal size="sm" onClose={onCancelar} onSubmit={confirmar} closeOnBackdrop={!ocupado}>
      <ModalHeader title="Não consigo tirar esta foto" description={`${rotulo} — escolha o motivo.`} />

      <ModalBody>
        <ModalSection title="Motivo">
          <ModalChoices touch label="Motivo" value={escolha} options={opcoes} onChange={setEscolha} />
          {escolha === OUTRO && (
            <Input
              name="pular_foto_motivo"
              label="Escreva o motivo"
              autoFocus
              maxLength={MOTIVO_MAX}
              value={texto}
              onChangeValue={setTexto}
              placeholder="Motivo curto"
              hint={`Até ${MOTIVO_MAX} caracteres`}
            />
          )}
        </ModalSection>
      </ModalBody>

      <ModalFooter notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}>
        <Button variant="ghost" onClick={onCancelar} disabled={ocupado}>Cancelar</Button>
        <Button variant="primary" type="submit" loading={ocupado} disabled={!podeConfirmar}>
          {ocupado ? 'Registrando…' : 'Confirmar motivo'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
