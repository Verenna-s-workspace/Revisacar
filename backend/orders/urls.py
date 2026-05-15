from django.urls import path
from . import views

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

    # Upload avulso e listagem
    path("upload", views.upload_avulso),
    path("list", views.list_files),
]