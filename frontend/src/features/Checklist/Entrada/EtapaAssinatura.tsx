import { useState } from 'react';
import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { AssinaturaPad } from '../../../components/AssinaturaPad';
import { Input } from '../../../components/inputs/input';
import { Button } from '../../../components/system';
import { LIM, validarNome } from '../../../utils/campos_checklist';
import '../../../components/os/os-fase.css';

/** Sub-etapa 4: responsável pela entrada + termo de recebimento assinado pelo cliente (ou adiado). */
export function EtapaAssinatura({ os }: { os: ReturnType<typeof useOrdemServico> }) {
  const { cliente, tecnico, setTecnico, assinaturaEntrada: ass, setAssinaturaEntrada } = os;
  const [traco, setTraco] = useState<string | null>(null);
  const [refazendo, setRefazendo] = useState(0);        // muda a key do pad para limpar o canvas
  const quem = cliente.nome.trim() || 'O cliente';

  const coletar = () => { if (traco) { setAssinaturaEntrada({ status: 'assinada', imagem: traco, quem: cliente.nome.trim() }); setTraco(null); } };
  const refazer = () => { setAssinaturaEntrada({ status: 'pendente', imagem: '', quem: '' }); setTraco(null); setRefazendo((n) => n + 1); };

  return (
    <section className="osf-sec" aria-labelledby="et4-titulo">
      <div className="osf-sec" style={{ gap: 6 }}>
        <h2 id="et4-titulo" className="osf-card__titulo">Termo de recebimento</h2>
        <p className="osf-card__sub" style={{ overflowWrap: 'anywhere' }}>
          {quem} concorda com o estado do veículo registrado nesta entrada: relato, avarias, itens e fotos.
        </p>
      </div>

      <div style={{ maxWidth: 420 }}>
        <Input
          name="responsavel_entrada" type="nome" label="Responsável pela entrada" required maxLength={LIM.nome}
          value={tecnico.nome} validate={validarNome} placeholder="Quem recebeu o veículo"
          hint="Sugerido pelo usuário logado; pode trocar."
          error={tecnico.nome.trim() ? undefined : 'Obrigatório para concluir a entrada'}
          onChangeValue={(v) => setTecnico((p) => ({ ...p, nome: v }))}
        />
      </div>

      {ass.status === 'assinada' ? (
        <>
          <div className="osf-ass" data-estado="assinada"><img src={ass.imagem} alt={`Assinatura de ${quem}`} /></div>
          <p className="osf-nota">Assinada{ass.quando ? ' em ' + new Date(ass.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}{ass.por ? ` · registrado por ${ass.por}` : ''}.</p>
          <div><Button variant="secondary" onClick={refazer} style={{ minHeight: 44 }}>Limpar e refazer</Button></div>
        </>
      ) : ass.status === 'adiada' ? (
        <>
          <div className="osf-ass" data-estado="adiada"><span style={{ fontWeight: 500 }}>Assinatura adiada: cliente não está na oficina</span></div>
          <div className="osf-opcoes">
            <Button variant="secondary" onClick={refazer} style={{ minHeight: 44 }}>Cliente chegou, assinar agora</Button>
          </div>
        </>
      ) : (
        <>
          <AssinaturaPad key={refazendo} onChange={setTraco} />
          <div className="osf-opcoes">
            <Button variant="secondary" disabled={!traco} onClick={coletar} style={{ minHeight: 44 }}>Coletar assinatura</Button>
            <button type="button" className="osf-link" onClick={() => setAssinaturaEntrada({ status: 'adiada', imagem: '', quem: '' })}>Cliente não está aqui, assinar depois</button>
          </div>
        </>
      )}
      <p className="osf-nota">A OS segue para o Diagnóstico mesmo com a assinatura adiada. Ela fica como pendência no resumo e pode ser coletada ao reabrir a entrada.</p>
    </section>
  );
}
