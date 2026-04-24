import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from dotenv import load_dotenv
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Optional
import uuid
import re
from datetime import datetime

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Env não carregou")

supabase = create_client(supabase_url, supabase_key)

BUCKET = "baldeuuid"

app = FastAPI(
    title="RevisaCar API",
    version="4.0.0",
    description="Sistema profissional de ordens de serviço e inspeção veicular.",
)

# ── CORS ───────────────────────────────────────────────────────────────────────

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://bucket-funcionando1.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CONFIG ────────────────────────────────────────────────────────────────────

MAX_FOTO_SIZE_BYTES = 5 * 1024 * 1024
MAX_FOTOS = 30

# ── MODELS ────────────────────────────────────────────────────────────────────

class OSHeader(BaseModel):
    os_num: str
    os_date: str
    os_time: str
    os_km: str = ""

    @field_validator("os_num")
    @classmethod
    def os_num_not_empty(cls, v: str):
        if not v.strip():
            raise ValueError("os_num não pode ser vazio")
        return v.strip()

    @field_validator("os_date")
    @classmethod
    def valid_date(cls, v: str):
        if v and not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("os_date inválido")
        return v

    @field_validator("os_time")
    @classmethod
    def valid_time(cls, v: str):
        if v and not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("os_time inválido")
        return v


class Cliente(BaseModel):
    nome: str
    doc: str = ""
    tel: str
    email: str = ""

    @field_validator("nome", "tel")
    @classmethod
    def not_empty(cls, v: str):
        if not v.strip():
            raise ValueError("Campo obrigatório")
        return v.strip()


class Veiculo(BaseModel):
    placa: str
    modelo: str
    ano: str = ""
    cor: str = ""
    combustivel: str = ""
    nivel_combustivel: str = ""
    chassi: str = ""
    obs_entrada: str = ""

    @field_validator("placa", "modelo")
    @classmethod
    def not_empty(cls, v: str):
        if not v.strip():
            raise ValueError("Campo obrigatório")
        return v.strip()

    @field_validator("placa")
    @classmethod
    def valid_placa(cls, v: str):
        v = v.upper().strip()
        if not re.match(r"^[A-Z]{3}[-]?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$", v):
            raise ValueError("Placa inválida")
        return v


class ChecklistItem(BaseModel):
    status: Optional[str] = None
    obs: str = ""


class Tecnico(BaseModel):
    nome: str = ""
    registro: str = ""
    data_saida: str = ""
    hora_saida: str = ""
    km_saida: str = ""
    parecer_geral: str = ""


class OrdemServico(BaseModel):
    os_header: OSHeader
    cliente: Cliente
    veiculo: Veiculo
    servicos_selecionados: list[str] = []
    checklist: dict[str, ChecklistItem] = {}
    fotos_base64: list[str] = []
    fotos_paths: list[str] = []
    tecnico: Optional[Tecnico] = None
    status: str = "rascunho"

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "online"}


@app.post("/ordens", status_code=201)
def criar_ordem(ordem: OrdemServico):
    ordem_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    data = {
        "id": ordem_id,
        "created_at": now,
        "updated_at": now,
        "os_num": ordem.os_header.os_num,
        "placa": ordem.veiculo.placa,
        "modelo": ordem.veiculo.modelo,
        "cliente": ordem.cliente.nome,
        "status": ordem.status,
        "fotos_paths": ordem.fotos_paths,
        "payload": ordem.model_dump(),
    }

    supabase.table("ordens").insert(data).execute()

    return data


@app.get("/ordens")
def listar_ordens(status: Optional[str] = None):
    query = supabase.table("ordens").select("*").order("created_at", desc=True)

    if status:
        query = query.eq("status", status)

    res = query.execute()
    return res.data


@app.get("/ordens/{ordem_id}")
def obter_ordem(ordem_id: str):
    res = supabase.table("ordens").select("*").eq("id", ordem_id).execute()

    if not res.data:
        raise HTTPException(404, "Não encontrada")

    return res.data[0]


@app.put("/ordens/{ordem_id}")
def atualizar_ordem(ordem_id: str, ordem: OrdemServico):
    now = datetime.now().isoformat()

    existing = supabase.table("ordens").select("fotos_paths").eq("id", ordem_id).execute()
    existing_paths = existing.data[0].get("fotos_paths", []) if existing.data else []

    update = {
        "updated_at": now,
        "os_num": ordem.os_header.os_num,
        "placa": ordem.veiculo.placa,
        "modelo": ordem.veiculo.modelo,
        "cliente": ordem.cliente.nome,
        "status": ordem.status,
        "fotos_paths": existing_paths,
        "payload": ordem.model_dump(),
    }

    res = supabase.table("ordens").update(update).eq("id", ordem_id).execute()

    if not res.data:
        raise HTTPException(404, "Não encontrada")

    return res.data[0]


