from django.urls import path
from . import views
from . import financeiro_views
from . import estoque_views
from . import servicos_views
from . import relatorios_views
from . import visao_geral_views
from . import alertas_views, fechamento_views, orcamento_link_views, orcamento_views

urlpatterns = [
    # Root
    path("", views.root),

    # Ordens CRUD
    path("ordens", views.ordens_list),
    path("ordens/<str:ordem_id>", views.ordem_detail),
    path("ordens/<str:ordem_id>/status", views.ordem_status),
    path("ordens/<str:ordem_id>/cliente-avisado", alertas_views.ordem_cliente_avisado),
    path("ordens/<str:ordem_id>/concluir", fechamento_views.ordem_concluir),
    path("ordens/<str:ordem_id>/fechamento", fechamento_views.fechamento),

    # Orçamento da OS (versões + itens) — ordens.ver / ordens.editar; custo e margem: financeiro.ver_margem
    path("ordens/<str:ordem_id>/orcamentos", orcamento_views.orcamentos_da_ordem),
    path("orcamentos/<str:orcamento_id>", orcamento_views.orcamento_detail),
    path("orcamentos/<str:orcamento_id>/enviar", orcamento_views.orcamento_enviar),
    path("orcamentos/<str:orcamento_id>/aprovar", orcamento_views.orcamento_aprovar),
    path("orcamentos/<str:orcamento_id>/recusar", orcamento_views.orcamento_recusar),
    path("orcamentos/<str:orcamento_id>/pdf", orcamento_views.orcamento_pdf_view),
    # Link público do orçamento: a oficina gera/vê/revoga (login); o cliente abre sem conta (token na URL)
    path("orcamentos/<str:orcamento_id>/link", orcamento_link_views.orcamento_link),
    path("publico/orcamentos/<str:token>", orcamento_link_views.publico_orcamento),
    path("publico/orcamentos/<str:token>/pdf", orcamento_link_views.publico_orcamento_pdf),
    path("publico/orcamentos/<str:token>/aprovar", orcamento_link_views.publico_orcamento_aprovar),
    path("publico/orcamentos/<str:token>/recusar", orcamento_link_views.publico_orcamento_recusar),

    # Fotos de uma ordem
    path("ordens/<str:ordem_id>/fotos", views.upload_fotos),
    path("ordens/<str:ordem_id>/fotos/<path:foto_path>", views.delete_foto),

    # Foto avulsa por path
    path("fotos/<path:path>", views.get_foto),

    # Admin auth
    path("admin/signup", views.admin_signup),
    path("admin/login", views.admin_login),
    path("admin/refresh", views.admin_refresh),
    path("admin/logout", views.admin_logout),
    path("admin/forgot-password", views.admin_forgot_password),
    path("admin/reset-password", views.admin_reset_password),

    # Funcionários (RBAC) — rotas específicas ANTES do catch-all
    # <funcionario_id>, senão "publicos"/"login-pin"/etc. seriam
    # interpretados como um id.
    path("funcionarios", views.funcionarios_list),
    path("funcionarios/signup", views.funcionario_signup),
    path("funcionarios/publicos", views.funcionarios_publicos),
    path("funcionarios/login-pin", views.funcionario_login_pin),
    path("funcionarios/forgot-pin", views.funcionario_forgot_pin),
    path("funcionarios/<str:funcionario_id>", views.funcionario_detail),

    # Sessão atual (dono ou funcionário)
    path("me", views.me),

    # Financeiro — protegido por financeiro.ver / financeiro.editar / financeiro.ver_margem
    path("financeiro/categorias", financeiro_views.categorias),
    path("financeiro/resumo", financeiro_views.resumo),
    path("financeiro/transacoes", financeiro_views.transacoes),
    path("financeiro/transacoes/<str:transacao_id>", financeiro_views.transacao_detail),

    # Estoque — protegido por estoque.ver / estoque.editar.
    # "estoque/movimentos" ANTES de "estoque/<item_id>", senão "movimentos"
    # seria interpretado como um id.
    path("estoque", estoque_views.estoque_list),
    path("estoque/movimentos", estoque_views.movimentos_list),
    path("estoque/<str:item_id>", estoque_views.estoque_detail),

    # Kits de estoque (receitas) — aplicar dá baixa em todos os componentes
    path("kits", estoque_views.kits_list),
    path("kits/<str:kit_id>", estoque_views.kit_detail),
    path("kits/<str:kit_id>/aplicar", estoque_views.kit_aplicar),

    # Catálogo de serviços — protegido por servicos.ver / servicos.editar
    path("servicos", servicos_views.servicos_list),
    path("servicos/<str:servico_id>", servicos_views.servico_detail),

    # Relatórios — protegido por relatorios.ver (dono e gerente)
    path("relatorios", relatorios_views.relatorios),

    # Alertas — cada bloco exige a própria permissão (ver alertas_views)
    path("alertas", alertas_views.alertas),
    path("alertas/dispensados/limpar", alertas_views.alertas_dispensados_limpar),
    path("alertas/dispensados/<str:alerta_id>", alertas_views.alerta_dispensado),

    # Visão Geral — leitura p/ qualquer usuário logado (blocos de dinheiro só por permissão);
    # meta mensal: configuracoes.editar
    path("visao-geral", visao_geral_views.visao_geral),
    path("visao-geral/meta", visao_geral_views.meta_mensal),

    # Upload avulso e listagem
    path("upload", views.upload_avulso),
    path("list", views.list_files),
]