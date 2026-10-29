from .services.disponibilidad_service import (
    BLOCK_MINUTES,
    DisponibilidadService,
)


def generar_horas(trabajador, fecha):
    """Mantenido por retrocompatibilidad: delega en DisponibilidadService."""
    return DisponibilidadService.generar_horas_jornada(trabajador, fecha)


def _servicio_a_bloques(servicio):
    """Mantenido por retrocompatibilidad: delega en DisponibilidadService."""
    return DisponibilidadService.servicio_a_bloques(servicio)


def obtener_horas_ocupadas(citas, fecha):
    """Mantenido por retrocompatibilidad: delega en DisponibilidadService."""
    return DisponibilidadService.obtener_horas_ocupadas(citas, fecha)


def obtener_horas_disponibles(trabajador, fecha, citas=None):
    """Mantenido por retrocompatibilidad: delega en DisponibilidadService."""
    return DisponibilidadService.obtener_horas_disponibles(trabajador, fecha)


def validar_disponibilidad(hora, servicio, citas, fecha):
    """Mantenido por retrocompatibilidad: delega en DisponibilidadService."""
    trabajador = citas.first().trabajador if hasattr(citas, "first") and citas.first() else None
    return DisponibilidadService.validar_disponibilidad_slot(
        hora, servicio, trabajador, fecha
    )