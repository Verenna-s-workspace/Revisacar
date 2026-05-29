import { useState, useCallback, useRef } from 'react';
import { SECTIONS } from '../constants';
import {
  nowDate, nowTime, randomOsNum,
  initChecklist,
  validateStep1,
  getChecklistStats, getCritItems,
} from '../utils';
import { api } from '../utils/api';
import type {
  OSHeader, Cliente, Veiculo, Tecnico, Photo,
  SaveStatus, ValidationErrors, TabelaPeca,
} from '../types';

// ── Initial state ─────────────────────────────────────────────────────────────

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const INITIAL_OS_HEADER = (): OSHeader => ({
  os_num:  randomOsNum(),
  os_date: nowDate(),
  os_time: nowTime(),
  os_km:   '',
});

const INITIAL_CLIENTE: Cliente = { nome: '', doc: '', tel: '', email: '' };
const INITIAL_VEICULO: Veiculo = {
  placa: '', modelo: '', ano: '', cor: '',
  combustivel: '', nivel_combustivel: '', chassi: '', obs_entrada: '', obs_cliente: '',
};
const INITIAL_TECNICO: Tecnico = {
  nome: '', registro: '', data_saida: '', hora_saida: '', km_saida: '', parecer_geral: '',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

// Sem parâmetros: o hook não conhece qual step tem assinatura.
// Cada step que precisar de canvas chama os.initSig() no seu próprio useEffect.
export function useOrdemServico() {
  const [step, setStep]             = useState(1);
  const [stepDir, setStepDir]       = useState<'forward' | 'back'>('forward');
  const [orderId, setOrderId]       = useState<string | null>(null);
  const [savedAt, setSavedAt]       = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('');
  const [errors, setErrors]         = useState<ValidationErrors>({});
  const [showErrors, setShowErrors] = useState(false);

  const [osHeader, setOsHeader] = useState<OSHeader>(INITIAL_OS_HEADER);
  const [cliente,  setCliente]  = useState<Cliente>(INITIAL_CLIENTE);
  const [veiculo,  setVeiculo]  = useState<Veiculo>(INITIAL_VEICULO);
  const [photos,   setPhotos]   = useState<Photo[]>([]);
  const [newPhotos, setNewPhotos] = useState<Photo[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [tecnico,  setTecnico]  = useState<Tecnico>(INITIAL_TECNICO);

  // ── Checklist state ───────────────────────────────────────────────────────
  const [selected,        setSelected]        = useState<Set<string>>(new Set());
  const [checklist,       setChecklist]       = useState(initChecklist);
  const [itensAdicionais, setItensAdicionais] = useState<string[]>([]);

  // ── Partes / Trocar state ─────────────────────────────────────────────────
  const [trocaSet,    setTrocaSet]    = useState<Set<string>>(new Set());
  const [tabelaPecas, setTabelaPecas] = useState<TabelaPeca[]>([]);

  // ── Signature canvas ──────────────────────────────────────────────────────
  const sigRef     = useRef<HTMLCanvasElement>(null);
  const sigCtxRef  = useRef<CanvasRenderingContext2D | null>(null);
  const sigDrawing = useRef(false);

  // Chamado pelo step component que contém o canvas, no seu próprio useEffect.
  // Funciona em qualquer fluxo com qualquer número de steps — o hook não precisa
  // saber em qual step a assinatura fica.
  const initSig = useCallback(() => {
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
  }, []);

  // ── Photos ────────────────────────────────────────────────────────────────

  const handlePhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const photo = { src: ev.target?.result as string, name: file.name, path: undefined };
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
        await api.deleteFoto(orderId, foto.path);
      } catch (error) {
        console.error('Erro ao deletar foto:', error);
      }
    }
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  }, [orderId, photos]);

  const addPhotoFromCamera = useCallback((photo: Photo) => {
    setPhotos((prev) => [...prev, photo]);
    setNewPhotos((prev) => [...prev, photo]);
  }, []);

  // ── Checklist actions ─────────────────────────────────────────────────────

  const toggleSection = useCallback((sectionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  }, []);

  const toggleAllSections = useCallback(() => {
    setSelected((prev) =>
      prev.size === SECTIONS.length
        ? new Set<string>()
        : new Set(SECTIONS.map((s) => s.id))
    );
  }, []);

  const setChecklistStatus = useCallback((key: string, val: string) => {
    setChecklist((prev) => {
      const current = prev[key] ?? { status: null, obs: '' };
      return {
        ...prev,
        [key]: { ...current, status: current.status === val ? null : val },
      };
    });
  }, []);

  const setChecklistObs = useCallback((key: string, val: string) => {
    setChecklist((prev) => {
      const current = prev[key] ?? { status: null, obs: '' };
      return { ...prev, [key]: { ...current, obs: val } };
    });
  }, []);

  const addChecklistItem = useCallback((name: string) => {
    setItensAdicionais((prev) => [...prev, name]);
    const key = `adicionais:${name}`;
    setChecklist((prev) => ({
      ...prev,
      [key]: prev[key] ?? { status: null, obs: '' },
    }));
  }, []);

  const removeChecklistItem = useCallback((index: number) => {
    setItensAdicionais((prev) => {
      const name    = prev[index];
      const newList = prev.filter((_, i) => i !== index);
      setChecklist((c) => {
        const next = { ...c };
        delete next[`adicionais:${name}`];
        return next;
      });
      return newList;
    });
  }, []);

  // ── Partes / Trocar actions ───────────────────────────────────────────────

  const toggleTroca = useCallback((key: string, pecaNome: string) => {
    setTrocaSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Remove from set and remove the corresponding auto row from table
        next.delete(key);
        setTabelaPecas((prevTable) =>
          prevTable.filter((row) => !(row.isAuto && row.sourceKey === key))
        );
      } else {
        // Add to set; add row only if no item with same name already exists
        next.add(key);
        setTabelaPecas((prevTable) => {
          const alreadyExists = prevTable.some(
            (row) => row.peca.toLowerCase() === pecaNome.toLowerCase()
          );
          if (alreadyExists) return prevTable;
          return [
            ...prevTable,
            { id: genId(), peca: pecaNome, modelo: '', marca: '', codigo: '', quantidade: '', isAuto: true, sourceKey: key },
          ];
        });
      }
      return next;
    });
  }, []);

  const updateTabelaPeca = useCallback((id: string, field: string, value: string) => {
    setTabelaPecas((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }, []);

  const addTabelaPecaManual = useCallback(() => {
    setTabelaPecas((prev) => [
      ...prev,
      { id: genId(), peca: '', modelo: '', marca: '', codigo: '', quantidade: '', isAuto: false },
    ]);
  }, []);

  const removeTabelaPeca = useCallback((id: string) => {
    setTabelaPecas((prev) => {
      const row = prev.find((r) => r.id === id);
      // If it's an auto-added row, also uncheck the Trocar toggle
      if (row?.isAuto && row.sourceKey) {
        setTrocaSet((prevSet) => {
          const newSet = new Set(prevSet);
          newSet.delete(row.sourceKey!);
          return newSet;
        });
      }
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  // ── Signature ─────────────────────────────────────────────────────────────

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

  const getSigImage = useCallback((): string | null => {
    const canvas = sigRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
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

  // ── Navigation ────────────────────────────────────────────────────────────

  const goStep = useCallback((n: number, currentStep?: number) => {
    const from = currentStep ?? step;
    setStepDir(n > from ? 'forward' : 'back');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // ── Persistence ───────────────────────────────────────────────────────────

  const base64ToBlob = useCallback((base64: string, mimeType: string) => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers    = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  }, []);

  const buildPayload = useCallback(
    () => ({
      os_header: osHeader,
      cliente,
      veiculo,
      tecnico,
      servicos_selecionados: Array.from(selected),
      checklist: Object.fromEntries(
        Object.entries(checklist).map(([k, v]) => [k, { status: v.status, obs: v.obs }])
      ),
      itens_adicionais: itensAdicionais,
      troca_set:   Array.from(trocaSet),
      tabela_pecas: tabelaPecas,
    }),
    [osHeader, cliente, veiculo, tecnico, selected, checklist, itensAdicionais, trocaSet, tabelaPecas]
  );

  const saveOrder = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const isComplete = !!(
        osHeader.os_num  && osHeader.os_date && osHeader.os_time &&
        cliente.nome     && cliente.tel      &&
        veiculo.placa    && veiculo.modelo   &&
        tecnico?.nome
      );

      const payload = {
        ...buildPayload(),
        fotos_base64: [],
        fotos_paths:  [],
        status: isComplete ? 'finalizada' : 'rascunho',
      };

      let data;
      if (orderId) {
        data = await api.atualizarOrdem(orderId, payload);
      } else {
        data = await api.criarOrdem(payload);
        setOrderId(data.id);
      }

      if (newPhotos.length > 0) {
        const formData = new FormData();
        newPhotos.forEach((photo) => {
          const mimeType = photo.src.split(';')[0].split(':')[1] || 'image/jpeg';
          formData.append('files', base64ToBlob(photo.src, mimeType), photo.name);
        });
        await api.uploadFotos(data.id, formData);
        setNewPhotos([]);
      }

      setSavedAt(nowTime());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err) {
      console.error('Erro ao salvar ordem:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, [buildPayload, orderId, newPhotos, osHeader, cliente, veiculo, tecnico, base64ToBlob]);

  // ── Step handlers ─────────────────────────────────────────────────────────

  // Validação do step 1 (identificação) — comum a todos os fluxos.
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

  // Validação do step de encerramento — genérica, só exige nome do técnico.
  // Cada fluxo pode ter esse step em posições diferentes (3, 4, 5...).
  const handleExport = useCallback((onExport: () => void) => {
    const errs: ValidationErrors = {};
    if (!tecnico.nome?.trim()) errs.tec_nome = 'Campo obrigatório';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setShowErrors(true);
      return;
    }
    setErrors({});
    setShowErrors(false);
    saveOrder();
    onExport();
  }, [tecnico, saveOrder]);

  // ── Load / Reset ──────────────────────────────────────────────────────────

  const loadOrder = useCallback(async (ordem: any) => {
    let payload = ordem.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); }
      catch (e) { console.error('Erro ao parsear payload:', e); payload = ordem; }
    }

    setOrderId(ordem.id);
    setOsHeader(payload.os_header || INITIAL_OS_HEADER());
    setCliente(payload.cliente    || INITIAL_CLIENTE);
    setVeiculo(payload.veiculo    || INITIAL_VEICULO);
    setTecnico(payload.tecnico    || INITIAL_TECNICO);

    setSelected(new Set(payload.servicos_selecionados || []));
    setChecklist(payload.checklist || initChecklist());
    setItensAdicionais(payload.itens_adicionais || []);
    setTrocaSet(new Set(payload.troca_set || []));
    setTabelaPecas(payload.tabela_pecas || []);

    setSavedAt(nowTime());
    setErrors({});
    setShowErrors(false);

    // Limpa a flag _init do canvas para que initSig() possa re-inicializar
    // corretamente quando o step com assinatura for montado novamente.
    const canvas = sigRef.current;
    if (canvas) {
      (canvas as HTMLCanvasElement & { _init?: boolean })._init = false;
      sigCtxRef.current = null;
    }

    setStep(1);
    clearSig();

    if (ordem.fotos_paths?.length > 0) {
      try {
        const promises = ordem.fotos_paths.map(async (path: string) => {
          try {
            const response = await api.baixarFoto(path);
            return {
              src:  `data:image/jpeg;base64,${response.data}`,
              name: response.filename.split('/').pop() || 'foto.jpg',
              path,
            };
          } catch (error) {
            console.error(`Erro ao carregar foto ${path}:`, error);
            return null;
          }
        });
        setPhotos((await Promise.all(promises)).filter(Boolean) as Photo[]);
        setNewPhotos([]);
      } catch (error) {
        console.error('Erro geral ao carregar fotos:', error);
        setPhotos([]);
        setNewPhotos([]);
      }
    } else {
      setPhotos([]);
      setNewPhotos([]);
    }
  }, [clearSig]);

  const resetAll = useCallback(() => {
    if (!window.confirm('Limpar toda a OS e começar do zero?')) return;
    setOsHeader(INITIAL_OS_HEADER());
    setCliente(INITIAL_CLIENTE);
    setVeiculo(INITIAL_VEICULO);
    setTecnico(INITIAL_TECNICO);
    setSelected(new Set());
    setChecklist(initChecklist());
    setItensAdicionais([]);
    setTrocaSet(new Set());
    setTabelaPecas([]);
    setPhotos([]);
    setNewPhotos([]);
    setOrderId(null);
    setSavedAt(null);
    setErrors({});
    setShowErrors(false);

    // Reseta canvas da mesma forma que loadOrder
    const canvas = sigRef.current;
    if (canvas) {
      (canvas as HTMLCanvasElement & { _init?: boolean })._init = false;
      sigCtxRef.current = null;
    }

    setStep(1);
    clearSig();
  }, [clearSig]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const stats     = getChecklistStats(selected, checklist, itensAdicionais);
  const critItems = getCritItems(selected, checklist, itensAdicionais);
  const hasErr    = (k: string) => showErrors && !!errors[k];

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // Core OS
    step, stepDir, orderId, savedAt, saveStatus,
    errors, showErrors, hasErr,
    osHeader, setOsHeader,
    cliente,  setCliente,
    veiculo,  setVeiculo,
    tecnico,  setTecnico,
    photos,   setPhotos,
    newPhotos, setNewPhotos,
    lightbox, setLightbox,

    // Photos
    handlePhotos,
    removePhoto,
    addPhotoFromCamera,

    // Signature — initSig é chamado pelo step component que tem o canvas
    sigRef, sigCtxRef, sigHandlers,
    initSig, clearSig, getSigImage,

    // Navigation
    goStep,

    // Checklist
    selected,
    checklist,
    itensAdicionais,
    stats,
    critItems,
    toggleSection,
    toggleAllSections,
    setChecklistStatus,
    setChecklistObs,
    addChecklistItem,
    removeChecklistItem,

    // Partes / Trocar
    trocaSet,
    tabelaPecas,
    toggleTroca,
    updateTabelaPeca,
    addTabelaPecaManual,
    removeTabelaPeca,

    // Actions
    saveOrder,
    handleNextStep1,
    handleExport,
    loadOrder,
    resetAll,
    buildPayload,
  };
}