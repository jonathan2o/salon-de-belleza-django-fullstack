from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from citas.models import Trabajador


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


class LoginSerializer(serializers.Serializer):
    correo = serializers.CharField(required=False)
    username = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get("username") or attrs.get("correo")
        password = attrs.get("password")

        if not username or not password:
            raise serializers.ValidationError(
                "Debe proporcionar usuario/correo y contraseña."
            )

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("Credenciales incorrectas")

        if not user.is_active:
            raise serializers.ValidationError("Cuenta de usuario inactiva")

        attrs["user"] = user
        attrs["tokens"] = get_tokens_for_user(user)
        return attrs

    def get_auth_response_data(self):
        user = self.validated_data["user"]
        tokens = self.validated_data["tokens"]

        trabajador_data = {}
        try:
            trabajador = Trabajador.objects.get(user=user)
            trabajador_data = {
                "trabajador_id": trabajador.id,
                "nombre": trabajador.nombre,
                "apellidos": trabajador.apellidos,
                "telefono": trabajador.telefono,
                "permiso_contabilidad": trabajador.permiso_contabilidad,
            }
        except Trabajador.DoesNotExist:
            trabajador_data = {
                "trabajador_id": None,
                "nombre": user.first_name or user.username.split("@")[0],
                "apellidos": user.last_name or "",
                "telefono": "",
                "permiso_contabilidad": user.is_staff,
            }

        return {
            "message": "Login exitoso",
            "user_id": user.id,
            "correo": user.username,
            "tokens": tokens,
            "token": tokens,
            "is_staff": user.is_staff,
            **trabajador_data,
        }
