import { Valor } from '../../../components/Privacidade';
import { formatBRL } from '../../../utils/dashboard';
import { formatarNumero } from '../../../utils/relatorios';
import type { ItemEstoqueMovimentado } from '../../../types/estoque';
import { IcCaixa, IcCaixas } from './relatoriosIcones';

function FotoOuCaixaEstoque({
  item,
  tamanho,
}: {
  item: ItemEstoqueMovimentado;
  tamanho: 'lg' | 'sm';
}) {
  const classe = `rel-destaque__moldura rel-destaque__moldura--${tamanho}`;
  if (item.fotoDataUrl) {
    return (
      <div className={classe}>
        <img src={item.fotoDataUrl} alt={item.nome} />
      </div>
    );
  }
  return (
    <div className={classe} aria-hidden='true'>
      <IcCaixas tamanho={tamanho === 'lg' ? 36 : 20} />
    </div>
  );
}

interface DestaquesPeriodoProps {
  itens: ItemEstoqueMovimentado[];
  onVerItem: (nome: string) => void;
}

export function DestaquesPeriodo({ itens, onVerItem }: DestaquesPeriodoProps) {
  const [destaque, ...resto] = itens;
  const secundarios = resto.slice(0, 3);

  if (!destaque) return null;

  return (
    <section className='rel-card'>
      <div className='rel-card__cab'>
        <div className='rel-card__titulos'>
          <h2 className='rel-card__titulo'>Destaques do período</h2>
          <p className='rel-card__sub'>
            Item de estoque com maior saída, com preço, disponibilidade e acesso direto — clique para ver no Estoque.
          </p>
        </div>
        <span className='rel-card__icone' aria-hidden='true'>{IcCaixa}</span>
      </div>

      <div className='rel-card__corpo'>
        <div className='rel-destaque-grid'>
          {/* item #1 — destaque grande */}
          <div className='rel-destaque__principal'>
            <span className='rel-destaque__selo'>Mais movimentado</span>

            <div className='rel-destaque__conteudo'>
              <button
                type='button'
                className='rel-destaque__moldura rel-destaque__moldura--lg'
                style={{ cursor: 'pointer' }}
                onClick={() => onVerItem(destaque.nome)}
                title={`Ver ${destaque.nome} no Estoque`}
                aria-label={`Ver ${destaque.nome} no Estoque`}
              >
                {destaque.fotoDataUrl ? (
                  <img src={destaque.fotoDataUrl} alt={destaque.nome} />
                ) : (
                  <IcCaixas tamanho={36} />
                )}
              </button>

              <div className='rel-destaque__info'>
                <span className='rel-destaque__cat'>{destaque.categoria || 'Geral'}</span>

                <button
                  type='button'
                  className='rel-destaque__link'
                  onClick={() => onVerItem(destaque.nome)}
                >
                  {destaque.nome}
                </button>

                {destaque.preco !== undefined && (
                  <div className='rel-destaque__preco'>
                    <Valor texto={formatBRL(destaque.preco)} />
                  </div>
                )}

                <div className='rel-destaque__metricas'>
                  {destaque.quantidadeAtual !== undefined && (
                    <div>
                      <div className='rel-destaque__metrica-label'>Em estoque</div>
                      <div className='rel-destaque__metrica-val'>
                        {formatarNumero(destaque.quantidadeAtual)} un.
                      </div>
                    </div>
                  )}
                  <div>
                    <div className='rel-destaque__metrica-label'>Movimentado no período</div>
                    <div className='rel-destaque__metrica-val'>
                      {formatarNumero(destaque.quantidade)} un.
                    </div>
                  </div>
                </div>

                <button
                  type='button'
                  className='rel-btn rel-btn--primario'
                  onClick={() => onVerItem(destaque.nome)}
                >
                  Ver item
                </button>
              </div>
            </div>
          </div>

          {/* #2, #3, #4 — secundários */}
          {secundarios.length > 0 && (
            <div className='rel-destaque__secundarios'>
              {secundarios.map((item, i) => (
                <button
                  key={item.id ?? item.nome}
                  type='button'
                  className='rel-destaque__item-btn'
                  onClick={() => onVerItem(item.nome)}
                >
                  <FotoOuCaixaEstoque item={item} tamanho='sm' />
                  <div className='rel-destaque__item-texto'>
                    <span className='rel-destaque__item-pos'>#{i + 2}</span>
                    <span className='rel-destaque__item-nome'>{item.nome}</span>
                    <span className='rel-destaque__item-qtd'>
                      {formatarNumero(item.quantidade)} un. movimentadas
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}