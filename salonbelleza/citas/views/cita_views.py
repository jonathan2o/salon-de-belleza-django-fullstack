from datetime import datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from citas.models import Cita, Trabajador
from citas.serializers.cita_serializers import CitaSerializer
from citas.services.disponibilidad_service import DisponibilidadService


class HorasDisponiblesView(APIView):
    def get(self, request):
        trabajador_id = request.query_params.get("trabajador")
        fecha = request.query_params.get("fecha")

        if not trabajador_id or not fecha:
            return Response(
                {"error": "Debes enviar trabajador y fecha"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            trabajador = Trabajador.objects.get(id=trabajador_id)
        except Trabajador.DoesNotExist:
            return Response(
                {"error": "Trabajador no existe"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()
        except Exception:
            return Response(
                {"error": "Formato de fecha inválido. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        horas_disponibles = DisponibilidadService.obtener_horas_disponibles(
            trabajador, fecha_obj
        )
        return Response(horas_disponibles, status=status.HTTP_200_OK)


class CrearCitaView(APIView):
    def get(self, request):
        trabajador_id = request.query_params.get("trabajador")
        estado = request.query_params.get("estado")
        citas = Cita.objects.all()
        if trabajador_id:
            citas = citas.filter(trabajador_id=trabajador_id)
        if estado:
            citas = citas.filter(estado=estado)
        citas = citas.order_by("-fecha", "-hora")
        serializer = CitaSerializer(citas, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data.copy()
        if "estado" not in data or not data["estado"]:
            data["estado"] = "pendiente"
        if "origen" not in data or not data["origen"]:
            data["origen"] = "cliente_manual"

        serializer = CitaSerializer(data=data)
        if serializer.is_valid():
            trabajador = serializer.validated_data["trabajador"]
            fecha = serializer.validated_data["fecha"]
            hora = serializer.validated_data["hora"]
            servicio = serializer.validated_data["servicio"]

            disponible = DisponibilidadService.validar_disponibilidad_slot(
                hora, servicio, trabajador, fecha
            )

            if not disponible:
                return Response(
                    {"error": "Ese horario ya está ocupado"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CitasPendientesTrabajadorView(APIView):
    """Devuelve las citas con estado 'pendiente' para un trabajador específico."""

    def get(self, request):
        trabajador_id = request.query_params.get("trabajador")

        # Si no se pasó trabajador_id, intentar identificar por usuario autenticado
        if not trabajador_id and request.user.is_authenticated:
            try:
                trabajador = Trabajador.objects.get(user=request.user)
                trabajador_id = trabajador.id
            except Trabajador.DoesNotExist:
                pass

        if not trabajador_id:
            return Response(
                {"error": "Debes especificar el parámetro trabajador o autenticarte como trabajador"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        citas = Cita.objects.filter(
            trabajador_id=trabajador_id,
            estado="pendiente",
        ).order_by("fecha", "hora")

        serializer = CitaSerializer(citas, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GestionarCitaView(APIView):
    """Permite al trabajador o admin aceptar o cancelar una cita pendiente."""

    def post(self, request, pk):
        try:
            cita = Cita.objects.get(pk=pk)
        except Cita.DoesNotExist:
            return Response(
                {"error": "Cita no encontrada"},
                status=status.HTTP_404_NOT_FOUND,
            )

        accion = request.data.get("accion", "").strip().lower()

        if accion not in ["aceptar", "cancelar"]:
            return Response(
                {"error": "Acción inválida. Use 'aceptar' o 'cancelar'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if accion == "aceptar":
            cita.estado = "confirmada"
            cita.save()
            serializer = CitaSerializer(cita)
            return Response(
                {
                    "message": "Cita aceptada y agregada a tu agenda exitosamente",
                    "cita": serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        else:
            cita.estado = "cancelada"
            cita.save()
            serializer = CitaSerializer(cita)
            return Response(
                {
                    "message": "Cita cancelada correctamente",
                    "cita": serializer.data,
                },
                status=status.HTTP_200_OK,
            )
