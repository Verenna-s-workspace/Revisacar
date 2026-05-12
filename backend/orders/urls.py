from django.urls import path
from . import views

urlpatterns = [
    # Root
    path("", views.root),

    # Ordens CRUD
    path("orders", views.ordens_list),
    path("orders/<str:ordem_id>", views.ordem_detail),
    path("orders/<str:ordem_id>/status", views.ordem_status),

    # Fotos de uma ordem
    path("orders/<str:ordem_id>/fotos", views.upload_fotos),
    path("orders/<str:ordem_id>/fotos/<path:foto_path>", views.delete_foto),

    # Foto avulsa por path
    path("fotos/<path:path>", views.get_foto),

    # Upload avulso e listagem
    path("upload", views.upload_avulso),
    path("list", views.list_files),
]