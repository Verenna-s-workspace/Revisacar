"""
Customer API views.
All endpoints are under /api/customer/
JWT token is required for all except auth endpoints.
"""
from __future__ import annotations
import jwt as pyjwt
from datetime import datetime, timedelta
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication

from .serializers import (
    CustomerRegisterSerializer, CustomerLoginSerializer,
    ChangePasswordSerializer, ForgotPasswordSerializer,
    CustomerProfileSerializer, VehicleSerializer, VehicleUpdateSerializer,
    AppointmentCreateSerializer, EstimateActionSerializer,
    AvailableMonthSerializer, NotificationSerializer,
    pw_hash, pw_check, new_id, now_iso,
)
from . import services


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_customer_id(request) -> str:
    """Extract customer_id from JWT token payload."""
    return request.user.username  # stored as username in simplejwt


def _make_tokens(customer_id: str, name: str) -> dict:
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    # We embed customer_id + name as extra claims
    refresh = RT()
    refresh["customer_id"] = customer_id
    refresh["name"] = name
    refresh["user_id"] = customer_id  # for JWTAuthentication user identification
    # Override subject (sub) claim
    refresh.payload["sub"] = customer_id
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "customer_id": customer_id,
        "name": name,
    }


class _FakeUser:
    """Minimal user object for request.user when using raw JWT."""
    def __init__(self, customer_id: str, name: str):
        self.username = customer_id
        self.name = name
        self.is_authenticated = True
        self.is_anonymous = False


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom authentication that returns a simple user object based on the token,
    avoiding a database lookup for the User model.
    """
    def get_user(self, validated_token):
        try:
            user_id = validated_token.get("user_id")
        except KeyError:
            raise InvalidToken(_("Token contained no recognizable user identification"))

        # Create a simple user-like object
        class User:
            def __init__(self, user_id):
                self.id = user_id
                # Use customer_id as username for compatibility with _get_customer_id
                self.username = user_id
                self.is_authenticated = True
                self.is_anonymous = False

        return User(user_id)


def _decode_bearer(request):
    """Decode Bearer JWT and return customer dict or None."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        cid = payload.get("customer_id") or payload.get("sub")
        return {"id": cid, "name": payload.get("name", "")}
    except Exception:
        return None


def _require_auth(request):
    """Returns (customer_dict, None) or (None, Response 401)."""
    c = _decode_bearer(request)
    if not c or not c.get("id"):
        return None, Response({"detail": "Não autenticado"}, status=status.HTTP_401_UNAUTHORIZED)
    return c, None


