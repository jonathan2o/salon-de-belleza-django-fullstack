from .auth_views import AdminLoginView, TrabajadorLoginView, LoginView
from .servicio_views import (
    ServicioListView,
    ServicioDetailView,
    CategoriaUpdateView,
    CategoriaDeleteView,
)
from .trabajador_views import (
    TrabajadorListView,
    CrearTrabajadorView,
    UpdateTrabajadorServiciosView,
    UpdateDisponibilidadView,
    EliminarTrabajadorView,
    EliminarTrabajadoresMasivoView,
    RegistrarIngresoView,
    IngresosHoyView,
    EstadoManualView,
)
from .cita_views import (
    HorasDisponiblesView,
    CrearCitaView,
    CitasPendientesTrabajadorView,
    GestionarCitaView,
)
from .qr_views import ObtenerQRView
from .contabilidad_views import (
    PermisoContabilidadView,
    RegistroContabilidadListCreateView,
    RegistroContabilidadDetailView,
    ResumenContabilidadView,
    HistorialServiciosView,
    QuincenasDisponiblesView,
)

__all__ = [
    "AdminLoginView",
    "TrabajadorLoginView",
    "LoginView",
    "ServicioListView",
    "ServicioDetailView",
    "CategoriaUpdateView",
    "CategoriaDeleteView",
    "TrabajadorListView",
    "CrearTrabajadorView",
    "UpdateTrabajadorServiciosView",
    "UpdateDisponibilidadView",
    "EliminarTrabajadorView",
    "EliminarTrabajadoresMasivoView",
    "RegistrarIngresoView",
    "IngresosHoyView",
    "EstadoManualView",
    "HorasDisponiblesView",
    "CrearCitaView",
    "CitasPendientesTrabajadorView",
    "GestionarCitaView",
    "ObtenerQRView",
    "PermisoContabilidadView",
    "RegistroContabilidadListCreateView",
    "RegistroContabilidadDetailView",
    "ResumenContabilidadView",
    "HistorialServiciosView",
    "QuincenasDisponiblesView",
]
