from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework.views import APIView
from datetime import datetime
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import Servicio, Trabajador, Cita
from .serializers import ServicioSerializer, TrabajadorSerializer, CitaSerializer
from .services import QRService, DisponibilidadService
from .services.disponibilidad_service import BLOCK_MINUTES


# ---------------- LOGIN ---------------- #
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


class AdminLoginView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)
        if user and user.is_staff:
            tokens = get_tokens_for_user(user)
            return Response({"token": tokens, "message": "Login admin exitoso"})
        return Response(
            {"error": "Credenciales inválidas"}, status=status.HTTP_401_UNAUTHORIZED
        )


class TrabajadorLoginView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)
        if user and not user.is_staff:
            tokens = get_tokens_for_user(user)
            return Response({"token": tokens, "message": "Login trabajador exitoso"})
        return Response(
            {"error": "Credenciales inválidas"}, status=status.HTTP_401_UNAUTHORIZED
        )


# ---------------- SERVICIOS / TRABAJADORES / CITAS ---------------- #
class ServicioListView(generics.ListCreateAPIView):
    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer

    def create(self, request, *args, **kwargs):
        # Allow creating servicios via POST. Calculate duracion based on bloques (30 min each).
        data = request.data.copy()
        try:
            bloques = int(data.get("bloques", 1))
        except Exception:
            bloques = 1
        # Ensure bloques is non-negative and reasonable
        if bloques < 0:
            bloques = 0
        data["duracion"] = bloques * BLOCK_MINUTES

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class ServicioDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer


class CategoriaUpdateView(APIView):
    def post(self, request):
        try:
            old_name = request.data.get("old_name", "").strip()
            new_name = request.data.get("new_name", "").strip()
            if not old_name or not new_name:
                return Response({"error": "Ambos nombres son obligatorios"}, status=400)

            # Get all services starting with old_name + " - "
            servicios = Servicio.objects.filter(nombre__startswith=f"{old_name} - ")
            updated_count = 0
            for s in servicios:
                s.nombre = s.nombre.replace(f"{old_name} - ", f"{new_name} - ", 1)
                s.save()
                updated_count += 1

            # Also get services named exactly old_name
            exact_servicios = Servicio.objects.filter(nombre=old_name)
            for s in exact_servicios:
                s.nombre = new_name
                s.save()
                updated_count += 1

            return Response({"message": f"Categoría modificada. {updated_count} servicios actualizados."})
        except Exception as e:
            return Response({"error": f"Error al modificar la categoría: {str(e)}"}, status=500)


class CategoriaDeleteView(APIView):
    def post(self, request):
        try:
            name = request.data.get("name", "").strip()
            if not name:
                return Response({"error": "El nombre es obligatorio"}, status=400)

            # Delete all services starting with name + " - " or named exactly name
            deleted_count, _ = Servicio.objects.filter(nombre__startswith=f"{name} - ").delete()
            deleted_exact, _ = Servicio.objects.filter(nombre=name).delete()

            return Response({"message": f"Categoría eliminada. {deleted_count + deleted_exact} servicios eliminados."})
        except Exception as e:
            return Response({"error": f"Error al eliminar la categoría: {str(e)}"}, status=500)


class TrabajadorListView(generics.ListAPIView):

    serializer_class = TrabajadorSerializer

    def get_queryset(self):

        servicio_id = self.request.query_params.get("servicio")

        print("SERVICIO ID:", servicio_id)

        if servicio_id:

            trabajadores = Trabajador.objects.filter(servicios__id=servicio_id)

            print("TRABAJADORES:", trabajadores)

            return trabajadores

        return Trabajador.objects.all()


class HorasDisponiblesView(APIView):
    def get(self, request):
        trabajador_id = request.query_params.get("trabajador")
        fecha = request.query_params.get("fecha")

        if not trabajador_id or not fecha:
            return Response({"error": "Debes enviar trabajador y fecha"}, status=400)

        try:
            trabajador = Trabajador.objects.get(id=trabajador_id)
        except Trabajador.DoesNotExist:
            return Response({"error": "Trabajador no existe"}, status=404)

        # Parsear fecha YYYY-MM-DD
        try:
            fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()
        except Exception:
            return Response(
                {"error": "Formato de fecha inválido. Use YYYY-MM-DD"}, status=400
            )

        horas_str = DisponibilidadService.obtener_horas_disponibles(trabajador, fecha_obj)
        return Response(horas_str)