# ════════════════════════════════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """POST /api/customer/auth/register"""
    s = CustomerRegisterSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    d = s.validated_data
    if services.get_customer_by_email(d["email"]):
        return Response({"detail": "E-mail já cadastrado"}, status=status.HTTP_409_CONFLICT)

    cid = new_id()
    customer = services.create_customer({
        "id": cid,
        "name": d["name"],
        "email": d["email"],
        "phone": d["phone"],
        "pwhash": pw_hash(d["password"]),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    if not customer:
        return Response({"detail": "Erro ao criar conta"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    tokens = _make_tokens(customer["id"], customer["name"])
    return Response({**tokens, "customer": {
        "id": customer["id"],
        "name": customer["name"],
        "email": customer["email"]
    }}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """POST /api/customer/auth/login"""
    s = CustomerLoginSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    d = s.validated_data
    customer = services.get_customer_by_email(d["email"])
    if not customer or not pw_check(d["password"], customer.get("pwhash", "")):
        return Response({"detail": "E-mail ou senha incorretos"}, status=status.HTTP_401_UNAUTHORIZED)

    tokens = _make_tokens(customer["id"], customer["name"])
    return Response({
        **tokens,
        "customer": {"id": customer["id"], "name": customer["name"], "email": customer["email"]},
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def token_refresh(request):
    """POST /api/customer/auth/refresh"""
    refresh_token = request.data.get("refresh")
    if not refresh_token:
        return Response({"detail": "refresh token obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        from rest_framework_simplejwt.tokens import RefreshToken as RT
        token = RT(refresh_token)
        return Response({"access": str(token.access_token)})
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    """POST /api/customer/auth/forgot-password"""
    s = ForgotPasswordSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
    # Always return success to prevent email enumeration
    return Response({"detail": "Se o e-mail existir, você receberá as instruções."})


@api_view(["POST"])
@permission_classes([AllowAny])
def pin_login(request):
    """POST /api/customer/auth/pin-login - Login with document and 6-digit PIN"""
    s = CustomerPinLoginSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    d = s.validated_data
    documento = d["documento"]
    pincode = d["pincode"]

    # Find client by documento (CPF/CNPJ)
    customer = services.get_customer_by_document(documento)
    if not customer or not pw_check(pincode, customer.get("pincode", "")):
        return Response({"detail": "Documento ou PIN incorretos"},
                       status=status.HTTP_401_UNAUTHORIZED)

    tokens = _make_tokens(customer["id"], customer["name"])
    return Response({
        **tokens,
        "customer": {"id": customer["id"], "name": customer["name"], "email": customer["email"]},
    })


@api_view(["POST"])
@authentication_classes([CustomJWTAuthentication])
@permission_classes([IsAuthenticated])
def mechanic_create_client(request):
    """POST /api/customer/mechanic/clients"""
    # Verify user is a mechanic
    user_id = _get_customer_id(request)
    funcionario = services.get_funcionario_by_id(user_id)
    if not funcionario or funcionario.get('cargo') != 'mecanico':
        return Response({"detail": "Acesso negado"}, status=status.HTTP_403_FORBIDDEN)

    s = MechanicClientCreateSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    d = s.validated_data

    if services.get_customer_by_email(d["email"]):
        return Response({"detail": "E-mail já cadastrado"}, status=status.HTTP_409_CONFLICT)

    cid = new_id()
    customer = services.create_customer({
        "id": cid,
        "name": d["name"],
        "email": d["email"],
        "phone": d["phone"],
        "cpf": d["document"],
        "pincode": pw_hash(d["pincode"]),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })

    if not customer:
        return Response({"detail": "Erro ao criar cliente"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({
        "id": customer["id"],
        "name": customer["name"],
        "email": customer["email"],
        "phone": customer.get("phone", ""),
    }, status=status.HTTP_201_CREATED)


# ════════════════════════════════════════════════════════════════════════════════
# PROFILE
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET", "PUT", "PATCH"])
def profile(request):
    """GET/PUT/PATCH /api/customer/me"""
    c, err = _require_auth(request)
    if err:
        return err

    customer = services.get_customer_by_id(c["id"])
    if not customer:
        return Response({"detail": "Cliente não encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response({
            "id": customer["id"],
            "name": customer["name"],
            "email": customer["email"],
            "phone": customer.get("phone", ""),
            "cpf": customer.get("cpf", ""),
            "address": customer.get("address", ""),
            "avatar_url": customer.get("avatar_url"),
            "created_at": customer.get("created_at"),
        })

    s = CustomerProfileSerializer(data=request.data, partial=True)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    updated = services.update_customer(c["id"], {**s.validated_data, "updated_at": now_iso()})
    return Response(updated)


@api_view(["POST"])
def change_password(request):
    """POST /api/customer/me/change-password"""
    c, err = _require_auth(request)
    if err:
        return err

    s = ChangePasswordSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    customer = services.get_customer_by_id(c["id"])
    if not pw_check(s.validated_data["old_password"], customer.get("pwhash", "")):
        return Response({"detail": "Senha atual incorreta"}, status=status.HTTP_400_BAD_REQUEST)

    services.update_customer(c["id"], {
        "pwhash": pw_hash(s.validated_data["new_password"]),
        "updated_at": now_iso(),
    })
    return Response({"detail": "Senha alterada com sucesso"})


# ════════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
def dashboard(request):
    """GET /api/customer/dashboard"""
    c, err = _require_auth(request)
    if err:
        return err
    summary = services.get_dashboard_summary(c["id"])
    return Response(summary)


# ════════════════════════════════════════════════════════════════════════════════
# VEHICLES
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET", "POST"])
@authentication_classes([CustomJWTAuthentication])
def vehicles_list(request):
    """GET/POST /api/customer/vehicles"""
    c, err = _require_auth(request)
    if err:
        return err

    if request.method == "GET":
        return Response(services.list_vehicles(c["id"]))

    s = VehicleSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    d = s.validated_data
    vid = new_id()
    vehicle = services.create_vehicle({
        "id": vid,
        "customer_id": c["id"],
        "deleted": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        **d,
    })
    return Response(vehicle, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def vehicle_detail(request, vehicle_id: str):
    """GET/PUT/PATCH/DELETE /api/customer/vehicles/<id>"""
    c, err = _require_auth(request)
    if err:
        return err

    vehicle = services.get_vehicle(vehicle_id, c["id"])
    if not vehicle:
        return Response({"detail": "Veículo não encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(vehicle)

    if request.method == "DELETE":
        services.soft_delete_vehicle(vehicle_id, c["id"])
        return Response({"detail": "Veículo removido"})

    s = VehicleUpdateSerializer(data=request.data, partial=True)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    updated = services.update_vehicle(vehicle_id, c["id"], {**s.validated_data, "updated_at": now_iso()})
    return Response(updated)


# ════════════════════════════════════════════════════════════════════════════════
# APPOINTMENTS
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET", "POST"])
def appointments_list(request):
    """GET/POST /api/customer/appointments"""
    c, err = _require_auth(request)
    if err:
        return err

    if request.method == "GET":
        status_filter = request.query_params.get("status")
        return Response(services.list_appointments(c["id"], status=status_filter))

    s = AppointmentCreateSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    d = s.validated_data

    # Verify vehicle belongs to customer
    vehicle = services.get_vehicle(d["vehicle_id"], c["id"])
    if not vehicle:
        return Response({"detail": "Veículo não encontrado"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        appt = services.create_appointment({
            "id": new_id(),
            "customer_id": c["id"],
            "vehicle_id": d["vehicle_id"],
            "vehicle_label": f"{vehicle['brand']} {vehicle['model']} {vehicle['year']} — {vehicle['plate']}",
            "service_type": d["service_type"],
            "service_description": d.get("service_description", ""),
            "date": str(d["date"]),
            "time_slot": str(d["time_slot"]),
            "status": "pendente",
            "notes": d.get("notes", ""),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        return Response(appt, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "DELETE"])
def appointment_detail(request, appointment_id: str):
    """GET/DELETE /api/customer/appointments/<id>"""
    c, err = _require_auth(request)
    if err:
        return err

    appt = services.get_appointment(appointment_id, c["id"])
    if not appt:
        return Response({"detail": "Agendamento não encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(appt)

    cancelled = services.cancel_appointment(appointment_id, c["id"])
    if not cancelled:
        return Response({"detail": "Não foi possível cancelar"}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "Agendamento cancelado"})


# ════════════════════════════════════════════════════════════════════════════════
# AVAILABILITY
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def available_days(request):
    """GET /api/customer/availability?year=2026&month=6"""
    year = int(request.query_params.get("year", datetime.today().year))
    month = int(request.query_params.get("month", datetime.today().month))
    slots = services.get_available_slots(year, month)
    available_dates = list({s["date"] for s in slots})
    return Response({"year": year, "month": month, "available_dates": sorted(available_dates)})


@api_view(["GET"])
@permission_classes([AllowAny])
def available_times(request):
    """GET /api/customer/availability/times?date=2026-06-20"""
    date_str = request.query_params.get("date")
    if not date_str:
        return Response({"detail": "Parâmetro date obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
    slots = services.get_available_times(date_str)
    times = [s["time_slot"] for s in slots]
    return Response({"date": date_str, "times": times})


# ════════════════════════════════════════════════════════════════════════════════
# ESTIMATES
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
def estimates_list(request):
    """GET /api/customer/estimates?status=pendente"""
    c, err = _require_auth(request)
    if err:
        return err
    status_filter = request.query_params.get("status")
    return Response(services.list_estimates(c["id"], status=status_filter))


@api_view(["GET", "POST"])
def estimate_detail(request, estimate_id: str):
    """GET /api/customer/estimates/<id>  POST to approve/reject"""
    c, err = _require_auth(request)
    if err:
        return err

    estimate = services.get_estimate(estimate_id, c["id"])
    if not estimate:
        return Response({"detail": "Orçamento não encontrado"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(estimate)

    s = EstimateActionSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    if estimate.get("status") != "pendente":
        return Response({"detail": "Orçamento não está pendente"}, status=status.HTTP_400_BAD_REQUEST)

    new_status = "aprovado" if s.validated_data["action"] == "aprovar" else "rejeitado"
    updated = services.update_estimate_status(
        estimate_id, c["id"], new_status, s.validated_data.get("comment", "")
    )
    return Response(updated)


# ════════════════════════════════════════════════════════════════════════════════
# SERVICE HISTORY
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
def history_list(request):
    """GET /api/customer/history?vehicle_id=<id>"""
    c, err = _require_auth(request)
    if err:
        return err
    vehicle_id = request.query_params.get("vehicle_id")
    return Response(services.list_service_history(c["id"], vehicle_id=vehicle_id))


@api_view(["GET"])
def history_detail(request, history_id: str):
    """GET /api/customer/history/<id>"""
    c, err = _require_auth(request)
    if err:
        return err
    item = services.get_service_history_item(history_id, c["id"])
    if not item:
        return Response({"detail": "Serviço não encontrado"}, status=status.HTTP_404_NOT_FOUND)
    return Response(item)


# ════════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
def notifications_list(request):
    """GET /api/customer/notifications?unread=true"""
    c, err = _require_auth(request)
    if err:
        return err
    unread_only = request.query_params.get("unread", "false").lower() == "true"
    return Response(services.list_notifications(c["id"], unread_only=unread_only))


@api_view(["POST"])
def notification_read(request, notification_id: str):
    """POST /api/customer/notifications/<id>/read"""
    c, err = _require_auth(request)
    if err:
        return err
    services.mark_notification_read(notification_id, c["id"])
    return Response({"detail": "Marcada como lida"})


@api_view(["POST"])
def notifications_read_all(request):
    """POST /api/customer/notifications/read-all"""
    c, err = _require_auth(request)
    if err:
        return err
    services.mark_all_notifications_read(c["id"])
    return Response({"detail": "Todas marcadas como lidas"})


# ════════════════════════════════════════════════════════════════════════════════
# REMINDERS
# ════════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
def reminders_list(request):
    """GET /api/customer/reminders"""
    c, err = _require_auth(request)
    if err:
        return err
    return Response(services.list_reminders(c["id"]))