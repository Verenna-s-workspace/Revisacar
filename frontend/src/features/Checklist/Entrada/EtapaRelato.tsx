import type { useOrdemServico } from '../../../hooks/useOrdemServico';
import { Textarea } from '../../../components/inputs/textarea';
import { LIM } from '../../../utils/campos_checklist';
import '../../../components/os/os-fase.css';

/** Sub-etapa 2: relato do cliente e avarias/itens no veículo. Os dois são opcionais; limite real de `campos_checklist`. */
export function EtapaRelato({ os }: { os: ReturnType<typeof useOrdemServico> }) {
  const { veiculo, setVeiculo } = os;
  const contador = (v: string) => `${v.length}/${LIM.obsLonga}`;
  return (
    <section className="osf-sec" aria-labelledby="et2-titulo">
      <h2 id="et2-titulo" className="osf-card__titulo">Relato e avarias <span style={{ fontWeight: 500, color: 'var(--color-muted)', fontSize: '0.875rem' }}>· opcional</span></h2>
      <div>
        <Textarea
          name="obs_cliente" label="O que o cliente relatou" rows={5} maxLength={LIM.obsLonga} value={veiculo.obs_cliente}
          placeholder="Ex.: Barulho metálico ao frear e pedal mais baixo que o normal."
          onChangeValue={(v) => setVeiculo((p) => ({ ...p, obs_cliente: v }))}
        />
        <p className="osf-nota" style={{ textAlign: 'right' }} aria-live="off">{contador(veiculo.obs_cliente)}</p>
      </div>
      <div>
        <Textarea
          name="obs_entrada" label="Avarias e itens no veículo" rows={5} maxLength={LIM.obsLonga} value={veiculo.obs_entrada}
          placeholder="Ex.: Para-choque dianteiro riscado. Estepe, macaco e triângulo presentes."
          hint="Vale registrar o que já está danificado, para ficar no termo de recebimento."
          onChangeValue={(v) => setVeiculo((p) => ({ ...p, obs_entrada: v }))}
        />
        <p className="osf-nota" style={{ textAlign: 'right' }} aria-live="off">{contador(veiculo.obs_entrada)}</p>
      </div>
    </section>
  );
}
