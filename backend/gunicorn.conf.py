"""
Configuração do gunicorn em produção (Render). O gunicorn lê este arquivo sozinho quando é iniciado
dentro de backend/ (o comando no Render é `gunicorn DjangoSet.wsgi`), sem precisar mudar o painel.

Por quê: sem configuração o gunicorn sobe 1 processo que atende UMA requisição por vez. Cada tela do
painel dispara de 5 a 10 chamadas juntas, que ficavam numa fila — medido em 30/10/2026: 8 chamadas
simultâneas levavam de 0,97 s a 4,75 s, uma atrás da outra. Quase todo o tempo de cada chamada é
esperando o Supabase responder (rede), então threads resolvem: enquanto uma espera, outra trabalha.

Ajustável por variável de ambiente no Render, sem novo deploy de código:
  WEB_CONCURRENCY   processos (padrão 2; o plano gratuito tem 512 MB)
  GUNICORN_THREADS  threads por processo (padrão 8)
  GUNICORN_TIMEOUT  segundos até matar uma requisição travada (padrão 60)
Opções passadas no próprio comando do Render (ex.: --workers) têm prioridade sobre este arquivo.
"""
import os

workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", "8"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))
graceful_timeout = 30
# Reaproveita a conexão do navegador entre chamadas seguidas (menos apertos de mão TLS no proxy).
keepalive = 5
# Recicla cada processo de tempos em tempos (protege contra vazamento de memória no plano de 512 MB).
max_requests = 1000
max_requests_jitter = 100
accesslog = "-"
# Tempo de cada requisição em ms no log do Render (%(M)s), pra ver o que está lento.
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(M)sms'
