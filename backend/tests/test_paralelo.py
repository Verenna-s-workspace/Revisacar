import threading
import time

import pytest

from orders.paralelo import em_paralelo, em_paralelo_cada


def test_devolve_na_ordem_das_tarefas_mesmo_terminando_fora_de_ordem():
    def lenta():
        time.sleep(0.05)
        return "lenta"
    assert em_paralelo(lenta, lambda: "rapida", lambda: 3) == ["lenta", "rapida", 3]


def test_roda_ao_mesmo_tempo():
    inicio = time.perf_counter()
    em_paralelo(*(lambda: time.sleep(0.1) for _ in range(5)))
    assert time.perf_counter() - inicio < 0.3      # em sequência seriam 0,5 s


def test_sobe_o_erro_da_primeira_tarefa_que_falhou_depois_de_todas_terminarem():
    terminou = threading.Event()

    def falha(msg):
        def f():
            raise ValueError(msg)
        return f

    def demora():
        time.sleep(0.05)
        terminou.set()
    with pytest.raises(ValueError, match="primeira"):
        em_paralelo(demora, falha("primeira"), falha("segunda"))
    assert terminou.is_set()


def test_cada_devolve_resultado_ou_erro_por_tarefa():
    erro = KeyError("x")

    def falha():
        raise erro
    assert em_paralelo_cada(lambda: 1, falha) == [(1, None), (None, erro)]


def test_sem_tarefas_e_com_uma_tarefa():
    assert em_paralelo() == [] and em_paralelo_cada() == []
    assert em_paralelo(lambda: threading.current_thread().name) == [threading.current_thread().name]


def test_pode_ser_usado_dentro_de_outra_tarefa_sem_travar():
    assert em_paralelo(lambda: em_paralelo(lambda: 1, lambda: 2), lambda: 3) == [[1, 2], 3]
