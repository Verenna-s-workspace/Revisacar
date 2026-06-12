import uuid
import base64
import urllib.parse
from datetime import datetime

from django.conf import settings
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status
from supabase import create_client

from .serializers import OrdemServicoSerializer, AdminSerializer, AdminLoginSerializer, pwhash, valhash

# ── Supabase client (singleton) ───────────────────────────────────────────────

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
BUCKET = settings.SUPABASE_BUCKET
MAX_FOTO_SIZE_BYTES = settings.MAX_FOTO_SIZE_BYTES


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now():
    return datetime.now().isoformat()


def _get_ordem_or_404(ordem_id: str):
    """Busca ordem no Supabase; retorna (row, None) ou (None, Response 404)."""
    res = supabase.table("ordens").select("*").eq("id", ordem_id).execute()
    if not res.data:
        return None, Response({"detail": "Não encontrada"}, status=status.HTTP_404_NOT_FOUND)
    return res.data[0], None


def _get_admin_by_doc(doc: str):
    res = supabase.table("admins").select("*").eq("doc", doc).limit(1).execute()
    return res.data[0] if res.data else None


# ── Root ──────────────────────────────────────────────────────────────────────

@api_view(["GET"])
def root(request):
    return Response({"status": "online"})

@api_view(["POST"])
def admin_signup(request):
    serializer = AdminSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    dados = serializer.validated_data
    if _get_admin_by_doc(dados["doc"]):
        return Response({"detail": "CNPJ já cadastrado"}, status=status.HTTP_409_CONFLICT)

    supabase.table("admins").insert({
        "nome": dados["nome"],
        "doc": dados["doc"],
        "pwhash": pwhash(dados["senha"]),
        "created_at": _now(),
    }).execute()

    return Response({"nome": dados["nome"], "doc": dados["doc"]}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def admin_login(request):
    serializer = AdminLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    dados = serializer.validated_data
    admin = _get_admin_by_doc(dados["doc"])
    if not admin or not valhash(dados["senha"], admin.get("pwhash", "")):
        return Response({"detail": "Doc ou senha incorretos"}, status=status.HTTP_401_UNAUTHORIZED)

    return Response({"nome": admin["nome"], "doc": admin["doc"]})

# ── Ordens ────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
def ordens_list(request):
    """
    GET  /ordens        → lista ordens (filtrável por ?status=)
    POST /ordens        → cria nova ordem
    """
    if request.method == "GET":
        query = supabase.table("ordens").select("*").order("created_at", desc=True)
        status_filter = request.query_params.get("status")
        if status_filter:
            query = query.eq("status", status_filter)
        res = query.execute()
        return Response(res.data)

    # POST
    serializer = OrdemServicoSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    ordem = serializer.validated_data
    ordem_id = str(uuid.uuid4())
    now = _now()

    data = {
        "id": ordem_id,
        "created_at": now,
        "updated_at": now,
        "os_num": ordem["os_header"]["os_num"],
        "placa": ordem["veiculo"]["placa"],
        "modelo": ordem["veiculo"]["modelo"],
        "cliente": ordem["cliente"]["nome"],
        "status": ordem["status"],
        "fotos_paths": ordem.get("fotos_paths", []),
        "payload": serializer.data,
    }

    supabase.table("ordens").insert(data).execute()
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def ordem_detail(request, ordem_id):
    """
    GET    /ordens/<id>  → detalhe
    PUT    /ordens/<id>  → atualiza
    DELETE /ordens/<id>  → remove
    """
    if request.method == "GET":
        row, err = _get_ordem_or_404(ordem_id)
        if err:
            return err
        return Response(row)

    if request.method == "PUT":
        serializer = OrdemServicoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Preserva fotos já existentes
        existing = supabase.table("ordens").select("fotos_paths").eq("id", ordem_id).execute()
        existing_paths = existing.data[0].get("fotos_paths", []) if existing.data else []

        ordem = serializer.validated_data
        update = {
            "updated_at": _now(),
            "os_num": ordem["os_header"]["os_num"],
            "placa": ordem["veiculo"]["placa"],
            "modelo": ordem["veiculo"]["modelo"],
            "cliente": ordem["cliente"]["nome"],
            "status": ordem["status"],
            "fotos_paths": existing_paths,
            "payload": serializer.data,
        }

        res = supabase.table("ordens").update(update).eq("id", ordem_id).execute()
        if not res.data:
            return Response({"detail": "Não encontrada"}, status=status.HTTP_404_NOT_FOUND)
        return Response(res.data[0])

    # DELETE
    row, err = _get_ordem_or_404(ordem_id)
    if err:
        return err

    # Remove arquivos do storage antes de deletar a linha
    files = supabase.storage.from_(BUCKET).list(path=ordem_id)
    paths = [f"{ordem_id}/{f['name']}" for f in files]
    if paths:
        supabase.storage.from_(BUCKET).remove(paths)

    supabase.table("ordens").delete().eq("id", ordem_id).execute()
    return Response({"message": "Deletada"})


@api_view(["PATCH"])
def ordem_status(request, ordem_id):
    """PATCH /ordens/<id>/status?status=<novo_status>"""
    novo_status = request.query_params.get("status") or request.data.get("status")
    if not novo_status:
        return Response({"detail": "Parâmetro 'status' obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

    res = supabase.table("ordens").update({
        "status": novo_status,
        "updated_at": _now(),
    }).eq("id", ordem_id).execute()

    if not res.data:
        return Response({"detail": "Não encontrada"}, status=status.HTTP_404_NOT_FOUND)
    return Response(res.data[0])


# ── Fotos ─────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@parser_classes([MultiPartParser])
def upload_fotos(request, ordem_id):
    """POST /ordens/<id>/fotos  — multipart/form-data, campo 'files'"""
    row, err = _get_ordem_or_404(ordem_id)
    if err:
        return err

    existing_paths = row.get("fotos_paths", []) or []
    files = request.FILES.getlist("files")

    if not files:
        return Response({"detail": "Nenhum arquivo enviado"}, status=status.HTTP_400_BAD_REQUEST)

    new_paths = []
    for file in files:
        name_parts = file.name.split(".")
        if len(name_parts) < 2:
            return Response(
                {"detail": f"Arquivo '{file.name}' sem extensão válida"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contents = file.read()
        if len(contents) > MAX_FOTO_SIZE_BYTES:
            return Response(
                {"detail": f"Arquivo '{file.name}' muito grande (máx {MAX_FOTO_SIZE_BYTES} bytes)"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        extension = name_parts[-1]
        unique_name = f"{ordem_id}/{uuid.uuid4()}.{extension}"
        supabase.storage.from_(BUCKET).upload(unique_name, contents)
        new_paths.append(unique_name)

    all_paths = list(set(existing_paths + new_paths))
    supabase.table("ordens").update({
        "fotos_paths": all_paths,
        "updated_at": _now(),
    }).eq("id", ordem_id).execute()

    return Response({"paths": all_paths})


@api_view(["DELETE"])
def delete_foto(request, ordem_id, foto_path):
    """DELETE /ordens/<id>/fotos/<foto_path>"""
    foto_path = urllib.parse.unquote(foto_path)

    res = supabase.table("ordens").select("fotos_paths").eq("id", ordem_id).execute()
    if not res.data:
        return Response({"detail": "Ordem não encontrada"}, status=status.HTTP_404_NOT_FOUND)

    existing_paths = res.data[0].get("fotos_paths", []) or []
    if foto_path not in existing_paths:
        return Response({"detail": "Foto não encontrada"}, status=status.HTTP_404_NOT_FOUND)

    try:
        supabase.storage.from_(BUCKET).remove([foto_path])
    except Exception as e:
        print(f"Erro ao deletar do storage: {e}")

    new_paths = [p for p in existing_paths if p != foto_path]
    supabase.table("ordens").update({
        "fotos_paths": new_paths,
        "updated_at": _now(),
    }).eq("id", ordem_id).execute()

    return Response({"message": "Foto deletada", "paths": new_paths})


@api_view(["GET"])
def get_foto(request, path):
    """GET /fotos/<path>  — retorna base64 da foto"""
    try:
        file_data = supabase.storage.from_(BUCKET).download(path)
        if file_data is None:
            return Response({"detail": "Foto não encontrada"}, status=status.HTTP_404_NOT_FOUND)
        encoded = base64.b64encode(file_data).decode("utf-8")
        return Response({"data": encoded, "filename": path})
    except Exception as e:
        return Response({"detail": f"Erro ao baixar foto: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Upload avulso / listagem ──────────────────────────────────────────────────

@api_view(["POST"])
@parser_classes([MultiPartParser])
def upload_avulso(request):
    """POST /upload  — upload simples sem associar a uma ordem"""
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "Arquivo não enviado"}, status=status.HTTP_400_BAD_REQUEST)

    extension = file.name.split(".")[-1]
    unique_name = f"{uuid.uuid4()}.{extension}"
    contents = file.read()

    response = supabase.storage.from_(BUCKET).upload(unique_name, contents)
    return Response({"path": unique_name, "status": str(response)})


@api_view(["GET"])
def list_files(request):
    """GET /list  — lista arquivos no bucket"""
    files = supabase.storage.from_(BUCKET).list()
    return Response({"files": files})