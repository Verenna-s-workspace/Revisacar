import { useState } from 'react';
import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { AssinaturaPad } from '../../../components/AssinaturaPad';
import { Input } from '../../../components/inputs/input';
import { Textarea } from '../../../components/inputs/textarea';
import { Button } from '../../../components/system';
import { Recolhivel } from '../../../components/os/Recolhivel';
import { FILTRO } from '../../../components/inputs/masks';
import { DATA_MIN, LIM, hojeISO, validarData, validarKm, validarNome, validarRegistro } from '../../../utils/campos_checklist';
import '../../../components/os/os-fase.css';

interface Props {
  os: ReturnType<typeof useOrdemServico>;
  /** Gera o PDF do checklist de entrada (o gerador de sempre: utils/exportPDF). */
  onExportPDF: () => void;
}

const IcBaixar = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;

/**
 * Sub-etapa 4: responsável pela entrada + assinatura DO TÉCNICO (só para o PDF; não é gravada no servidor) +
 * botão do PDF da entrada. A assinatura não bloqueia o "Concluir entrada".
 */
export function EtapaAssinatura({ os, onExportPDF }: Props) {
  const { tecnico, setTecnico, osHeader, assinaturaTecnico, setAssinaturaTecnico } = os;
  const [refazendo, setRefazendo] = useState(0);        // muda a key do pad para limpar o canvas

  return (
    <section className="osf-sec" aria-labelledby="et4-titulo">
      <h2 id="et4-titulo" className="osf-card__titulo">Responsável e assinatura</h2>

      <div className="osf-grid osf-grid--2">
        <Input
          name="responsavel_entrada" type="nome" label="Responsável pela entrada" required maxLength={LIM.nome}
          value={tecnico.nome} validate={validarNome} placeholder="Quem recebeu o veículo"
          hint="Sugerido pelo usuário logado; pode trocar."
          error={tecnico.nome.trim() ? undefined : 'Obrigatório para concluir a entrada'}
          onChangeValue={(v) => setTecnico((p) => ({ ...p, nome: v }))}
        />
        <Input
          name="tec_registro" label="Registro / CREA (opcional)" placeholder="000000" value={tecnico.registro}
          maxLength={LIM.registro} filter={FILTRO.registro} validate={validarRegistro}
          onChangeValue={(v) => setTecnico((p) => ({ ...p, registro: v }))}
        />
      </div>

      <div className="osf-sec" style={{ gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Assinatura do técnico</h3>
        {assinaturaTecnico ? (
          <>
            <div className="osf-ass" data-estado="assinada"><img src={assinaturaTecnico} alt="Assinatura do técnico" /></div>
            <div>
              <Button variant="secondary" style={{ minHeight: 44 }} onClick={() => { setAssinaturaTecnico(null); setRefazendo((n) => n + 1); }}>
                Limpar e refazer
              </Button>
            </div>
          </>
        ) : (
          <>
            <AssinaturaPad key={refazendo} onChange={setAssinaturaTecnico} />
            <div className="osf-aviso" data-tom="warn" role="status">
              Sem assinatura, o PDF da entrada sai com a linha de assinatura em branco. A assinatura não é exigida para concluir a entrada.
            </div>
          </>
        )}
        <p className="osf-nota">A assinatura serve só para o PDF desta tela: ela não fica salva na OS e some se você recarregar a página.</p>
      </div>

      <div>
        <Button variant="secondary" icon={IcBaixar} onClick={onExportPDF} style={{ minHeight: 44 }}>Gerar PDF da entrada</Button>
      </div>

      {/* TODO(Fechamento): estes quatro campos pertencem ao Fechamento (retirada do veículo). Ficam aqui, sem bloquear nada,
          porque esse módulo ainda não existe; devem ser movidos para lá quando o Fechamento for construído. */}
      <Recolhivel titulo="Dados de saída" nota="preencher na entrega">
        <div className="osf-grid osf-grid--3">
          <Input
            name="tec_km_saida" type="km" label="Km de saída" placeholder="97.550" value={tecnico.km_saida}
            validate={validarKm} onChangeValue={(v) => setTecnico((p) => ({ ...p, km_saida: v }))}
          />
          <Input
            name="tec_data_saida" type="date" label="Data de saída" value={tecnico.data_saida}
            min={osHeader.os_date || DATA_MIN} max={hojeISO()} validate={validarData}
            onChangeValue={(v) => setTecnico((p) => ({ ...p, data_saida: v }))}
          />
          <Input
            name="tec_hora_saida" type="time" label="Hora de saída" value={tecnico.hora_saida}
            onChangeValue={(v) => setTecnico((p) => ({ ...p, hora_saida: v }))}
          />
        </div>
        <Textarea
          name="tec_parecer_geral" label="Parecer geral do técnico" rows={4} maxLength={LIM.parecer} value={tecnico.parecer_geral}
          placeholder="Descreva o estado geral do veículo e recomendações..."
          onChangeValue={(v) => setTecnico((p) => ({ ...p, parecer_geral: v }))}
        />
      </Recolhivel>
    </section>
  );
}
