"""
Consultas independentes ao Supabase rodando ao mesmo tempo.

Cada consulta é uma ida e volta de ~0,3 s entre o Render e o Supabase (medido em 30/10/2026). Quando
uma rota precisa de várias que não dependem uma da outra, fazê-las em sequência soma os tempos; aqui
elas saem juntas e o total vira o da mais lenta.

É seguro com o supabase-py: cada consulta monta os próprios cabeçalhos e o httpx.Client compartilhado
aceita várias threads. Não há ORM do Django envolvido (o backend não usa conexão de banco do Django).
"""
from concurrent.futures import ThreadPoolExecutor


def _rodar(tarefas):
    # Um pool por chamada: nunca trava se uma tarefa chamar em_paralelo de novo lá dentro.
    with ThreadPoolExecutor(max_workers=len(tarefas), thread_name_prefix="consulta") as pool:
        return [pool.submit(t) for t in tarefas]


def em_paralelo(*tarefas):
    """Roda as funções (sem argumentos) ao mesmo tempo e devolve os resultados na mesma ordem.
    Se alguma falhar, a exceção da primeira que falhou (na ordem das tarefas) sobe depois que
    todas terminarem, como se tivessem rodado em sequência."""
    if len(tarefas) <= 1:
        return [t() for t in tarefas]
    return [f.result() for f in _rodar(tarefas)]


def em_paralelo_cada(*tarefas):
    """Igual a em_paralelo, mas não sobe exceção: devolve (resultado, None) ou (None, exceção) por
    tarefa, para quem trata o erro de cada uma do seu jeito."""
    if not tarefas:
        return []
    saida = []
    for f in _rodar(tarefas):
        erro = f.exception()
        saida.append((None, erro) if erro is not None else (f.result(), None))
    return saida
