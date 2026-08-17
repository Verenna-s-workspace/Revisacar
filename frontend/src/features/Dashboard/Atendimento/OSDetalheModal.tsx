import { useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { StatusBadge } from '../Primitives';
import { api } from '../../../utils/api';
import { parseOrdemPayload } from '../../../utils/atendimento_utils';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import type { OSAtendimento, OverlayOS, PrioridadeAtendimento } from '../../../types/atendimento';

const FIELD_LABEL: CSSProperties = {
  display: 'block',
  fontSize: '0.68rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: tokens.color.muted,
  marginBottom: 6,
};

const FIELD_INPUT: CSSProperties = {
  width: '100%',
  padding: 10,
  background: tokens.color.bg,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 8,
  color: tokens.color.text,
  fontSize: '0.86rem',
  fontFamily: tokens.fontSans,
};

const SECTION_LABEL: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: tokens.color.muted,
  marginBottom: 10,
};

function Field({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div style={{ padding: '11px 13px', borderRadius: 12, background: tokens.color.surfaceHigh, border: `1px solid ${tokens.color.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: tokens.color.muted }}>
        <span style={{ display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: tokens.color.text, wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

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
  /** Slot da Fase 6 (Peças Necessárias + Histórico Express/retorno) — fica entre Reclamação e Observações. */
  children?: ReactNode;
}

export function OSDetalheModal({ ordem, onClose, onContinuarChecklist, onAtualizarOverlay, onDesbloquear, children }: OSDetalheModalProps) {
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
    onAtualizarOverlay(ordem.id, { clienteAvisado: avisado });
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
    try {
      const formData = new FormData();
      formData.append('files', file, file.name);
      await api.uploadFotos(ordem.id, formData);
      setFotoMsg('Foto enviada.');
    } catch {
      setFotoMsg('Não foi possível enviar a foto agora.');
    } finally {
      setEnviandoFoto(false);
    }
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={handleClose}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{ordem.cliente}</div>
            <div className="dashboard-modal__subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              OS #{ordem.os_num}
              <StatusBadge status={ordem.status} />
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>
            ×
          </button>
        </div>

        <div className="dashboard-modal__body">
          <div>
            <label style={FIELD_LABEL}>Prioridade</label>
            <div style={{ maxWidth: 220 }}>
              <Select
                name="os_prioridade"
                value={ordem.prioridade ?? ''}
                onChangeValue={handlePrioridade}
                options={[
                  { value: '', label: 'Nenhuma' },
                  { value: 'vip', label: 'VIP' },
                  { value: 'garantia', label: 'Garantia' },
                ]}
              />
            </div>
          </div>

          <div>
            <div style={SECTION_LABEL}>Identificação</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <Field icon={Icons.car} label="Placa" value={ordem.placa} />
              <Field icon={Icons.car} label="Modelo" value={ordem.modelo} />
              <Field icon={Icons.cal} label="Ano" value={veiculoPayload.ano} />
              <Field icon={Icons.box} label="Cor" value={veiculoPayload.cor} />
            </div>
          </div>

          {bloqueada && (
            <div>
              <div style={{ ...SECTION_LABEL, color: tokens.color.crit }}>Bloqueado — Aguardando</div>
              <Textarea
                name="motivo_bloqueio"
                value={motivoBloqueio}
                onChangeValue={setMotivoBloqueio}
                onBlur={salvarCampos}
                placeholder="Ex.: aguardando pastilha de freio no fornecedor…"
                rows={2}
                style={{ background: tokens.color.critBg, borderColor: tokens.color.critBorder }}
              />
            </div>
          )}

          {!finalizada && (
            <div>
              <Textarea
                name="reclamacao_cliente"
                label="Reclamação do Cliente"
                value={reclamacao}
                onChangeValue={setReclamacao}
                onBlur={salvarCampos}
                placeholder="O que o cliente relatou ao trazer o veículo…"
                rows={2}
              />
            </div>
          )}

          {children}

          {finalizada ? (
            <div>
              <div style={SECTION_LABEL}>Pós-atendimento</div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 14px',
                  borderRadius: 12,
                  background: tokens.color.surfaceHigh,
                  border: `1px solid ${tokens.color.border}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={ordem.clienteAvisado === true}
                  onChange={e => handleClienteAvisado(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: tokens.color.text }}>Cliente avisado</span>
              </label>
            </div>
          ) : (
            <>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ ...FIELD_LABEL, marginBottom: 0 }}>Observações Internas</label>
                  {ditadoDisponivel && (
                    <button
                      type="button"
                      onClick={handleDitado}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 9px',
                        borderRadius: 7,
                        border: `1px solid ${gravando ? tokens.color.ferrari : tokens.color.border}`,
                        background: gravando ? tokens.color.ferrariMid : 'transparent',
                        color: gravando ? tokens.color.ferrari : tokens.color.muted,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🎙️ {gravando ? 'Gravando…' : 'Ditar'}
                    </button>
                  )}
                </div>
                <Textarea
                  name="observacoes_internas"
                  value={observacoes}
                  onChangeValue={setObservacoes}
                  onBlur={salvarCampos}
                  placeholder="Anotações internas da oficina — não aparecem pro cliente."
                  rows={3}
                />
              </div>

              <div>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFotoSelecionada} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviandoFoto}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 14px',
                    borderRadius: 9,
                    border: `1px solid ${tokens.color.border}`,
                    background: 'transparent',
                    color: tokens.color.text,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: enviandoFoto ? 'default' : 'pointer',
                    opacity: enviandoFoto ? 0.6 : 1,
                  }}
                >
                  <span style={{ display: 'flex' }}>{Icons.camera}</span>
                  {enviandoFoto ? 'Enviando…' : 'Nova Evidência'}
                </button>
                {fotoMsg && <div style={{ fontSize: '0.74rem', color: tokens.color.muted, marginTop: 6 }}>{fotoMsg}</div>}
              </div>
            </>
          )}

          <div style={{ padding: '10px 14px', background: tokens.color.surface, borderRadius: 8, border: `1px solid ${tokens.color.border}` }}>
            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.muted, marginBottom: 4 }}>
              Nota
            </div>
            <div style={{ fontSize: '0.78rem', color: tokens.color.textSecond, lineHeight: 1.5 }}>
              Prioridade, reclamação, observações e "cliente avisado" ficam salvos só neste navegador — ainda não
              sincronizam entre dispositivos ou pessoas.
            </div>
          </div>
        </div>

        {!finalizada && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {bloqueada && (
              <button
                onClick={handleDesbloquear}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: `1px solid ${tokens.color.border}`,
                  background: 'transparent',
                  color: tokens.color.text,
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                }}
              >
                Desbloquear
              </button>
            )}
            <button
              onClick={handleContinuar}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: tokens.color.ferrari,
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 700,
                boxShadow: tokens.shadow.ferrari,
              }}
            >
              Continuar Checklist
              <span style={{ display: 'flex' }}>{Icons.arrow}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
