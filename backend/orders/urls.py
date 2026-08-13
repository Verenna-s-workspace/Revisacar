from django.urls import path
from . import views
from . import financeiro_views

urlpatterns = [
    # Root
    path("", views.root),

    # Ordens CRUD
    path("ordens", views.ordens_list),
    path("ordens/<str:ordem_id>", views.ordem_detail),
    path("ordens/<str:ordem_id>/status", views.ordem_status),

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

    # Upload avulso e listagem
    path("upload", views.upload_avulso),
    path("list", views.list_files),
]