import { mensagemDoErro } from '../../../utils/api_erro';
import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Icons } from '../Icons';
import { OS_STATUS_TOM, rotuloStatusOS } from '../Primitives';
import { api } from '../../../utils/api';
import { parseOrdemPayload } from '../../../utils/atendimento_utils';
import { Textarea } from '../../../components/inputs/textarea';
import {
  Button, Modal, ModalBadge, ModalBody, ModalChoices, ModalDetail, ModalDetails, ModalFooter, ModalHeader,
  ModalNotice, ModalSection, ModalSwitch,
} from '../../../components/system';
import { BotaoPdfOsConcluida } from '../../Fechamento/BotaoPdfOsConcluida';
import type { OSAtendimento, OverlayOS, PrioridadeAtendimento } from '../../../types/atendimento';

// ── Ditado por voz (Web Speech API) — atalho opcional, sem tipos oficiais no lib.dom ──

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function criarReconhecimentoVoz(): SpeechRecognitionLike | null {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const instancia: SpeechRecognitionLike = new Ctor();
  instancia.lang = 'pt-BR';
  instancia.continuous = false;
  instancia.interimResults = false;
  return instancia;
}

interface OSDetalheModalProps {
  ordem: OSAtendimento;
  onClose: () => void;
  /** Navega pro checklist real (onLoadOS) — quem chama já cuida de garantirIniciado antes. */
  onContinuarChecklist: () => void;
  onAtualizarOverlay: (ordemId: string, patch: Partial<Omit<OverlayOS, 'ordemId'>>) => void;
  /** Tira a OS de 'aguardando' — ver useAtendimento.desbloquear. */
  onDesbloquear: (ordemId: string) => void;
  /** Grava "cliente avisado" no banco (vale pra equipe toda). */
  onClienteAvisado: (ordemId: string, avisado: boolean) => void;
  /** Slot da Fase 6 (Peças Necessárias + Histórico Express/retorno) — fica entre Reclamação e Observações. */
  children?: ReactNode;
}

