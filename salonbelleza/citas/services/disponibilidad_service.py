import math
from datetime import datetime, time, timedelta
from citas.models import Cita, Trabajador

BLOCK_MINUTES = 30


class DisponibilidadService:

    @staticmethod
    def servicio_a_bloques(servicio) -> int:
        if hasattr(servicio, "bloques") and servicio.bloques:
            return int(servicio.bloques)
        duracion = getattr(servicio, "duracion", BLOCK_MINUTES)
        return math.ceil(duracion / BLOCK_MINUTES)

    @classmethod
    def generar_horas_jornada(cls, trabajador: Trabajador, fecha) -> list[time]:
        hora_inicio = getattr(trabajador, "hora_inicio", None) or time(9, 0)
        hora_fin = getattr(trabajador, "hora_fin", None) or time(18, 0)

        inicio = datetime.combine(fecha, hora_inicio)
        fin = datetime.combine(fecha, hora_fin)

        horas = []
        actual = inicio
        while actual < fin:
            horas.append(actual.time())
            actual += timedelta(minutes=BLOCK_MINUTES)

        return horas

    @classmethod
    def obtener_horas_ocupadas(cls, citas_qs, fecha) -> list[time]:
        horas_ocupadas = []
        for cita in citas_qs:
            inicio = datetime.combine(fecha, cita.hora)
            bloques = cls.servicio_a_bloques(cita.servicio)

            for i in range(bloques):
                bloque = inicio + timedelta(minutes=BLOCK_MINUTES * i)
                horas_ocupadas.append(bloque.time())

        return horas_ocupadas

    @classmethod
    def obtener_horas_disponibles(cls, trabajador: Trabajador, fecha) -> list[str]:
        horas_jornada = cls.generar_horas_jornada(trabajador, fecha)
        citas = Cita.objects.filter(trabajador=trabajador, fecha=fecha).exclude(estado="cancelada")
        horas_ocupadas = cls.obtener_horas_ocupadas(citas, fecha)

        disponibles = [h for h in horas_jornada if h not in horas_ocupadas]
        return [h.strftime("%H:%M") for h in disponibles]

    @classmethod
    def validar_disponibilidad_slot(
        cls, hora: time, servicio, trabajador: Trabajador, fecha
    ) -> bool:
        inicio = datetime.combine(fecha, hora)
        bloques = cls.servicio_a_bloques(servicio)

        citas = Cita.objects.filter(trabajador=trabajador, fecha=fecha).exclude(estado="cancelada")
        horas_ocupadas = cls.obtener_horas_ocupadas(citas, fecha)

        for i in range(bloques):
            bloque = (inicio + timedelta(minutes=BLOCK_MINUTES * i)).time()
            if bloque in horas_ocupadas:
                return False

        return True
