"""
Supabase service layer.
All Supabase table access goes through this module.
Tables required:
  customers, customer_vehicles, appointments,
  estimates, estimate_items, service_history,
  notifications, maintenance_reminders, availability_slots
"""
from __future__ import annotations
import os
from django.conf import settings
from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = settings.SUPABASE_URL
        key = settings.SUPABASE_KEY
        if not url or not key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_KEY not set")
        _client = create_client(url, key)
    return _client


# ── Customers ─────────────────────────────────────────────────────────────────

def get_customer_by_email(email: str):
    r = get_client().table("customers").select("*").eq("email", email).limit(1).execute()
    return r.data[0] if r.data else None


def get_customer_by_id(customer_id: str):
    r = get_client().table("customers").select("*").eq("id", customer_id).limit(1).execute()
    return r.data[0] if r.data else None


def create_customer(data: dict):
    r = get_client().table("customers").insert(data).execute()
    return r.data[0] if r.data else None


def update_customer(customer_id: str, data: dict):
    r = get_client().table("customers").update(data).eq("id", customer_id).execute()
    return r.data[0] if r.data else None


# ── Vehicles ──────────────────────────────────────────────────────────────────

def list_vehicles(customer_id: str):
    r = (
        get_client().table("customer_vehicles")
        .select("*")
        .eq("customer_id", customer_id)
        .eq("deleted", False)
        .order("created_at", desc=True)
        .execute()
    )
    return r.data or []


