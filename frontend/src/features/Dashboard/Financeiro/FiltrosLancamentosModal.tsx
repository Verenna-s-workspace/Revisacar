import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalSection, ModalFields, ModalFooter } from '../../../components/system/Modal';
import { Button } from '../../../components/system/Button';
import { Input } from '../../../components/inputs/input';
import { FILTROS_VAZIOS, chaveCategoria, contarFiltrosAtivos, dataCompleta } from '../../../utils/financeiro_utils';
import type { FiltrosLancamentos } from '../../../utils/financeiro_utils';
import { LABEL_CATEGORIA_ENTRADA, LABEL_CATEGORIA_SAIDA, LABEL_FORMA_PAGAMENTO } from './categoriaLabels';
import type { Categorias } from './types';
import { IcFiltros } from '../Estoque/icones';

interface Props {
  filtros: FiltrosLancamentos;
  categorias: Categorias;
  /** Intervalo do período da tela: limita as datas e explica o que o filtro de data faz. */
  periodo: { de: string; ate: string };
  onAplicar: (f: FiltrosLancamentos) => void;
  onFechar: () => void;
}

function Segmentos<T extends string>({ rotulo, valor, opcoes, onChange }: {
  rotulo: string; valor: T; opcoes: { id: T; texto: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="fin-seg" role="group" aria-label={rotulo}>
      {opcoes.map(o => (
        <button key={o.id} type="button" aria-pressed={valor === o.id} onClick={() => onChange(o.id)}>{o.texto}</button>
      ))}
    </div>
  );
}

function Chips({ rotulo, itens, marcados, onToggle }: {
  rotulo: string; itens: { id: string; texto: string }[]; marcados: string[]; onToggle: (id: string) => void;
}) {
  return (
    <div className="fin-grupo">
      <h4 className="fin-grupo__titulo">{rotulo}</h4>
      <div className="fin-grupo__chips">
        {itens.map(i => (
          <button key={i.id} type="button" className="fin-chip" aria-pressed={marcados.includes(i.id)} onClick={() => onToggle(i.id)}>
            {i.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]);

/** Filtros dos lançamentos já carregados para o período. Tudo é aplicado só ao clicar em "Aplicar". */
export function FiltrosLancamentosModal({ filtros, categorias, periodo, onAplicar, onFechar }: Props) {
  const [f, setF] = useState<FiltrosLancamentos>(filtros);
  const set = <K extends keyof FiltrosLancamentos>(k: K, v: FiltrosLancamentos[K]) => setF(atual => ({ ...atual, [k]: v }));

  // Categorias que a API devolve; se ainda não chegaram, cai nas conhecidas do sistema.
  const entradas = (categorias.entrada.length ? categorias.entrada : Object.keys(LABEL_CATEGORIA_ENTRADA));
  const saidas = (categorias.saida.length ? categorias.saida : Object.keys(LABEL_CATEGORIA_SAIDA));
  const formas = (categorias.formas_pagamento.length ? categorias.formas_pagamento : Object.keys(LABEL_FORMA_PAGAMENTO));

  const mostrarEntradas = f.tipo !== 'saida';
  const mostrarSaidas = f.tipo !== 'entrada';

  const ativos = contarFiltrosAtivos(f);
  const dataInvalida = !!f.de && !!f.ate && f.de > f.ate;
  const valorInvalido = f.valorMin !== '' && f.valorMax !== '' && Number(f.valorMin) > Number(f.valorMax);

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    if (dataInvalida || valorInvalido) return;
    // Ao restringir o tipo, categorias do outro tipo não fazem mais sentido.
    const cats = f.categorias.filter(c => (f.tipo === 'todos' ? true : c.startsWith(`${f.tipo}:`)));
    onAplicar({ ...f, categorias: cats });
  };

  return (
    <Modal size="md" onClose={onFechar} onSubmit={aplicar}>
      <ModalHeader
        icon={IcFiltros}
        title="Filtros dos lançamentos"
        description={`Refinam os lançamentos de ${dataCompleta(periodo.de)} a ${dataCompleta(periodo.ate)}.`}
      />
      <ModalBody>
        <ModalSection title="Tipo e situação">
          <div className="fin-grupo">
            <h4 className="fin-grupo__titulo">Tipo</h4>
            <Segmentos
              rotulo="Tipo" valor={f.tipo} onChange={v => set('tipo', v)}
              opcoes={[{ id: 'todos', texto: 'Todos' }, { id: 'entrada', texto: 'Entradas' }, { id: 'saida', texto: 'Saídas' }]}
            />
          </div>
          <div className="fin-grupo">
            <h4 className="fin-grupo__titulo">Status</h4>
            <Segmentos
              rotulo="Status" valor={f.status} onChange={v => set('status', v)}
              opcoes={[{ id: 'todos', texto: 'Todos' }, { id: 'pago', texto: 'Pago' }, { id: 'pendente', texto: 'Pendente' }, { id: 'vencido', texto: 'Vencido' }]}
            />
          </div>
          <div className="fin-grupo">
            <h4 className="fin-grupo__titulo">Origem</h4>
            <Segmentos
              rotulo="Origem" valor={f.origem} onChange={v => set('origem', v)}
              opcoes={[{ id: 'todas', texto: 'Todas' }, { id: 'os', texto: 'Ordem de serviço' }, { id: 'manual', texto: 'Lançamento manual' }]}
            />
          </div>
        </ModalSection>

        <ModalSection title="Categoria" description="Marque uma ou mais. Sem nenhuma marcada, mostra todas.">
          {mostrarEntradas && (
            <Chips
              rotulo="Entradas"
              itens={entradas.map(c => ({ id: chaveCategoria('entrada', c), texto: LABEL_CATEGORIA_ENTRADA[c] ?? c }))}
              marcados={f.categorias} onToggle={id => set('categorias', alternar(f.categorias, id))}
            />
          )}
          {mostrarSaidas && (
            <Chips
              rotulo="Saídas"
              itens={saidas.map(c => ({ id: chaveCategoria('saida', c), texto: LABEL_CATEGORIA_SAIDA[c] ?? c }))}
              marcados={f.categorias} onToggle={id => set('categorias', alternar(f.categorias, id))}
            />
          )}
        </ModalSection>

        <ModalSection title="Forma de pagamento">
          <Chips
            rotulo="Marque uma ou mais"
            itens={formas.map(c => ({ id: c, texto: LABEL_FORMA_PAGAMENTO[c] ?? c }))}
            marcados={f.formas} onToggle={id => set('formas', alternar(f.formas, id))}
          />
        </ModalSection>

        <ModalSection title="Data e valor" description="A data é a de competência (coluna Data da tabela). O valor é o bruto, antes da taxa.">
          <ModalFields>
            <Input name="fin-filtro-de" type="date" label="Data inicial" value={f.de} onChangeValue={v => set('de', v)} min={periodo.de} max={f.ate || periodo.ate} />
            <Input name="fin-filtro-ate" type="date" label="Data final" value={f.ate} onChangeValue={v => set('ate', v)} min={f.de || periodo.de} max={periodo.ate} error={dataInvalida ? 'A data inicial não pode ser depois da final.' : undefined} />
            <Input name="fin-filtro-min" type="currency" label="Valor mínimo" placeholder="R$ 0,00" value={f.valorMin} onChangeValue={v => set('valorMin', v)} />
            <Input name="fin-filtro-max" type="currency" label="Valor máximo" placeholder="R$ 0,00" value={f.valorMax} onChangeValue={v => set('valorMax', v)} error={valorInvalido ? 'O mínimo não pode ser maior que o máximo.' : undefined} />
          </ModalFields>
        </ModalSection>
      </ModalBody>
      <ModalFooter hint={ativos > 0 ? `${ativos} filtro${ativos > 1 ? 's' : ''} ligado${ativos > 1 ? 's' : ''}` : undefined}>
        <Button variant="ghost" onClick={() => setF(FILTROS_VAZIOS)} disabled={ativos === 0}>Limpar</Button>
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button variant="primary" type="submit" disabled={dataInvalida || valorInvalido}>Aplicar</Button>
      </ModalFooter>
    </Modal>
  );
}
