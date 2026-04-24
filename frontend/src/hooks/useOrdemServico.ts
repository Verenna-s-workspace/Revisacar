import { useState, useCallback, useRef, useEffect } from 'react';
import { SECTIONS } from '../constants';
import {
  nowDate, nowTime, randomOsNum,
  initChecklist,
  validateStep1, validateStep5,
  getChecklistStats, getCritItems,
} from '../utils';
import { api } from '../utils/api';
import type {
  OSHeader, Cliente, Veiculo, Tecnico, Photo,
  SaveStatus, ValidationErrors,
} from '../types';

// ── Initial state ──────────────────────────────────────────────────────────

const INITIAL_OS_HEADER = (): OSHeader => ({
  os_num:  randomOsNum(),
  os_date: nowDate(),
  os_time: nowTime(),
  os_km:   '',
});

const INITIAL_CLIENTE: Cliente  = { nome: '', doc: '', tel: '', email: '' };
const INITIAL_VEICULO: Veiculo  = {
  placa: '', modelo: '', ano: '', cor: '',
  combustivel: '', nivel_combustivel: '', chassi: '', obs_entrada: '', obs_cliente: '',
};
const INITIAL_TECNICO: Tecnico  = {
  nome: '', registro: '', data_saida: '', hora_saida: '', km_saida: '', parecer_geral: '',
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useOrdemServico() {
  const [step, setStep]               = useState(1);
  const [stepDir, setStepDir]         = useState<'forward' | 'back'>('forward');
  const [orderId, setOrderId]         = useState<string | null>(null);
  const [savedAt, setSavedAt]         = useState<string | null>(null);
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('');
  const [errors, setErrors]           = useState<ValidationErrors>({});
  const [showErrors, setShowErrors]   = useState(false);

  const [osHeader, setOsHeader] = useState<OSHeader>(INITIAL_OS_HEADER);
  const [cliente,  setCliente]  = useState<Cliente>(INITIAL_CLIENTE);
  const [veiculo,  setVeiculo]  = useState<Veiculo>(INITIAL_VEICULO);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checklist, setChecklist] = useState(initChecklist);
  const [photos, setPhotos]       = useState<Photo[]>([]);
  const [newPhotos, setNewPhotos] = useState<Photo[]>([]);
  const [lightbox, setLightbox]   = useState<string | null>(null);
  const [tecnico, setTecnico]     = useState<Tecnico>(INITIAL_TECNICO);

  // ── Itens dinâmicos (seção "adicionais") ──────────────────────────────────
  // Estado fica aqui para que checklist e stats sempre enxerguem os itens
  const [itensAdicionais, setItensAdicionais] = useState<string[]>([]);

  const addDynamicItem = useCallback((name: string) => {
    setItensAdicionais((prev) => [...prev, name]);
    // Inicializa a entry no checklist para que onSetStatus funcione imediatamente
    const key = `adicionais:${name}`;
    setChecklist((prev) => ({
      ...prev,
      [key]: prev[key] ?? { status: null, obs: '' },
    }));
  }, []);

  const removeDynamicItem = useCallback((index: number) => {
    setItensAdicionais((prev) => {
      const name    = prev[index];
      const newList = prev.filter((_, i) => i !== index);
      // Limpa a entry do checklist ao remover
      setChecklist((c) => {
        const next = { ...c };
        delete next[`adicionais:${name}`];
        return next;
      });
      return newList;
    });
  }, []);

  // Signature canvas
  const sigRef     = useRef<HTMLCanvasElement>(null);
  const sigCtxRef  = useRef<CanvasRenderingContext2D | null>(null);
  const sigDrawing = useRef(false);

  useEffect(() => {
    if (step !== 5) return;
    const canvas = sigRef.current;
    if (!canvas || (canvas as HTMLCanvasElement & { _init?: boolean })._init) return;
    (canvas as HTMLCanvasElement & { _init?: boolean })._init = true;

    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth   = 1.8;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    sigCtxRef.current = ctx;
  }, [step]);

  // ── Checklist ──────────────────────────────────────────────────────────────

  const setChecklistStatus = useCallback((key: string, val: string) => {
    setChecklist((prev) => {
      const current = prev[key] ?? { status: null, obs: '' };
      return {
        ...prev,
        [key]: {
          ...current,
          status: current.status === val ? null : val,
        },
      };
    });
  }, []);

  const setChecklistObs = useCallback((key: string, val: string) => {
    setChecklist((prev) => {
      const current = prev[key] ?? { status: null, obs: '' };
      return { ...prev, [key]: { ...current, obs: val } };
    });
  }, []);

  // ── Photos ─────────────────────────────────────────────────────────────────

  const handlePhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const photo = { src: (ev.target?.result as string), name: file.name, path: undefined };
        setPhotos((prev) => [...prev, photo]);
        setNewPhotos((prev) => [...prev, photo]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, []);

  const removePhoto = useCallback(async (index: number) => {
    const foto = photos[index];
    
    if (!foto) return;

    if (foto.path && orderId) {
      try {
        console.log('Deletando foto do banco:', foto.path);
        await api.deleteFoto(orderId, foto.path);
        console.log('Foto deletada com sucesso');
      } catch (error) {
        console.error('Erro ao deletar foto:', error);
      }
    }
    
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  }, [orderId, photos]);

  // ── Signature ──────────────────────────────────────────────────────────────

  const getSigPos = (e: React.PointerEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const clearSig = useCallback(() => {
    const canvas = sigRef.current;
    if (canvas && sigCtxRef.current) {
      sigCtxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Lê o canvas e retorna dataURL — null se estiver em branco
  const getSigImage = useCallback((): string | null => {
    const canvas = sigRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Verifica canal alpha: se todos forem 0 o canvas está vazio
    const hasContent = data.some((v, i) => i % 4 === 3 && v > 0);
    return hasContent ? canvas.toDataURL('image/png') : null;
  }, []);

  const sigHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      sigDrawing.current = true;
      const p = getSigPos(e, sigRef.current!);
      sigCtxRef.current?.beginPath();
      sigCtxRef.current?.moveTo(p.x, p.y);
      e.preventDefault();
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!sigDrawing.current || !sigCtxRef.current) return;
      const p = getSigPos(e, sigRef.current!);
      sigCtxRef.current.lineTo(p.x, p.y);
      sigCtxRef.current.stroke();
      e.preventDefault();
    },
    onPointerUp:    () => { sigDrawing.current = false; },
    onPointerLeave: () => { sigDrawing.current = false; },
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goStep = useCallback((n: number, currentStep?: number) => {
    const from = currentStep ?? step;
    setStepDir(n > from ? 'forward' : 'back');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const toggleAllSections = useCallback(() => {
    setSelected((prev) =>
      prev.size === SECTIONS.length
        ? new Set<string>()
        : new Set(SECTIONS.map((s) => s.id))
    );
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  }, []);

  // ── Persistence ────────────────────────────────────────────────────────────

  const base64ToBlob = useCallback((base64: string, mimeType: string) => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }, []);

  const buildPayload = useCallback(
    () => ({
      os_header: osHeader,
      cliente,
      veiculo,
      servicos_selecionados: Array.from(selected),
      checklist: Object.fromEntries(
        Object.entries(checklist).map(([k, v]) => [k, { status: v.status, obs: v.obs }])
      ),
      itens_adicionais: itensAdicionais,
      tecnico,
    }),
    [osHeader, cliente, veiculo, selected, checklist, itensAdicionais, tecnico]
  );

  const saveOrder = useCallback(async () => {
    setSaveStatus('saving');
    try {
      // Determine status
      const isComplete = !!(
        osHeader.os_num &&
        osHeader.os_date &&
        osHeader.os_time &&
        cliente.nome &&
        cliente.tel &&
        veiculo.placa &&
        veiculo.modelo &&
        tecnico?.nome
      );
      const status = isComplete ? 'finalizada' : 'rascunho';

      // Create/update order without photos first
      const payload = {
        ...buildPayload(),
        fotos_base64: [],
        fotos_paths: [],
        status,
      };

      let data;
      if (orderId) {
        data = await api.atualizarOrdem(orderId, payload);
      } else {
        data = await api.criarOrdem(payload);
        setOrderId(data.id);
      }

      // Upload only NEW photos
      if (newPhotos.length > 0) {
        const formData = new FormData();
        newPhotos.forEach((photo) => {
          const mimeType = photo.src.split(';')[0].split(':')[1] || 'image/jpeg';
          const blob = base64ToBlob(photo.src, mimeType);
          formData.append('files', blob, photo.name);
        });
        await api.uploadFotos(data.id, formData);
        setNewPhotos([]); // Clear new photos after upload
      }

      setSavedAt(nowTime());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err) {
      console.error('Erro ao salvar ordem:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, [buildPayload, orderId, photos, osHeader, cliente, veiculo, tecnico, base64ToBlob]);

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleNextStep1 = useCallback(() => {
    const errs = validateStep1(osHeader, cliente, veiculo);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setShowErrors(true);
      return;
    }
    setErrors({});
    setShowErrors(false);
    goStep(2, 1);
  }, [osHeader, cliente, veiculo, goStep]);

  const handleExport = useCallback(
    (onExport: () => void) => {
      const errs = validateStep5(tecnico);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        setShowErrors(true);
        return;
      }
      setErrors({});
      setShowErrors(false);
      saveOrder();
      onExport();
    },
    [tecnico, saveOrder]
  );

  const loadOrder = useCallback(async (ordem: any) => {
    // Se payload é string, parsear para objeto
    let payload = ordem.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.error('Erro ao parsear payload:', e);
        payload = ordem;
      }
    }
    
    setOrderId(ordem.id);
    setOsHeader(payload.os_header || INITIAL_OS_HEADER());
    setCliente(payload.cliente || INITIAL_CLIENTE);
    setVeiculo(payload.veiculo || INITIAL_VEICULO);
    setSelected(new Set(payload.servicos_selecionados || []));
    setChecklist(payload.checklist || initChecklist());
    setItensAdicionais(payload.itens_adicionais || []);
    setTecnico(payload.tecnico || INITIAL_TECNICO);
    setSavedAt(nowTime());
    setErrors({});
    setShowErrors(false);
    setStep(1);
    clearSig();
    
    // Carregar fotos existentes se houver paths
    if (ordem.fotos_paths && ordem.fotos_paths.length > 0) {
      console.log('Carregando fotos existentes:', ordem.fotos_paths);
      try {
        const fotosPromises = ordem.fotos_paths.map(async (path: string) => {
          try {
            console.log('Baixando foto:', path);
            const response = await api.baixarFoto(path);
            console.log('Foto baixada:', response.filename);
            const src = `data:image/jpeg;base64,${response.data}`;
            const filename = response.filename.split('/').pop() || 'foto.jpg';
            return { src, name: filename };
          } catch (error) {
            console.error(`Erro ao carregar foto ${path}:`, error);
            return null;
          }
        });
        
        const fotosCarregadas = (await Promise.all(fotosPromises)).filter(Boolean);
        console.log('Fotos carregadas no frontend:', fotosCarregadas.length);
        // Add path to each photo for deletion later
        const fotosComPath = fotosCarregadas.map((foto: any, index: number) => ({
          ...foto,
          path: ordem.fotos_paths[index]
        }));
        setPhotos(fotosComPath);
        setNewPhotos([]); // Clear new photos when loading from DB
      } catch (error) {
        console.error('Erro geral ao carregar fotos:', error);
        setPhotos([]);
        setNewPhotos([]);
      }
    } else {
      console.log('Nenhuma foto para carregar');
      setPhotos([]);
      setNewPhotos([]);
    }
  }, [clearSig]);

  const resetAll = useCallback(() => {
    if (!window.confirm('Limpar toda a OS e começar do zero?')) return;
    setOsHeader(INITIAL_OS_HEADER());
    setCliente(INITIAL_CLIENTE);
    setVeiculo(INITIAL_VEICULO);
    setSelected(new Set());
    setChecklist(initChecklist());
    setItensAdicionais([]);
    setPhotos([]);
    setNewPhotos([]);
    setTecnico(INITIAL_TECNICO);
    setOrderId(null);
    setSavedAt(null);
    setErrors({});
    setShowErrors(false);
    setStep(1);
    clearSig();
  }, [clearSig]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const stats     = getChecklistStats(selected, checklist, itensAdicionais);
  const critItems = getCritItems(selected, checklist, itensAdicionais);
  const hasErr    = (k: string) => showErrors && !!errors[k];

  return {
    step, stepDir, orderId, savedAt, saveStatus,
    errors, showErrors, hasErr,
    osHeader, setOsHeader,
    cliente, setCliente,
    veiculo, setVeiculo,
    selected,
    checklist,
    itensAdicionais,
    addDynamicItem,
    removeDynamicItem,
    photos, setPhotos,
    newPhotos, setNewPhotos,
    lightbox, setLightbox,
    tecnico, setTecnico,
    stats, critItems,
    sigRef, sigCtxRef, sigHandlers, clearSig, getSigImage,
    goStep,
    toggleSection,
    toggleAllSections,
    setChecklistStatus,
    setChecklistObs,
    handlePhotos,
    removePhoto,
    saveOrder,
    handleNextStep1,
    handleExport,
    resetAll,
    loadOrder,
    buildPayload,
  };
}