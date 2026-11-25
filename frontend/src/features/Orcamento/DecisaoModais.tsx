import { useState } from 'react';
import type { FormEvent } from 'react';
import { AssinaturaPad } from '../../components/AssinaturaPad';
import { Select } from '../../components/inputs/select';
import { Textarea } from '../../components/inputs/textarea';
import {
  Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalNotice, ModalSection,
} from '../../components/system';
import { Icons } from '../Dashboard/Icons';
import { CANAIS, ROTULO_CANAL, LIMITES } from '../../utils/orcamento_utils';
import type { CanalAprovacao } from '../../types/orcamento';

const OPCOES_CANAL = CANAIS.map(c => ({ value: c, label: ROTULO_CANAL[c] }));

interface AprovarProps {
  versao: number;
  total: string;
  ocupado: boolean;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: (canal: CanalAprovacao, observacao: string, assinatura: string | null) => void;
}

/** O mecânico registra a resposta que o cliente deu fora do sistema (ex.: WhatsApp). */
export function AprovarModal({ versao, total, ocupado, erro, onFechar, onConfirmar }: AprovarProps) {
  const [canal, setCanal] = useState<CanalAprovacao>('whatsapp');
  const [obs, setObs] = useState('');
  const [assinatura, setAssinatura] = useState<string | null>(null);

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ocupado) onConfirmar(canal, obs, assinatura);
  };

  return (
    <Modal size="md" onClose={onFechar} onSubmit={enviar} closeOnBackdrop={!ocupado}>
      <ModalHeader
        icon={Icons.check}
        title="Registrar aprovação do cliente"
        description={`Orçamento v${versao} · ${total}`}
      />

      <ModalBody>
        <ModalNotice tone="info">
          O cliente aprovou o orçamento v{versao} ({total}). Depois disso a OS fica pronta para execução.
        </ModalNotice>

        <ModalSection title="Aprovação">
          <Select
            name="aprov-canal"
            label="Como o cliente aprovou"
            value={canal}
            options={OPCOES_CANAL}
            onChangeValue={v => setCanal(v as CanalAprovacao)}
          />
          <Textarea
            name="aprov-obs"
            label="Observação (opcional)"
            value={obs}
            maxLength={500}
            rows={3}
            onChangeValue={setObs}
            placeholder="Ex.: respondeu 'pode fazer' às 14h12"
          />
        </ModalSection>

        <ModalSection title="Assinatura do cliente (opcional)">
          <AssinaturaPad onChange={setAssinatura} disabled={ocupado} />
        </ModalSection>
      </ModalBody>

      <ModalFooter notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}>
        <Button variant="ghost" onClick={onFechar} disabled={ocupado}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={ocupado}>
          {ocupado ? 'Registrando…' : 'Registrar aprovação'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface RecusarProps {
  versao: number;
  aprovado: boolean;
  ocupado: boolean;
  erro: string | null;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void;
}

export function RecusarModal({ versao, aprovado, ocupado, erro, onFechar, onConfirmar }: RecusarProps) {
  const [motivo, setMotivo] = useState('');

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ocupado) onConfirmar(motivo);
  };

  return (
    <Modal size="md" onClose={onFechar} onSubmit={enviar} closeOnBackdrop={!ocupado}>
      <ModalHeader
        icon={Icons.alert}
        iconTone="error"
        title={aprovado ? 'Cancelar orçamento aprovado' : 'Registrar recusa do cliente'}
        description={`Orçamento v${versao}`}
      />

      <ModalBody>
        <ModalNotice tone="attention">
          O orçamento v{versao} será encerrado e a OS ficará como recusada. Se o cliente quiser refazer,
          é só criar uma nova versão.
        </ModalNotice>

        <ModalSection title="Motivo">
          <Textarea
            name="rec-motivo"
            label="Motivo (opcional)"
            value={motivo}
            maxLength={LIMITES.motivo}
            rows={3}
            onChangeValue={setMotivo}
            placeholder="Ex.: achou o valor alto / vai resolver por conta própria"
          />
        </ModalSection>
      </ModalBody>

      <ModalFooter notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}>
        <Button variant="ghost" onClick={onFechar} disabled={ocupado}>Voltar</Button>
        <Button type="submit" variant="danger" className="sys-btn--solid" loading={ocupado}>
          {ocupado ? 'Registrando…' : 'Registrar recusa'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
