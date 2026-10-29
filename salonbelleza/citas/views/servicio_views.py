from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from citas.models import Servicio
from citas.serializers.servicio_serializers import ServicioSerializer


class ServicioListView(generics.ListCreateAPIView):
    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer


class ServicioDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Servicio.objects.all()
    serializer_class = ServicioSerializer


class CategoriaUpdateView(APIView):
    def post(self, request):
        old_name = request.data.get("old_name", "").strip()
        new_name = request.data.get("new_name", "").strip()
        if not old_name or not new_name:
            return Response(
                {"error": "Ambos nombres son obligatorios"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            servicios = Servicio.objects.filter(nombre__startswith=f"{old_name} - ")
            updated_count = 0
            for s in servicios:
                s.nombre = s.nombre.replace(f"{old_name} - ", f"{new_name} - ", 1)
                s.save()
                updated_count += 1

            exact_servicios = Servicio.objects.filter(nombre=old_name)
            for s in exact_servicios:
                s.nombre = new_name
                s.save()
                updated_count += 1

            return Response(
                {
                    "message": f"Categoría modificada. {updated_count} servicios actualizados."
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": f"Error al modificar la categoría: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CategoriaDeleteView(APIView):
    def post(self, request):
        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {"error": "El nombre es obligatorio"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            deleted_count, _ = Servicio.objects.filter(
                nombre__startswith=f"{name} - "
            ).delete()
            deleted_exact, _ = Servicio.objects.filter(nombre=name).delete()

            return Response(
                {
                    "message": f"Categoría eliminada. {deleted_count + deleted_exact} servicios eliminados."
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": f"Error al eliminar la categoría: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