def get_vehicle(vehicle_id: str, customer_id: str):
    r = (
        get_client().table("customer_vehicles")
        .select("*")
        .eq("id", vehicle_id)
        .eq("customer_id", customer_id)
        .eq("deleted", False)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def create_vehicle(data: dict):
    r = get_client().table("customer_vehicles").insert(data).execute()
    return r.data[0] if r.data else None


def update_vehicle(vehicle_id: str, customer_id: str, data: dict):
    r = (
        get_client().table("customer_vehicles")
        .update(data)
        .eq("id", vehicle_id)
        .eq("customer_id", customer_id)
        .execute()
    )
    return r.data[0] if r.data else None


def soft_delete_vehicle(vehicle_id: str, customer_id: str):
    from .serializers import now_iso
    r = (
        get_client().table("customer_vehicles")
        .update({"deleted": True, "updated_at": now_iso()})
        .eq("id", vehicle_id)
        .eq("customer_id", customer_id)
        .execute()
    )
    return bool(r.data)


# ── Appointments ──────────────────────────────────────────────────────────────

def list_appointments(customer_id: str, status: str | None = None):
    q = (
        get_client().table("appointments")
        .select("*")
        .eq("customer_id", customer_id)
        .order("date", desc=True)
    )
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


def get_appointment(appointment_id: str, customer_id: str):
    r = (
        get_client().table("appointments")
        .select("*")
        .eq("id", appointment_id)
        .eq("customer_id", customer_id)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def create_appointment(data: dict):
    # Verificar disponibilidade
    date_str = str(data["date"])
    time_str = str(data["time_slot"])

    # Verificar se o horário está marcado como disponível
    available_slot = (
        get_client()
        .table("availability_slots")
        .select("id")
        .eq("date", date_str)
        .eq("time_slot", time_str)
        .eq("is_available", True)
        .execute()
    )

    if not available_slot.data:
        raise Exception("Horário selecionado não está disponível")

    # Verificar se não há agendamento existente para o mesmo veículo na mesma data/hora
    existing_appointment = (
        get_client()
        .table("appointments")
        .select("id")
        .eq("vehicle_id", data["vehicle_id"])
        .eq("date", date_str)
        .eq("time_slot", time_str)
        .in_("status", ["pendente", "confirmado"])
        .execute()
    )

    if existing_appointment.data:
        raise Exception("Já existe um agendamento para este veículo neste horário")

    # Criar o agendamento se todas as verificações passarem
    r = get_client().table("appointments").insert(data).execute()
    return r.data[0] if r.data else None


def cancel_appointment(appointment_id: str, customer_id: str):
    from .serializers import now_iso
    r = (
        get_client().table("appointments")
        .update({"status": "cancelado", "updated_at": now_iso()})
        .eq("id", appointment_id)
        .eq("customer_id", customer_id)
        .in_("status", ["pendente", "confirmado"])
        .execute()
    )
    return r.data[0] if r.data else None


# ── Availability ──────────────────────────────────────────────────────────────

def get_available_slots(year: int, month: int):
    from datetime import date
    start = date(year, month, 1).isoformat()
    if month == 12:
        end = date(year + 1, 1, 1).isoformat()
    else:
        end = date(year, month + 1, 1).isoformat()
    r = (
        get_client().table("availability_slots")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .eq("is_available", True)
        .order("date")
        .execute()
    )
    return r.data or []


def get_available_times(date_str: str):
    r = (
        get_client().table("availability_slots")
        .select("*")
        .eq("date", date_str)
        .eq("is_available", True)
        .order("time_slot")
        .execute()
    )
    return r.data or []


# ── Estimates ─────────────────────────────────────────────────────────────────

def list_estimates(customer_id: str, status: str | None = None):
    q = (
        get_client().table("estimates")
        .select("*, estimate_items(*)")
        .eq("customer_id", customer_id)
        .order("created_at", desc=True)
    )
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


def get_estimate(estimate_id: str, customer_id: str):
    r = (
        get_client().table("estimates")
        .select("*, estimate_items(*)")
        .eq("id", estimate_id)
        .eq("customer_id", customer_id)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def update_estimate_status(estimate_id: str, customer_id: str, new_status: str, comment: str = ""):
    from .serializers import now_iso
    data: dict = {"status": new_status, "updated_at": now_iso()}
    if comment:
        data["customer_comment"] = comment
    r = (
        get_client().table("estimates")
        .update(data)
        .eq("id", estimate_id)
        .eq("customer_id", customer_id)
        .execute()
    )
    return r.data[0] if r.data else None


# ── Service History ───────────────────────────────────────────────────────────

def list_service_history(customer_id: str, vehicle_id: str | None = None):
    q = (
        get_client().table("service_history")
        .select("*, service_history_items(*)")
        .eq("customer_id", customer_id)
        .order("service_date", desc=True)
    )
    if vehicle_id:
        q = q.eq("vehicle_id", vehicle_id)
    return q.execute().data or []


def get_service_history_item(history_id: str, customer_id: str):
    r = (
        get_client().table("service_history")
        .select("*, service_history_items(*)")
        .eq("id", history_id)
        .eq("customer_id", customer_id)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


# ── Notifications ─────────────────────────────────────────────────────────────

def list_notifications(customer_id: str, unread_only: bool = False):
    q = (
        get_client().table("notifications")
        .select("*")
        .eq("customer_id", customer_id)
        .order("created_at", desc=True)
        .limit(50)
    )
    if unread_only:
        q = q.eq("is_read", False)
    return q.execute().data or []


def mark_notification_read(notification_id: str, customer_id: str):
    r = (
        get_client().table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("customer_id", customer_id)
        .execute()
    )
    return r.data[0] if r.data else None


def mark_all_notifications_read(customer_id: str):
    get_client().table("notifications").update({"is_read": True}).eq("customer_id", customer_id).execute()


# ── Maintenance Reminders ─────────────────────────────────────────────────────

def list_reminders(customer_id: str):
    r = (
        get_client().table("maintenance_reminders")
        .select("*, customer_vehicles(brand, model, year, plate, mileage)")
        .eq("customer_id", customer_id)
        .order("urgency_score", desc=True)
        .execute()
    )
    return r.data or []


# ── Dashboard Summary ─────────────────────────────────────────────────────────

def get_dashboard_summary(customer_id: str) -> dict:
    """Returns aggregated data for the dashboard screen."""
    vehicles = list_vehicles(customer_id)
    appointments = list_appointments(customer_id)
    pending_estimates = list_estimates(customer_id, status="pendente")
    notifications = list_notifications(customer_id, unread_only=True)
    reminders = list_reminders(customer_id)

    upcoming_appts = [a for a in appointments if a.get("status") in ("pendente", "confirmado")]
    urgent_reminders = [r for r in reminders if r.get("urgency") in ("urgente", "atencao")]

    active_vehicle = next((v for v in vehicles if v.get("is_active")), vehicles[0] if vehicles else None)

    return {
        "vehicles_count": len(vehicles),
        "active_vehicle": active_vehicle,
        "upcoming_appointments": upcoming_appts[:3],
        "pending_estimates_count": len(pending_estimates),
        "pending_estimates": pending_estimates[:2],
        "unread_notifications_count": len(notifications),
        "recent_notifications": notifications[:5],
        "urgent_reminders": urgent_reminders[:3],
        "all_reminders": reminders[:6],
    }