class CrearCitaView(APIView):
    def get(self, request):
        citas = Cita.objects.all().order_by('-fecha', '-hora')
        serializer = CitaSerializer(citas, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CitaSerializer(data=request.data)
        if serializer.is_valid():
            trabajador = serializer.validated_data["trabajador"]
            servicio = serializer.validated_data["servicio"]  # <-- LÍNEA AGREGADA
            fecha = serializer.validated_data["fecha"]
            hora = serializer.validated_data["hora"]
            
            disponible = DisponibilidadService.validar_disponibilidad_slot(
                hora, servicio, trabajador, fecha
            )

            if not disponible:
                return Response({"error": "Ese horario ya está ocupado"}, status=400)

            serializer.save()
            return Response(serializer.data, status=201)

        return Response(serializer.errors, status=400)


class CrearTrabajadorView(APIView):
    def post(self, request):
        data = request.data

        # Validar campos requeridos (numero_cc ya no es obligatorio)
        required_fields = ["nombre", "apellidos", "telefono", "correo", "password"]
        for field in required_fields:
            if not data.get(field):
                return Response({"error": f"El campo {field} es requerido"}, status=400)

        try:
            # Verificar si el usuario ya existe
            if User.objects.filter(username=data["correo"]).exists():
                return Response(
                    {"error": "Ya existe un usuario con este correo"}, status=400
                )

            # (Se omite la verificación por numero_cc porque ya no es obligatorio)

            # Crear usuario
            user = User.objects.create_user(
                username=data["correo"], email=data["correo"], password=data["password"]
            )

            # Crear trabajador
            trabajador = Trabajador.objects.create(
                user=user,
                nombre=data["nombre"],
                apellidos=data["apellidos"],
                telefono=data["telefono"],
                correo=data["correo"],
            )

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
                status=201,
            )

        except Exception as e:
            # Si hay error, eliminar el usuario si se creó
            if "user" in locals():
                user.delete()
            return Response(
                {"error": f"Error al crear el trabajador: {str(e)}"}, status=500
            )


class UpdateTrabajadorServiciosView(APIView):
    """Actualizar los servicios que realiza un trabajador.

    Espera POST con JSON: { "servicios": [1,2,3] }
    """

    # authentication_classes = [JWTAuthentication]
    # permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            trabajador = Trabajador.objects.get(pk=pk)
        except Trabajador.DoesNotExist:
            return Response({"error": "Trabajador no encontrado"}, status=404)

        # Permitir solo al propio trabajador o a un admin
        # if not (request.user.is_staff or hasattr(request.user, 'trabajador') and request.user.trabajador.id == trabajador.id):
        #     return Response({"error": "No autorizado"}, status=403)

        servicios_ids = request.data.get("servicios", [])
        if not isinstance(servicios_ids, list):
            return Response(
                {"error": "El campo 'servicios' debe ser una lista de ids"}, status=400
            )

        servicios_qs = Servicio.objects.filter(id__in=servicios_ids)
        trabajador.servicios.set(servicios_qs)
        print(trabajador.servicios.all())
        return Response({"message": "Servicios elegidos correctamente"})


class UpdateDisponibilidadView(APIView):

    def post(self, request, pk):

        try:
            trabajador = Trabajador.objects.get(pk=pk)

        except Trabajador.DoesNotExist:

            return Response(
                {"error": "Trabajador no encontrado"},
                status=404
            )

        dias = request.data.get("dias", [])

        hora_inicio = request.data.get("hora_inicio")

        hora_fin = request.data.get("hora_fin")

        trabajador.dias_disponibles = dias

        trabajador.hora_inicio = hora_inicio

        trabajador.hora_fin = hora_fin

        trabajador.save()

        return Response({
            "message": "Disponibilidad guardada correctamente"
        })

class EliminarTrabajadorView(APIView):

    def delete(self, request, pk):

        try:

            trabajador = Trabajador.objects.get(pk=pk)

        except Trabajador.DoesNotExist:

            return Response({"error": "Trabajador no encontrado"}, status=404)

        # eliminar usuario relacionado
        trabajador.user.delete()

        return Response({"message": "Trabajador eliminado correctamente"})


class EliminarTrabajadoresMasivoView(APIView):
    def post(self, request):
        try:
            ids = request.data.get("ids", [])
            if not isinstance(ids, list):
                return Response({"error": "El campo 'ids' debe ser una lista"}, status=400)
            
            trabajadores = Trabajador.objects.filter(id__in=ids)
            deleted_count = 0
            for t in trabajadores:
                t.user.delete()
                deleted_count += 1
                
            return Response({"message": f"{deleted_count} trabajadores eliminados correctamente"}, status=200)
        except Exception as e:
            return Response({"error": f"Error al eliminar trabajadores: {str(e)}"}, status=500)



class LoginView(APIView):

    def post(self, request):
        correo = request.data.get("correo")
        password = request.data.get("password")

        user = authenticate(username=correo, password=password)

        if user is not None:
            tokens = get_tokens_for_user(user)

            # Obtener datos del Trabajador si existen
            trabajador_data = {}

            try:
                trabajador = Trabajador.objects.get(user=user)

                trabajador_data = {
                    "trabajador_id": trabajador.id,
                    "nombre": trabajador.nombre,
                    "apellidos": trabajador.apellidos,
                    "telefono": trabajador.telefono,
                }

            except Trabajador.DoesNotExist:

                trabajador_data = {
                    "nombre": user.first_name or correo.split("@")[0],
                    "apellidos": user.last_name or "",
                    "telefono": "",
                }

            return Response(
                {
                    "message": "Login exitoso",
                    "user_id": user.id,
                    "trabajador_id": trabajador_data.get("trabajador_id"),
                    "correo": user.username,
                    "tokens": tokens,
                    "is_staff": user.is_staff,
                    **trabajador_data,
                }
            )

        else:
            return Response({"error": "Credenciales incorrectas"}, status=400)

class ObtenerQRView(APIView):
    def get(self, request):
        origen = request.META.get('HTTP_ORIGIN', 'https://salonestilo.shop')
        resultado = QRService.obtener_o_generar_qr(origen)
        return Response(resultado)
