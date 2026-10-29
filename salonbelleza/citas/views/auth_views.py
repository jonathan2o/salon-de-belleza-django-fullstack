from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from citas.serializers.auth_serializers import LoginSerializer


class AdminLoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            if user.is_staff:
                # Respuesta completa para que el frontend arme la sesión
                # (mismo formato que LoginView + mensaje de éxito admin)
                data = serializer.get_auth_response_data()
                data["message"] = "Login admin exitoso"
                return Response(data, status=status.HTTP_200_OK)
            return Response(
                {"error": "Acceso denegado: se requieren permisos de administrador"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(
            {"error": "Credenciales inválidas"},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class TrabajadorLoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            if not user.is_staff:
                tokens = serializer.validated_data["tokens"]
                return Response(
                    {"token": tokens, "message": "Login trabajador exitoso"},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"error": "Acceso denegado para perfil administrativo en este endpoint"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(
            {"error": "Credenciales inválidas"},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.get_auth_response_data()
            return Response(data, status=status.HTTP_200_OK)
        return Response(
            {"error": "Credenciales incorrectas"},
            status=status.HTTP_400_BAD_REQUEST,
        )