@app.post("/ordens/{ordem_id}/fotos")
async def upload_fotos_ordem(ordem_id: str, files: list[UploadFile] = File(...)):

    res = supabase.table("ordens").select("*").eq("id", ordem_id).execute()
    if not res.data:
        raise HTTPException(404, "Ordem não encontrada")

    existing_paths = res.data[0].get("fotos_paths", []) or []

    new_paths = []
    for file in files:
        if not file.filename or len(file.filename.split(".")) < 2:
            raise HTTPException(400, f"Arquivo {file.filename} sem extensão válida")

        extension = file.filename.split(".")[-1]
        unique_name = f"{ordem_id}/{uuid.uuid4()}.{extension}"
        contents = await file.read()

        if len(contents) > MAX_FOTO_SIZE_BYTES:
            raise HTTPException(413, f"Arquivo {file.filename} muito grande (máx {MAX_FOTO_SIZE_BYTES} bytes)")

        supabase.storage.from_(BUCKET).upload(unique_name, contents)
        new_paths.append(unique_name)

    all_paths = list(set(existing_paths + new_paths))

    now = datetime.now().isoformat()
    supabase.table("ordens").update({
        "fotos_paths": all_paths,
        "updated_at": now
    }).eq("id", ordem_id).execute()

    return {"paths": all_paths}


@app.delete("/ordens/{ordem_id}/fotos/{foto_path:path}")
def delete_foto(ordem_id: str, foto_path: str):
    """Delete a specific photo from the order"""
    import urllib.parse
    foto_path = urllib.parse.unquote(foto_path)
    
    res = supabase.table("ordens").select("fotos_paths").eq("id", ordem_id).execute()
    if not res.data:
        raise HTTPException(404, "Ordem não encontrada")
    
    existing_paths = res.data[0].get("fotos_paths", []) or []
    
    if foto_path not in existing_paths:
        raise HTTPException(404, "Foto não encontrada")
    
    try:
        supabase.storage.from_(BUCKET).remove([foto_path])
    except Exception as e:
        print(f"Erro ao deletar do storage: {e}")
    
    new_paths = [p for p in existing_paths if p != foto_path]
    now = datetime.now().isoformat()
    supabase.table("ordens").update({
        "fotos_paths": new_paths,
        "updated_at": now
    }).eq("id", ordem_id).execute()
    
    return {"message": "Foto deletada", "paths": new_paths}


@app.patch("/ordens/{ordem_id}/status")
def atualizar_status(ordem_id: str, status: str):
    now = datetime.now().isoformat()

    res = supabase.table("ordens").update({
        "status": status,
        "updated_at": now
    }).eq("id", ordem_id).execute()

    if not res.data:
        raise HTTPException(404, "Não encontrada")

    return res.data[0]


@app.delete("/ordens/{ordem_id}")
def deletar_ordem(ordem_id: str):

    res = supabase.table("ordens").select("id").eq("id", ordem_id).execute()

    if not res.data:
        raise HTTPException(404, "Não encontrada")

    files = supabase.storage.from_(BUCKET).list(path=ordem_id)

    paths = []
    for file in files:
        paths.append(f"{ordem_id}/{file['name']}")

    if paths:
        supabase.storage.from_(BUCKET).remove(paths)

    supabase.table("ordens").delete().eq("id", ordem_id).execute()

    return {"message": "Deletada"}

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    contents = await file.read()

    extension = file.filename.split(".")[-1]

    unique_name = f"{uuid.uuid4()}.{extension}"
    file_path = f"{unique_name}"

    response = supabase.storage.from_(BUCKET).upload(
        file_path,
        contents
    )

    return {
        "path": file_path,
        "status": str(response)
    }

@app.get("/list")
def list_files():
    files = supabase.storage.from_(BUCKET).list()
    return {"files": files}

@app.get("/fotos/{path:path}")
def get_foto(path: str):
    try:
        file_data = supabase.storage.from_(BUCKET).download(path)
        if file_data is None:
            raise HTTPException(404, "Foto não encontrada")
        
        import base64
        encoded = base64.b64encode(file_data).decode('utf-8')
        return {"data": encoded, "filename": path}
    except Exception as e:
        raise HTTPException(500, f"Erro ao baixar foto: {str(e)}")