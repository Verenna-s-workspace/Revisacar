import { tokens } from '../../constants';
import {
  aplicarItemDoEstoque, aplicarServicoDoCatalogo, LIMITES, subtotalDoItem, type ErrosItens,
} from '../../utils/orcamento_utils';
import { formatBRL } from '../../utils/dashboard';
import type { EstoqueItem } from '../../types/estoque';
import type { ServicoItem } from '../../types/servico';
import type { ItemRascunho } from '../../types/orcamento';

const entrada: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontFamily: tokens.fontSans, fontSize: '0.84rem',
  color: tokens.color.text, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md, outline: 'none',
};
const legenda: React.CSSProperties = {
  display: 'block', fontFamily: tokens.fontMono, fontSize: '0.58rem', letterSpacing: '0.07em',
  textTransform: 'uppercase', color: tokens.color.subtle, marginBottom: 4,
};
const selo = (cor: string, fundo: string): React.CSSProperties => ({
  fontFamily: tokens.fontMono, fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: cor, background: fundo, borderRadius: tokens.radius.full, padding: '2px 8px', whiteSpace: 'nowrap',
});

interface Props {
  itens: ItemRascunho[];
  erros: ErrosItens;
  mostrarErros: boolean;
  podeVerCusto: boolean;
  estoque: EstoqueItem[];
  servicos: ServicoItem[];
  onAtualizar: (chave: string, patch: Partial<ItemRascunho>) => void;
  onRemover: (chave: string) => void;
}

