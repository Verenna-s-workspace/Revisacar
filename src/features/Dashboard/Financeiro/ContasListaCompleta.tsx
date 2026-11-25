import { useEffect, useMemo, useRef, useState } from 'react';
import { tokens } from '../../../constants';
import { Card } from '../Primitives';
import { Icons } from '../Icons';
import { Input } from '../../../components/inputs/input';
import { Valor } from '../../../components/Privacidade';
import { formatBRL } from '../../../utils/dashboard';
import { ContaLinha } from './ContaLinha';
import { labelCategoria } from './categoriaLabels';
import { ordenarPorUrgencia, somaValores } from './contasUtils';
import type { TipoContas } from './ContasWidget';
import type { Transacao } from './types';

type Filtro = 'todas' | 'vencidas' | 'a-vencer';

const TEXTOS: Record<TipoContas, { titulo: string; subtitulo: string; vazio: string; cor: string }> = {
  receber: {
    titulo: 'Contas a Receber',
    subtitulo: 'Tudo que clientes ainda vão pagar, sem limite de período.',
    vazio: 'Nenhuma conta a receber pendente.',
    cor: tokens.color.ok,
  },
  pagar: {
    titulo: 'Contas a Pagar',
    subtitulo: 'Tudo que a oficina ainda vai pagar, sem limite de período.',
    vazio: 'Nenhuma conta a pagar pendente.',
    cor: tokens.color.crit,
  },
};

/** Minúsculas e sem acento, pra "ola" achar "Olá". */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function Resumo({ rotulo, valor, detalhe, cor }: { rotulo: string; valor: number; detalhe: string; cor?: string }) {
  return (
    <Card style={{ padding: '14px 18px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted }}>{rotulo}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: cor ?? tokens.color.text, marginTop: 4, whiteSpace: 'nowrap' }}>
        <Valor texto={formatBRL(valor)} />
      </div>
      <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 2 }}>{detalhe}</div>
    </Card>
  );
}

export function ContasListaCompleta({ tipo, itens, isMobile, podeEditar, onVoltar, onMarcarPago, onEditar }: {
  tipo: TipoContas;
  itens: Transacao[];
  isMobile: boolean;
  podeEditar: boolean;
  onVoltar: () => void;
  onMarcarPago: (id: string) => void;
  onEditar: (t: Transacao) => void;
}) {
  const texto = TEXTOS[tipo];
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const topo = useRef<HTMLDivElement>(null);

  // Ao abrir, volta pro topo: o usuário vem do fim da tela do Financeiro.
  useEffect(() => {
    topo.current?.scrollIntoView({ block: 'start' });
  }, []);

  const ordenados = useMemo(() => ordenarPorUrgencia(itens), [itens]);
  const vencidas = useMemo(() => ordenados.filter(t => t.vencido), [ordenados]);
  const aVencer = useMemo(() => ordenados.filter(t => !t.vencido), [ordenados]);

  const visiveis = useMemo(() => {
    const base = filtro === 'vencidas' ? vencidas : filtro === 'a-vencer' ? aVencer : ordenados;
    const termo = normalizar(busca.trim());
    if (!termo) return base;
    return base.filter(t => normalizar(`${t.descricao} ${labelCategoria(t.tipo, t.categoria)} ${t.cliente_nome}`).includes(termo));
  }, [filtro, busca, ordenados, vencidas, aVencer]);

  const chips: { id: Filtro; rotulo: string; qtd: number }[] = [
    { id: 'todas', rotulo: 'Todas', qtd: ordenados.length },
    { id: 'vencidas', rotulo: 'Vencidas', qtd: vencidas.length },
    { id: 'a-vencer', rotulo: 'A vencer', qtd: aVencer.length },
  ];

  const filtrando = filtro !== 'todas' || busca.trim() !== '';

  return (
    <div ref={topo} style={{ display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 12 }}>
      <div>
        <button
          type="button"
          onClick={onVoltar}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 0', background: 'transparent', border: 'none', color: tokens.color.muted, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
        >
          <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>{Icons.arrow}</span>
          Voltar ao Financeiro
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: '4px 0 0' }}>{texto.titulo}</h2>
        <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>{texto.subtitulo}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Resumo
          rotulo="Total pendente"
          valor={somaValores(ordenados)}
          detalhe={`${ordenados.length} conta${ordenados.length !== 1 ? 's' : ''}`}
          cor={texto.cor}
        />
        <Resumo
          rotulo="Vencido"
          valor={somaValores(vencidas)}
          detalhe={`${vencidas.length} conta${vencidas.length !== 1 ? 's' : ''}`}
          cor={vencidas.length > 0 ? tokens.color.crit : undefined}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between' }}>
        <div role="group" aria-label="Filtrar contas" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chips.map(c => {
            const ativo = filtro === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(c.id)}
                style={{
                  padding: '7px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${ativo ? 'var(--color-ferrari)' : tokens.color.border}`,
                  background: ativo ? 'var(--color-ferrari)' : tokens.color.surface,
                  color: ativo ? 'white' : tokens.color.text,
                }}
              >
                {c.rotulo} ({c.qtd})
              </button>
            );
          })}
        </div>
        <div style={{ width: isMobile ? '100%' : 280 }}>
          <Input
            name={`busca-contas-${tipo}`}
            type="search"
            value={busca}
            onChangeValue={setBusca}
            placeholder="Buscar por descrição, categoria ou cliente"
          />
        </div>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: tokens.color.text }}>Por urgência</span>
          <span style={{ fontSize: '0.78rem', color: tokens.color.muted }}>
            {filtrando ? `${visiveis.length} de ${ordenados.length}` : `${ordenados.length} pendente${ordenados.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {visiveis.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: tokens.color.muted, fontSize: '0.82rem' }}>
            {ordenados.length === 0 ? texto.vazio : 'Nenhuma conta com esse filtro.'}
          </div>
        ) : (
          visiveis.map(t => (
            <ContaLinha key={t.id} t={t} corValor={texto.cor} podeEditar={podeEditar} onMarcarPago={onMarcarPago} onEditar={onEditar} />
          ))
        )}
      </Card>
    </div>
  );
}
