"""
Estado de disponibilidad del trabajador en tiempo real.
Estados: "ocupado" (cita en curso ahora), "activo" (ingresó hoy)
y "sin servicio" (resto).
"""
import math
from datetime import datetime, timedelta, timezone as dt_timezone

from django.utils import timezone
from citas.models import Cita

BLOCK_MINUTES = 30


def _ahora():
    return timezone.now()


def _hoy():
    # Mismo criterio de "hoy" que usa la contabilidad (UTC)
    return _ahora().date()


def cita_en_curso(trabajador, ahora=None):
    """Devuelve la cita del trabajador que está en curso ahora mismo (o None)."""
    ahora = ahora or _ahora()
    hoy = ahora.date()
    citas = Cita.objects.filter(trabajador=trabajador, fecha=hoy).select_related("servicio")
    for cita in citas:
        bloques = math.ceil(
            float(getattr(cita.servicio, "duracion", BLOCK_MINUTES)) / BLOCK_MINUTES
        )
        if getattr(cita.servicio, "bloques", None):
            bloques = int(cita.servicio.bloques)
        inicio = datetime.combine(hoy, cita.hora, tzinfo=dt_timezone.utc)
        fin = inicio + timedelta(minutes=BLOCK_MINUTES * bloques)
        if inicio <= ahora < fin:
            return cita
    return None


def ingreso_hoy(trabajador, ahora=None):
    """True si el trabajador registró su ingreso hoy."""
    ahora = ahora or _ahora()
    li = trabajador.ultimo_ingreso
    if not li:
        return False
    return li.date() == _hoy()


def estado_manual_vigente(trabajador, ahora=None):
    """
    Devuelve el estado manual si sigue vigente, según la jornada:
    - None            → no vigente (sin estado o fijado otro día) → flujo automático
    - "activo"/"descanso"/"apagado" → vigente, mostrar ese estado
    - "sin servicio"  → la hora_fin de HOY ya pasó (jornada terminada):
      queda inactivo el resto del día aunque haya cita o ingreso.
    Los trabajadores sin hora_fin caducan a medianoche (estado de un solo día).
    """
    ahora = ahora or _ahora()
    manual = getattr(trabajador, "estado_manual", None)
    if not manual:
        return None
    if getattr(trabajador, "estado_manual_fecha", None) != _hoy():
        return None

    hora_fin = getattr(trabajador, "hora_fin", None)
    if hora_fin:
        fin_jornada = datetime.combine(_hoy(), hora_fin, tzinfo=dt_timezone.utc)
        if ahora >= fin_jornada:
            return "sin servicio"
    return manual


def calcular_estado(trabajador, ahora=None):
    """Estado en tiempo real.

    Prioridad: estado manual vigente (según su jornada) → automático
    ('ocupado' cita en curso, 'activo' ingresó hoy, 'sin servicio' resto).
    """
    ahora = ahora or _ahora()
    vigente = estado_manual_vigente(trabajador, ahora)
    if vigente:
        return vigente
    if cita_en_curso(trabajador, ahora):
        return "ocupado"
    if ingreso_hoy(trabajador, ahora):
        return "activo"
    return "sin servicio"
