from .auth_serializers import LoginSerializer, get_tokens_for_user
from .servicio_serializers import ServicioSerializer
from .trabajador_serializers import (
    TrabajadorSerializer,
    TrabajadorCreateSerializer,
    TrabajadorServiciosSerializer,
    TrabajadorDisponibilidadSerializer,
)
from .cita_serializers import CitaSerializer
from .contabilidad_serializers import (
    RegistroContabilidadSerializer,
    RegistroContabilidadCreateUpdateSerializer,
)

# Aliases de compatibilidad y arquitectura limpia
TrabajadorReadSerializer = TrabajadorSerializer
TrabajadorWriteSerializer = TrabajadorCreateSerializer

__all__ = [
    "LoginSerializer",
    "get_tokens_for_user",
    "ServicioSerializer",
    "TrabajadorSerializer",
    "TrabajadorReadSerializer",
    "TrabajadorWriteSerializer",
    "TrabajadorCreateSerializer",
    "TrabajadorServiciosSerializer",
    "TrabajadorDisponibilidadSerializer",
    "CitaSerializer",
    "RegistroContabilidadSerializer",
    "RegistroContabilidadCreateUpdateSerializer",
]
