import { useState, useCallback, useRef, useEffect } from 'react';
import {
  nowDate, nowTime, randomOsNum,
  validateStep1, validateStep5,
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

const INITIAL_CLIENTE: Cliente = { nome: '', doc: '', tel: '', email: '' };
const INITIAL_VEICULO: Veiculo = {
  placa: '', modelo: '', ano: '', cor: '',
  combustivel: '', nivel_combustivel: '', chassi: '', obs_entrada: '', obs_cliente: '',
};
const INITIAL_TECNICO: Tecnico = {
  nome: '', registro: '', data_saida: '', hora_saida: '', km_saida: '', parecer_geral: '',
};

// ── Hook ────────────────────────────────────────────────────────────────────

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
  const [photos, setPhotos]     = useState<Photo[]>([]);
  const [newPhotos, setNewPhotos] = useState<Photo[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [tecnico, setTecnico]   = useState<Tecnico>(INITIAL_TECNICO);

  // Signature canvas
  const sigRef     = useRef<HTMLCanvasElement>(null);
  const sigCtxRef  = useRef<CanvasRenderingContext2D | null>(null);
  const sigDrawing = useRef(false);

  useEffect(() => {
    if (step !== 3) return;
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

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goStep = useCallback((n: number, currentStep?: number) => {
    const from = currentStep ?? step;
    setStepDir(n > from ? 'forward' : 'back');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

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
      tecnico,
    }),
    [osHeader, cliente, veiculo, tecnico]
  );

  const saveOrder = useCallback(async () => {
    setSaveStatus('saving');
    try {
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

      const payload = { ...buildPayload(), fotos_base64: [], fotos_paths: [], status };

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
          const blob = base64ToBlob(photo.src, mimeType);
          formData.append('files', blob, photo.name);
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
    setCliente(payload.cliente   || INITIAL_CLIENTE);
    setVeiculo(payload.veiculo   || INITIAL_VEICULO);
    setTecnico(payload.tecnico   || INITIAL_TECNICO);
    setSavedAt(nowTime());
    setErrors({});
    setShowErrors(false);
    setStep(1);
    clearSig();

    if (ordem.fotos_paths?.length > 0) {
      try {
        const fotosPromises = ordem.fotos_paths.map(async (path: string) => {
          try {
            const response = await api.baixarFoto(path);
            const src = `data:image/jpeg;base64,${response.data}`;
            const name = response.filename.split('/').pop() || 'foto.jpg';
            return { src, name };
          } catch (error) {
            console.error(`Erro ao carregar foto ${path}:`, error);
            return null;
          }
        });

        const fotosCarregadas = (await Promise.all(fotosPromises)).filter(Boolean);
        const fotosComPath = fotosCarregadas.map((foto: any, index: number) => ({
          ...foto,
          path: ordem.fotos_paths[index],
        }));
        setPhotos(fotosComPath);
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

  const hasErr = (k: string) => showErrors && !!errors[k];

  return {
    step, stepDir, orderId, savedAt, saveStatus,
    errors, showErrors, hasErr,
    osHeader, setOsHeader,
    cliente, setCliente,
    veiculo, setVeiculo,
    photos, setPhotos,
    newPhotos, setNewPhotos,
    lightbox, setLightbox,
    tecnico, setTecnico,
    sigRef, sigCtxRef, sigHandlers, clearSig, getSigImage,
    goStep,
    handlePhotos,
    removePhoto,
    addPhotoFromCamera,
    saveOrder,
    handleNextStep1,
    handleExport,
    resetAll,
    loadOrder,
    buildPayload,
  };
}