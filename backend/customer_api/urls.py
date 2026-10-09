from django.urls import path
from . import views

app_name = "customer_api"

urlpatterns = [
    # ── Health ────────────────────────────────────────────────────────────────
    path("", lambda r, **k: __import__("rest_framework.response", fromlist=["Response"]).Response({"status": "customer-api-online"}), name="root"),

    # ── Auth ──────────────────────────────────────────────────────────────────
    path("customer/auth/register", views.register, name="register"),
    path("customer/auth/login", views.login, name="login"),
    path("customer/auth/refresh", views.token_refresh, name="token-refresh"),
    path("customer/auth/forgot-password", views.forgot_password, name="forgot-password"),
    path("customer/auth/pin-login", views.pin_login, name="pin-login"),

    # ── Mechanic ──────────────────────────────────────────────────────────
    path("customer/mechanic/clients", views.mechanic_create_client, name="mechanic-create-client"),

    # ── Profile ───────────────────────────────────────────────────────────────
    path("customer/me", views.profile, name="profile"),
    path("customer/me/change-password", views.change_password, name="change-password"),

    # ── Dashboard ─────────────────────────────────────────────────────────────
    path("customer/dashboard", views.dashboard, name="dashboard"),

    # ── Vehicles ──────────────────────────────────────────────────────────────
    path("customer/vehicles", views.vehicles_list, name="vehicles-list"),
    path("customer/vehicles/<str:vehicle_id>", views.vehicle_detail, name="vehicle-detail"),

    # ── Appointments ──────────────────────────────────────────────────────────
    path("customer/appointments", views.appointments_list, name="appointments-list"),
    path("customer/appointments/<str:appointment_id>", views.appointment_detail, name="appointment-detail"),

    # ── Availability ──────────────────────────────────────────────────────────
    path("customer/availability", views.available_days, name="available-days"),
    path("customer/availability/times", views.available_times, name="available-times"),

    # ── Estimates ─────────────────────────────────────────────────────────────
    path("customer/estimates", views.estimates_list, name="estimates-list"),
    path("customer/estimates/<str:estimate_id>", views.estimate_detail, name="estimate-detail"),

    # ── History ───────────────────────────────────────────────────────────────
    path("customer/history", views.history_list, name="history-list"),
    path("customer/history/<str:history_id>", views.history_detail, name="history-detail"),

    # ── Notifications ─────────────────────────────────────────────────────────
    path("customer/notifications", views.notifications_list, name="notifications-list"),
    path("customer/notifications/read-all", views.notifications_read_all, name="notifications-read-all"),
    path("customer/notifications/<str:notification_id>/read", views.notification_read, name="notification-read"),

    # ── Reminders ─────────────────────────────────────────────────────────────
    path("customer/reminders", views.reminders_list, name="reminders-list"),
]