export function OSDetalheModal({ ordem, onClose, onContinuarChecklist, onAtualizarOverlay, onDesbloquear, onClienteAvisado, children }: OSDetalheModalProps) {
  const veiculoPayload = parseOrdemPayload(ordem).veiculo ?? {};
  const finalizada = ordem.status === 'finalizada';
  const bloqueada = ordem.status === 'aguardando';

  // Estado local pros campos de texto — persiste no overlay em onBlur/close/continuar,
  // não a cada tecla (evita reescrever localStorage e recalcular o board a cada letra).
  const [reclamacao, setReclamacao] = useState(ordem.reclamacaoCliente ?? '');
  const [observacoes, setObservacoes] = useState(ordem.observacoesInternas ?? '');
  const [motivoBloqueio, setMotivoBloqueio] = useState(ordem.motivoBloqueio ?? '');
  const [gravando, setGravando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoMsg, setFotoMsg] = useState<string | null>(null);
  const [fotoErro, setFotoErro] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reconhecimentoRef = useRef<SpeechRecognitionLike | null>(null);

  const salvarCampos = () => {
    onAtualizarOverlay(ordem.id, { reclamacaoCliente: reclamacao, observacoesInternas: observacoes, motivoBloqueio });
  };

  const handleClose = () => {
    salvarCampos();
    onClose();
  };

  const handleContinuar = () => {
    salvarCampos();
    onContinuarChecklist();
  };

  const handlePrioridade = (valor: string) => {
    onAtualizarOverlay(ordem.id, { prioridade: (valor || null) as PrioridadeAtendimento | null });
  };

  const handleClienteAvisado = (avisado: boolean) => {
    onClienteAvisado(ordem.id, avisado);
  };

  const handleDesbloquear = () => {
    salvarCampos();
    setMotivoBloqueio('');
    onDesbloquear(ordem.id);
  };

  const ditadoDisponivel =
    typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const handleDitado = () => {
    if (gravando) {
      reconhecimentoRef.current?.stop();
      return;
    }
    const reconhecimento = criarReconhecimentoVoz();
    if (!reconhecimento) return; // sem suporte no navegador — o campo de texto continua sendo a via principal
    reconhecimentoRef.current = reconhecimento;
    reconhecimento.onresult = (event: any) => {
      const texto = event?.results?.[0]?.[0]?.transcript;
      if (texto) setObservacoes(prev => (prev ? `${prev} ${texto}` : texto));
    };
    reconhecimento.onend = () => setGravando(false);
    reconhecimento.onerror = () => setGravando(false);
    setGravando(true);
    reconhecimento.start();
  };

  const handleFotoSelecionada = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEnviandoFoto(true);
    setFotoMsg(null);
    setFotoErro(false);
    try {
      const formData = new FormData();
      formData.append('files', file, file.name);
      await api.uploadFotos(ordem.id, formData);
      setFotoMsg('Foto enviada.');
    } catch (e) {
      setFotoErro(true);
      setFotoMsg(mensagemDoErro(e, 'Não foi possível enviar a foto agora. Verifique a internet e tente de novo; se a foto for muito grande, tire outra em resolução menor.'));
    } finally {
      setEnviandoFoto(false);
    }
  };

  const PRIORIDADES: { value: string; label: string }[] = [
    { value: '', label: 'Nenhuma' },
    { value: 'vip', label: 'VIP' },
    { value: 'garantia', label: 'Garantia' },
  ];

  // Esc, clique fora e o X passam por aqui: o que foi digitado nunca se perde ao fechar.
  return (
    <Modal size="lg" onClose={handleClose}>
      <ModalHeader
        icon={Icons.orders}
        title={ordem.cliente}
        description={`OS #${ordem.os_num}`}
        meta={
          <>
            <ModalBadge tone={OS_STATUS_TOM[ordem.status] ?? 'info'}>{rotuloStatusOS(ordem.status)}</ModalBadge>
            {ordem.prioridade && <ModalBadge tone="attention">{ordem.prioridade === 'vip' ? 'VIP' : 'Garantia'}</ModalBadge>}
          </>
        }
      />

      <ModalBody>
        <ModalSection icon={Icons.car} title="Identificação">
          <ModalDetails>
            <ModalDetail label="Placa" mono>{ordem.placa}</ModalDetail>
            <ModalDetail label="Modelo">{ordem.modelo}</ModalDetail>
            <ModalDetail label="Ano">{veiculoPayload.ano}</ModalDetail>
            <ModalDetail label="Cor">{veiculoPayload.cor}</ModalDetail>
          </ModalDetails>
        </ModalSection>

        <ModalSection title="Prioridade" description="Salva assim que você escolhe.">
          <ModalChoices label="Prioridade da OS" value={ordem.prioridade ?? ''} options={PRIORIDADES} onChange={handlePrioridade} />
        </ModalSection>

        {bloqueada && (
          <ModalSection icon={Icons.alert} title="Bloqueado — aguardando" tone="attention">
            <Textarea
              name="motivo_bloqueio"
              label="Motivo do bloqueio"
              value={motivoBloqueio}
              onChangeValue={setMotivoBloqueio}
              onBlur={salvarCampos}
              placeholder="Ex.: aguardando pastilha de freio no fornecedor…"
              rows={2}
            />
          </ModalSection>
        )}

        {!finalizada && (
          <ModalSection icon={Icons.clipboardCheck} title="Reclamação do cliente">
            <Textarea
              name="reclamacao_cliente"
              label="O que o cliente relatou"
              value={reclamacao}
              onChangeValue={setReclamacao}
              onBlur={salvarCampos}
              placeholder="O que o cliente relatou ao trazer o veículo…"
              rows={2}
            />
          </ModalSection>
        )}

        {children}

        {finalizada ? (
          <ModalSection title="Pós-atendimento">
            <ModalSwitch
              label="Cliente avisado"
              description="Marque quando o cliente já foi avisado de que o veículo está pronto."
              checked={ordem.clienteAvisado === true}
              onChange={handleClienteAvisado}
            />
          </ModalSection>
        ) : (
          <>
            <ModalSection
              icon={Icons.edit}
              title="Observações internas"
              description="Anotações da oficina — não aparecem para o cliente."
              aside={ditadoDisponivel
                ? <Button variant={gravando ? 'primary' : 'secondary'} size="sm" onClick={handleDitado}>{gravando ? 'Gravando…' : 'Ditar'}</Button>
                : undefined}
            >
              <Textarea
                name="observacoes_internas"
                label="Observações"
                value={observacoes}
                onChangeValue={setObservacoes}
                onBlur={salvarCampos}
                placeholder="Anotações internas da oficina — não aparecem pro cliente."
                rows={3}
              />
            </ModalSection>

            <ModalSection icon={Icons.camera} title="Evidências">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFotoSelecionada} style={{ display: 'none' }} />
              <div>
                <Button variant="secondary" icon={Icons.camera} onClick={() => fileInputRef.current?.click()} loading={enviandoFoto}>
                  {enviandoFoto ? 'Enviando…' : 'Nova Evidência'}
                </Button>
              </div>
              {fotoMsg && <ModalNotice tone={fotoErro ? 'error' : 'info'} role={fotoErro ? 'alert' : undefined}>{fotoMsg}</ModalNotice>}
            </ModalSection>
          </>
        )}

        <ModalNotice tone="info" title="Nota">
          Prioridade, reclamação, observações e "cliente avisado" ficam salvos só neste navegador — ainda não
          sincronizam entre dispositivos ou pessoas.
        </ModalNotice>
      </ModalBody>

      {/* Fica sempre visível: antes de a OS ser finalizada o botão avisa o motivo em vez de sumir. */}
      <ModalFooter hint={<BotaoPdfOsConcluida ordemId={ordem.id} osNum={ordem.os_num} status={ordem.status} />}>
        <Button variant={finalizada ? 'primary' : 'ghost'} onClick={handleClose}>Fechar</Button>
        {!finalizada && bloqueada && <Button variant="secondary" onClick={handleDesbloquear}>Desbloquear</Button>}
        {!finalizada && <Button variant="primary" onClick={handleContinuar}>Continuar Checklist {Icons.arrow}</Button>}
      </ModalFooter>
    </Modal>
  );
}
