import { useEffect, useState } from 'react';
import { Button } from '../../../components/system';
import { IcInstalar } from './icones';

/** Aplicativo: estado da conexão deste dispositivo + instalação do PWA (quando o navegador oferece). */
export function AplicativoSecao() {
  const [online, setOnline] = useState(navigator.onLine);

  // PWA instalável: o evento pode ter disparado antes desta tela abrir (fica em window.deferredPrompt).
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).deferredPrompt ?? null);

  useEffect(() => {
    const aoFicarOnline = () => setOnline(true);
    const aoFicarOffline = () => setOnline(false);
    const aoOferecerInstalacao = (e: any) => setDeferredPrompt(e);

    window.addEventListener('online', aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    window.addEventListener('beforeinstallprompt', aoOferecerInstalacao);
    return () => {
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
      window.removeEventListener('beforeinstallprompt', aoOferecerInstalacao);
    };
  }, []);

  const instalar = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Instalação resultado: ${outcome}`);
    setDeferredPrompt(null);
  };

  return (
    <>
      <div className="cfg-bloco">
        <h3 className="cfg-bloco__titulo">Status de conectividade</h3>
        <div className="cfg-status">
          <span className={`cfg-status__ponto${online ? '' : ' cfg-status__ponto--crit'}`} aria-hidden="true" />
          <span>{online ? 'Dispositivo online' : 'Modo offline ativo'}</span>
        </div>
        <p className="cfg-texto">
          {online
            ? 'Você está sincronizado com a nuvem em tempo real.'
            : 'Suas ordens e fotos de inspeção serão salvas localmente e sincronizadas quando restabelecer a conexão.'}
        </p>
      </div>

      {deferredPrompt && (
        <div className="cfg-bloco cfg-bloco--separado">
          <h3 className="cfg-bloco__titulo">Aplicativo instalável</h3>
          <p className="cfg-texto">Instale o RevisaCar neste dispositivo para abri-lo direto da tela inicial.</p>
          <Button variant="primary" icon={IcInstalar} onClick={instalar}>Instalar RevisaCar</Button>
        </div>
      )}
    </>
  );
}