export function ItensEditor({ itens, erros, mostrarErros, podeVerCusto, estoque, servicos, onAtualizar, onRemover }: Props) {
  const estoqueAtivo = estoque.filter(e => e.status === 'ativo');
  const servicosAtivos = servicos.filter(s => s.ativo);

  const trocarDescricao = (item: ItemRascunho, texto: string) => {
    // Escolher uma sugestão (nome exato) liga o item ao Estoque/Catálogo e traz o preço.
    if (item.tipo === 'peca') {
      const achado = estoqueAtivo.find(e => e.nome === texto);
      if (achado) return onAtualizar(item.chave, aplicarItemDoEstoque(item, achado));
    } else {
      const achado = servicosAtivos.find(s => s.nome === texto);
      if (achado) return onAtualizar(item.chave, aplicarServicoDoCatalogo(item, achado));
    }
    onAtualizar(item.chave, { descricao: texto });
  };

  if (itens.length === 0) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center', color: tokens.color.muted, fontSize: '0.86rem' }}>
        Nenhum item ainda. Adicione peças e serviços abaixo.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <datalist id="orc-lista-pecas">
        {estoqueAtivo.map(e => <option key={e.id} value={e.nome}>{formatBRL(e.preco)} · {e.quantidade} em estoque{e.reservado ? ` (${e.reservado} reservado)` : ''}</option>)}
      </datalist>
      <datalist id="orc-lista-servicos">
        {servicosAtivos.map(s => <option key={s.id} value={s.nome}>{formatBRL(s.preco)}</option>)}
      </datalist>

      {itens.map((item, n) => {
        const erro = mostrarErros ? erros[item.chave] : undefined;
        const ligadoEstoque = item.estoqueItemId ? estoque.find(e => e.id === item.estoqueItemId) : undefined;
        const ligadoCatalogo = item.servicoId ? servicos.find(s => s.id === item.servicoId) : undefined;
        const q = Number(item.quantidade.replace(',', '.'));
        const faltaEstoque = !!ligadoEstoque && Number.isFinite(q) && q > ligadoEstoque.quantidade;
        const id = `orc-${item.chave}`;
        return (
          <div key={item.chave} style={{
            border: `1px solid ${erro ? tokens.color.crit : tokens.color.border}`, borderRadius: tokens.radius.lg,
            background: tokens.color.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: tokens.fontMono, fontSize: '0.62rem', color: tokens.color.subtle }}>#{n + 1}</span>
              <span style={item.tipo === 'peca' ? selo(tokens.color.warn, tokens.color.warnBg) : selo(tokens.color.ok, tokens.color.okBg)}>
                {item.tipo === 'peca' ? 'Peça' : 'Serviço'}
              </span>
              {item.doDiagnostico && <span style={selo(tokens.color.ferrari, tokens.color.accentDim)}>do diagnóstico</span>}
              {ligadoEstoque && (
                <span style={selo(tokens.color.textSecond, tokens.color.surfaceHigh)} title="Ligada ao Estoque">
                  Estoque: {ligadoEstoque.nome} · {ligadoEstoque.quantidade} un.
                </span>
              )}
              {ligadoCatalogo && (
                <span style={selo(tokens.color.textSecond, tokens.color.surfaceHigh)} title="Ligado ao Catálogo">
                  Catálogo: {ligadoCatalogo.nome}
                </span>
              )}
              {(item.estoqueItemId || item.servicoId) && (
                <button type="button" onClick={() => onAtualizar(item.chave, { estoqueItemId: undefined, servicoId: undefined })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.color.muted, fontSize: '0.7rem', textDecoration: 'underline' }}>
                  desvincular
                </button>
              )}
              <button type="button" onClick={() => onRemover(item.chave)} aria-label={`Remover item ${n + 1}`} title="Remover item"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: tokens.color.subtle, fontSize: '1.05rem', lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div>
              <label style={legenda} htmlFor={`${id}-desc`}>Descrição</label>
              <input id={`${id}-desc`} value={item.descricao} maxLength={LIMITES.descricao}
                list={item.tipo === 'peca' ? 'orc-lista-pecas' : 'orc-lista-servicos'}
                placeholder={item.tipo === 'peca' ? 'Peça (digite ou escolha do estoque)' : 'Serviço (digite ou escolha do catálogo)'}
                onChange={e => trocarDescricao(item, e.target.value)} style={entrada} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
              {item.tipo === 'peca' && (
                <div>
                  <label style={legenda} htmlFor={`${id}-marca`}>Marca</label>
                  <input id={`${id}-marca`} value={item.marca} maxLength={LIMITES.marca} placeholder="Ex.: Bosch"
                    onChange={e => onAtualizar(item.chave, { marca: e.target.value })} style={entrada} />
                </div>
              )}
              <div>
                <label style={legenda} htmlFor={`${id}-qtd`}>Quantidade</label>
                <input id={`${id}-qtd`} value={item.quantidade} inputMode="decimal"
                  onChange={e => onAtualizar(item.chave, { quantidade: e.target.value })} style={entrada} />
              </div>
              <div>
                <label style={legenda} htmlFor={`${id}-preco`}>Preço cobrado (un.)</label>
                <input id={`${id}-preco`} value={item.precoUnitario} inputMode="decimal" placeholder="0,00"
                  onChange={e => onAtualizar(item.chave, { precoUnitario: e.target.value })} style={entrada} />
              </div>
              {podeVerCusto && (
                <div>
                  <label style={legenda} htmlFor={`${id}-custo`}>Custo (un.)</label>
                  <input id={`${id}-custo`} value={item.custoUnitario} inputMode="decimal" placeholder="0,00"
                    onChange={e => onAtualizar(item.chave, { custoUnitario: e.target.value })} style={entrada} />
                </div>
              )}
              <div>
                <span style={legenda}>Subtotal</span>
                <div style={{ padding: '8px 2px', fontWeight: 800, fontSize: '0.92rem', color: tokens.color.text }}>
                  {formatBRL(subtotalDoItem(item))}
                </div>
              </div>
            </div>

            <div>
              <label style={legenda} htmlFor={`${id}-motivo`}>Motivo / observação</label>
              <input id={`${id}-motivo`} value={item.motivo} maxLength={LIMITES.motivo}
                placeholder="Por que isso precisa ser feito (aparece pro cliente)"
                onChange={e => onAtualizar(item.chave, { motivo: e.target.value })} style={entrada} />
            </div>

            {faltaEstoque && (
              <div style={{ fontSize: '0.76rem', color: tokens.color.warn }}>
                Só há {ligadoEstoque!.quantidade} em estoque — será preciso comprar o restante.
              </div>
            )}
            {erro && <div role="alert" style={{ fontSize: '0.78rem', color: tokens.color.crit }}>{erro}</div>}
          </div>
        );
      })}
    </div>
  );
}
