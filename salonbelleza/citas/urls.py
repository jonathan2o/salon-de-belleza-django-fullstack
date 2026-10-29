from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from citas.views import (
    AdminLoginView,
    TrabajadorLoginView,
    LoginView,
    ServicioListView,
    ServicioDetailView,
    CategoriaUpdateView,
    CategoriaDeleteView,
    TrabajadorListView,
    CrearTrabajadorView,
    UpdateTrabajadorServiciosView,
    UpdateDisponibilidadView,
    EliminarTrabajadoresMasivoView,
    EliminarTrabajadorView,
    RegistrarIngresoView,
    IngresosHoyView,
    EstadoManualView,
    HorasDisponiblesView,
    CrearCitaView,
    CitasPendientesTrabajadorView,
    GestionarCitaView,
    ObtenerQRView,
    PermisoContabilidadView,
    RegistroContabilidadListCreateView,
    RegistroContabilidadDetailView,
    ResumenContabilidadView,
    HistorialServiciosView,
    QuincenasDisponiblesView,
)

urlpatterns = [
    # Autenticación
    path("login/admin/", AdminLoginView.as_view(), name="login-admin"),
    path("login/trabajador/", TrabajadorLoginView.as_view(), name="login-trabajador"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    # Servicios y Categorías
    path("servicios/", ServicioListView.as_view(), name="servicios-list"),
    path("servicios/<int:pk>/", ServicioDetailView.as_view(), name="servicio-detail"),
    path(
        "categorias/modificar/",
        CategoriaUpdateView.as_view(),
        name="categoria-modificar",
    ),
    path(
        "categorias/eliminar/",
        CategoriaDeleteView.as_view(),
        name="categoria-eliminar",
    ),
    # Trabajadores
    path("trabajadores/", TrabajadorListView.as_view(), name="trabajadores-list"),
    path("trabajadores/ingresos/", IngresosHoyView.as_view(), name="trabajadores-ingresos"),
    path(
        "trabajadores/<int:pk>/ingreso/",
        RegistrarIngresoView.as_view(),
        name="trabajador-ingreso",
    ),
    path(
        "trabajadores/<int:pk>/estado/",
        EstadoManualView.as_view(),
        name="trabajador-estado-manual",
    ),
    path(
        "trabajadores/registrar/",
        CrearTrabajadorView.as_view(),
        name="registrar-trabajador",
    ),
    path(
        "trabajadores/<int:pk>/servicios/",
        UpdateTrabajadorServiciosView.as_view(),
        name="trabajador-servicios",
    ),
    path(
        "trabajadores/<int:pk>/disponibilidad/",
        UpdateDisponibilidadView.as_view(),
        name="trabajador-disponibilidad",
    ),
    path(
        "trabajadores/eliminar-masivo/",
        EliminarTrabajadoresMasivoView.as_view(),
        name="eliminar-trabajadores-masivo",
    ),
    path(
        "trabajadores/<int:pk>/eliminar/",
        EliminarTrabajadorView.as_view(),
        name="eliminar-trabajador",
    ),
    # Citas y Horarios
    path("horas/", HorasDisponiblesView.as_view(), name="horas-disponibles"),
    path("horas-disponibles/", HorasDisponiblesView.as_view(), name="horas-disponibles-alias"),
    path("citas/", CrearCitaView.as_view(), name="citas-crear"),
    path("citas/pendientes/", CitasPendientesTrabajadorView.as_view(), name="citas-pendientes"),
    path("citas/<int:pk>/gestionar/", GestionarCitaView.as_view(), name="citas-gestionar"),
    # QR Code
    path("qr/", ObtenerQRView.as_view(), name="qr-obtener"),
    path("qr/<int:cita_id>/", ObtenerQRView.as_view(), name="qr-cita"),
    # Contabilidad
    path(
        "trabajadores/<int:pk>/permiso-contabilidad/",
        PermisoContabilidadView.as_view(),
        name="permiso-contabilidad",
    ),
    path(
        "contabilidad/registros/",
        RegistroContabilidadListCreateView.as_view(),
        name="contabilidad-list-create",
    ),
    path(
        "contabilidad/registros/<int:pk>/",
        RegistroContabilidadDetailView.as_view(),
        name="contabilidad-detail",
    ),
    path(
        "contabilidad/resumen/",
        ResumenContabilidadView.as_view(),
        name="contabilidad-resumen",
    ),
    path(
        "contabilidad/historial/",
        HistorialServiciosView.as_view(),
        name="contabilidad-historial",
    ),
    path(
        "contabilidad/quincenas/",
        QuincenasDisponiblesView.as_view(),
        name="contabilidad-quincenas",
    ),
]
