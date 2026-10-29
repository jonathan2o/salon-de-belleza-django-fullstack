from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from citas.models import Trabajador, Servicio
from citas.serializers.trabajador_serializers import (
    TrabajadorSerializer,
    TrabajadorCreateSerializer,
)
from citas.services.estado_service import calcular_estado, ingreso_hoy


class TrabajadorListView(generics.ListAPIView):
    serializer_class = TrabajadorSerializer

    def get_queryset(self):
        servicio_id = self.request.query_params.get("servicio")
        if servicio_id:
            return Trabajador.objects.filter(servicios__id=servicio_id)
        return Trabajador.objects.all()


class CrearTrabajadorView(APIView):
    def post(self, request):
        serializer = TrabajadorCreateSerializer(data=request.data)
        if serializer.is_valid():
            trabajador = serializer.save()
            return Response(
                {
                    "message": "Usuario y trabajador creados correctamente",
                    "trabajador": {
                        "id": trabajador.id,
                        "nombre": trabajador.nombre,
                        "apellidos": trabajador.apellidos,
                        "correo": trabajador.correo,
                    },
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"error": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class UpdateTrabajadorServiciosView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            trabajador = Trabajador.objects.get(pk=pk)
        except Trabajador.DoesNotExist:
            return Response(
                {"error": "Trabajador no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        servicios_ids = request.data.get("servicios", [])
        if not isinstance(servicios_ids, list):
            return Response(
                {"error": "El campo 'servicios' debe ser una lista de ids"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        servicios_qs = Servicio.objects.filter(id__in=servicios_ids)
        trabajador.servicios.set(servicios_qs)
        return Response(
            {"message": "Servicios elegidos correctamente"},
            status=status.HTTP_200_OK,
        )


class UpdateDisponibilidadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            trabajador = Trabajador.objects.get(pk=pk)
        except Trabajador.DoesNotExist:
            return Response(
                {"error": "Trabajador no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        dias = request.data.get("dias", [])
        hora_inicio = request.data.get("hora_inicio") or None
        hora_fin = request.data.get("hora_fin") or None

        trabajador.dias_disponibles = dias
        trabajador.hora_inicio = hora_inicio
        trabajador.hora_fin = hora_fin
        trabajador.save()

        return Response(
            {"message": "Disponibilidad guardada correctamente"},
            status=status.HTTP_200_OK,
        )


class EliminarTrabajadorView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            trabajador = Trabajador.objects.get(pk=pk)
        except Trabajador.DoesNotExist:
            return Response(
                {"error": "Trabajador no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        trabajador.user.delete()
        return Response(
            {"message": "Trabajador eliminado correctamente"},
            status=status.HTTP_200_OK,
        )


class EliminarTrabajadoresMasivoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            ids = request.data.get("ids", [])
            if not isinstance(ids, list):
                return Response(
                    {"error": "El campo 'ids' debe ser una lista"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            trabajadores = Trabajador.objects.filter(id__in=ids)
            deleted_count = 0
            for t in trabajadores:
                t.user.delete()
                deleted_count += 1

            return Response(
                {
                    "message": f"{deleted_count} trabajadores eliminados correctamente"
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": f"Error al eliminar trabajadores: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RegistrarIngresoView(APIView):
    """
    POST /api/trabajadores/<pk>/ingreso/
    Registra la fecha y hora de ingreso (activación) del trabajador.
    Solo el propio trabajador o un admin.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            trabajador = Trabajador.objects.get(pk=pk)
        except Trabajador.DoesNotExist:
            return Response(
                {"error": "Trabajador no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_admin = request.user.is_staff
        es_propio = (
            hasattr(request.user, "trabajador")
            and request.user.trabajador.id == trabajador.id
        )
        if not (es_admin or es_propio):
            return Response(
                {"error": "No autorizado para registrar este ingreso"},
                status=status.HTTP_403_FORBIDDEN,
            )

        trabajador.ultimo_ingreso = timezone.now()
        trabajador.save()

        return Response(
            {
                "message": "Ingreso registrado correctamente",
                "estado": calcular_estado(trabajador),
                "hora_ingreso": trabajador.ultimo_ingreso.strftime("%H:%M"),
            },
            status=status.HTTP_200_OK,
        )


class IngresosHoyView(APIView):
    """
    GET /api/trabajadores/ingresos/   (solo admin)
    Trabajadores que activaron (ingresaron) hoy: para la campana de alertas.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        data = []
        for t in Trabajador.objects.select_related("user").all():
            if ingreso_hoy(t):
                data.append(
                    {
                        "id": t.id,
                        "nombre": f"{t.nombre} {t.apellidos}".strip(),
                        "hora_ingreso": t.ultimo_ingreso.strftime("%H:%M"),
                        "fecha_ingreso": t.ultimo_ingreso.isoformat(),
                        "estado": calcular_estado(t),
                    }
                )
        data.sort(key=lambda x: x["fecha_ingreso"], reverse=True)
        return Response(data)


class EstadoManualView(APIView):
    """
    PATCH /api/trabajadores/<pk>/estado/
    Cambia el estado manual del trabajador: activo | descanso | apagado.
    Solo el propio trabajador o un admin.
    - Activo/Descanso: registra el ingreso del día si aún no existe (no
      sobreescribe la hora original).
    - Apagado: no registra ingreso.
    """

    ESTADOS_VALIDOS = {"activo", "descanso", "apagado"}
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            trabajador = Trabajador.objects.get(pk=pk)
        except Trabajador.DoesNotExist:
            return Response(
                {"error": "Trabajador no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        es_admin = request.user.is_staff
        es_propio = (
            hasattr(request.user, "trabajador")
            and request.user.trabajador.id == trabajador.id
        )
        if not (es_admin or es_propio):
            return Response(
                {"error": "No autorizado para cambiar el estado de este trabajador"},
                status=status.HTTP_403_FORBIDDEN,
            )

        nuevo = request.data.get("estado")
        if nuevo not in self.ESTADOS_VALIDOS:
            return Response(
                {"error": "Estado no válido (use: activo, descanso o apagado)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trabajador.estado_manual = nuevo
        trabajador.estado_manual_fecha = timezone.now().date()
        if nuevo in ("activo", "descanso") and not ingreso_hoy(trabajador):
            trabajador.ultimo_ingreso = timezone.now()
        trabajador.save()

        return Response(
            {
                "message": "Estado actualizado",
                "estado_manual": trabajador.estado_manual,
                "estado": calcular_estado(trabajador),
                "hora_ingreso": (
                    trabajador.ultimo_ingreso.strftime("%H:%M")
                    if ingreso_hoy(trabajador)
                    else ""
                ),
            },
            status=status.HTTP_200_OK,
        )
