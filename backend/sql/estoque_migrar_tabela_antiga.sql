-- Migra os dados da tabela antiga public.estoque para o formato novo
-- (public.estoque_itens). RODAR DEPOIS de estoque.sql.
--
-- 1) Troque o doc da oficina na linha marcada (o `doc` do admin dono dos itens).
-- 2) Rode no SQL Editor. Roda uma vez só: se já migrou, não duplica
--    (a tabela antiga é renomeada pra estoque_antiga no final).
-- 3) Confira os itens no sistema. Depois, se estiver tudo certo, apague
--    estoque_antiga manualmente (este script NÃO apaga nada).
--
-- Regras da cópia:
--   quantidade/estoqueminimo → quantidade/minimo; "localização" → localizacao
--   preço entra como 0 (a tabela antiga não tinha) — acerte depois pela tela
--   categoria: casa com as categorias do sistema ignorando maiúscula/acento;
--   o que não casar vai pra 'Acessórios' (o NOTICE final diz quantos)
--   itens com quantidade > 0 ganham a entrada 'Cadastro inicial' no log

do $$
declare
  v_oficina_doc text := 'COLOQUE_AQUI_O_DOC_DA_OFICINA';   -- <<< TROQUE
  v_total int; v_sem_categoria int;
begin
  if to_regclass('public.estoque') is null then
    raise notice 'Tabela public.estoque não existe (já migrada?). Nada a fazer.';
    return;
  end if;
  if not exists (select 1 from public.admins where doc = v_oficina_doc) then
    raise exception 'Oficina % não existe em admins. Troque o doc na linha marcada.', v_oficina_doc;
  end if;

  create temp table _mig on commit drop as
  select
    e.id,
    coalesce(nullif(btrim(e.nome), ''), 'Sem nome') as nome,
    coalesce(
      (select c from unnest(array['Acessórios','Bancos','Calotas','Correias','Elétrica','Filtros','Fluidos',
                                  'Freios','Funilaria','Lubrificantes','Motor','Pneus','Rodas','Suspensão','Volante']) c
        where translate(lower(c), 'áàâãéêíóôõúç', 'aaaaeeioooucu') =
              translate(lower(btrim(coalesce(e."categoria", ''))), 'áàâãéêíóôõúç', 'aaaaeeioooucu')),
      'Acessórios') as categoria,
    (select count(*) = 0 from unnest(array['acessorios','bancos','calotas','correias','eletrica','filtros','fluidos',
                                           'freios','funilaria','lubrificantes','motor','pneus','rodas','suspensao','volante']) c
      where c = translate(lower(btrim(coalesce(e."categoria", ''))), 'áàâãéêíóôõúç', 'aaaaeeioooucu')) as sem_categoria,
    greatest(coalesce(e.quantidade, 0), 0) as quantidade,
    greatest(coalesce(e.estoqueminimo, 0), 0) as minimo,
    coalesce(e."localização", '') as localizacao,
    coalesce(e.created_at, now()) as created_at
  from public.estoque e
  where not exists (select 1 from public.estoque_itens i where i.id = e.id);

  select count(*), count(*) filter (where sem_categoria) into v_total, v_sem_categoria from _mig;

  insert into public.estoque_itens (id, oficina_doc, nome, categoria, quantidade, minimo, preco, localizacao, created_at)
  select id, v_oficina_doc, nome, categoria, quantidade, minimo, 0, localizacao, created_at from _mig;

  insert into public.estoque_movimentos (oficina_doc, item_id, tipo, quantidade, motivo)
  select v_oficina_doc, id, 'entrada', quantidade, 'Cadastro inicial' from _mig where quantidade > 0;

  alter table public.estoque rename to estoque_antiga;
  raise notice 'Migrados % itens (% sem categoria reconhecida → "Acessórios", preço 0). Tabela antiga renomeada para estoque_antiga.', v_total, v_sem_categoria;
end $$;
