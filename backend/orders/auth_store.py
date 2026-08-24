"""Persistência durável de sessões e rate-limiting de autenticação.

Antes, refresh tokens, tokens de reset de senha e contadores de tentativa de
PIN/reset viviam em dicionários na memória do processo (`views.py`). Isso quebra
em produção: ao reiniciar o servidor todos são deslogados e, com mais de uma
instância, uma não enxerga o estado da outra (o rate-limiting deixa de valer).

Aqui esse estado passa a morar em três tabelas no Supabase (ver
`db/migrations/0001_auth_persistence.sql`). Guardamos apenas o **hash SHA-256**
dos tokens — um vazamento do banco não expõe tokens utilizáveis.

O store é resiliente: se o banco estiver indisponível, leituras degradam para
"sem sessão"/"sem histórico" e escritas apenas logam o erro, sem derrubar o
fluxo de auth (que já depende do Supabase para o resto).
"""
import hashlib
import logging
import time

logger = logging.getLogger(__name__)

REFRESH_TABLE = "auth_refresh_tokens"
RESET_TABLE = "auth_reset_tokens"
RATE_TABLE = "auth_rate_limit"

KIND_PIN = "pin"
KIND_RESET_REQUEST = "reset_request"


def hash_token(token: str) -> str:
    """Hash determinístico do token para servir de chave/lookup no banco."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SupabaseAuthStore:
    """Store durável sobre o client Supabase compartilhado. Usa só operações
    simples (insert/select.eq/delete.eq/update.eq) e filtra janelas de tempo em
    Python — a cardinalidade por chave é mínima (um token, poucas tentativas)."""

    def __init__(self, supabase, *, now=time.time):
        self.sb = supabase
        self._now = now  # injetável nos testes

    # ── Refresh tokens ────────────────────────────────────────────────────────

    def save_refresh_token(self, token, *, tipo, expires_at, doc=None, funcionario_id=None, nome=None, email=None):
        row = {
            "token_hash": hash_token(token),
            "tipo": tipo,
            "doc": doc,
            "funcionario_id": funcionario_id,
            "nome": nome,
            "email": email,
            "expires_at": expires_at,
        }
        try:
            self.sb.table(REFRESH_TABLE).insert(row).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao salvar refresh token: %s", exc)

    def get_active_refresh(self, token):
        """Retorna a sessão ({tipo, doc, id, nome, email}) se o token existe e
        não expirou; caso contrário None (e remove o registro se expirado)."""
        try:
            res = self.sb.table(REFRESH_TABLE).select("*").eq("token_hash", hash_token(token)).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao ler refresh token: %s", exc)
            return None
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        if (row.get("expires_at") or 0) < self._now():
            self.delete_refresh_token(token)
            return None
        return {
            "tipo": row.get("tipo"),
            "doc": row.get("doc"),
            "id": row.get("funcionario_id"),
            "nome": row.get("nome"),
            "email": row.get("email"),
        }

    def delete_refresh_token(self, token):
        try:
            self.sb.table(REFRESH_TABLE).delete().eq("token_hash", hash_token(token)).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao invalidar refresh token: %s", exc)

    def delete_refresh_tokens_for_doc(self, doc):
        try:
            self.sb.table(REFRESH_TABLE).delete().eq("doc", doc).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao invalidar tokens do doc %s: %s", doc, exc)

    def delete_refresh_tokens_for_funcionario(self, funcionario_id):
        try:
            self.sb.table(REFRESH_TABLE).delete().eq("funcionario_id", funcionario_id).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao invalidar tokens do funcionário %s: %s", funcionario_id, exc)

    # ── Tokens de reset de senha ──────────────────────────────────────────────

    def save_reset_token(self, token, *, doc, email, expires_at):
        row = {
            "token_hash": hash_token(token),
            "doc": doc,
            "email": email,
            "expires_at": expires_at,
            "used": False,
        }
        try:
            self.sb.table(RESET_TABLE).insert(row).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao salvar reset token: %s", exc)

    def get_valid_reset_token(self, token):
        """Retorna {doc, email} se o token existe, não foi usado e não expirou."""
        try:
            res = self.sb.table(RESET_TABLE).select("*").eq("token_hash", hash_token(token)).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao ler reset token: %s", exc)
            return None
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        if row.get("used") or (row.get("expires_at") or 0) < self._now():
            return None
        return {"doc": row.get("doc"), "email": row.get("email")}

    def mark_reset_token_used(self, token):
        try:
            self.sb.table(RESET_TABLE).update({"used": True}).eq("token_hash", hash_token(token)).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao marcar reset token usado: %s", exc)

    # ── Rate limiting (PIN e pedidos de reset) ────────────────────────────────

    def _recent(self, bucket, kind, window_seconds):
        """Timestamps do bucket dentro da janela, mais recentes primeiro."""
        try:
            res = self.sb.table(RATE_TABLE).select("*").eq("bucket", bucket).eq("kind", kind).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao ler rate limit (%s/%s): %s", kind, bucket, exc)
            return None  # sinaliza erro -> chamador decide fail-open
        cutoff = self._now() - window_seconds
        ts = [r["created_at"] for r in (res.data or []) if (r.get("created_at") or 0) > cutoff]
        return sorted(ts, reverse=True)

    def _record(self, bucket, kind):
        try:
            self.sb.table(RATE_TABLE).insert({"bucket": bucket, "kind": kind, "created_at": self._now()}).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao registrar tentativa (%s/%s): %s", kind, bucket, exc)

    def _clear(self, bucket, kind):
        try:
            self.sb.table(RATE_TABLE).delete().eq("bucket", bucket).eq("kind", kind).execute()
        except Exception as exc:
            logger.error("[auth_store] falha ao limpar rate limit (%s/%s): %s", kind, bucket, exc)

    def pin_attempt_allowed(self, funcionario_id, *, max_attempts, window_seconds):
        recent = self._recent(funcionario_id, KIND_PIN, window_seconds)
        if recent is None:
            return True  # fail-open: o próprio login já exige o banco de qualquer forma
        return len(recent) < max_attempts

    def record_pin_attempt(self, funcionario_id):
        self._record(funcionario_id, KIND_PIN)

    def clear_pin_attempts(self, funcionario_id):
        self._clear(funcionario_id, KIND_PIN)

    def can_request_password_reset(self, email, *, max_requests, window_seconds, min_interval_seconds):
        recent = self._recent(email, KIND_RESET_REQUEST, window_seconds)
        if recent is None:
            return True  # fail-open sob indisponibilidade do banco
        now = self._now()
        if recent and (len(recent) >= max_requests or now - recent[0] < min_interval_seconds):
            return False
        self._record(email, KIND_RESET_REQUEST)
        return True
