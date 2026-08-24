from django.urls import path, include

urlpatterns = [
    path("", include("orders.urls")),
]
