from rest_framework import serializers
from django.contrib.auth.models import User
from django.db import transaction
from citas.models import Trabajador, Servicio
from .servicio_serializers import ServicioSerializer


class TrabajadorSerializer(serializers.ModelSerializer):
    servicios = ServicioSerializer(many=True, read_only=True)
    estado = serializers.SerializerMethodField()
    hora_ingreso = serializers.SerializerMethodField()

    class Meta:
        model = Trabajador
        fields = (
            "id",
            "nombre",
            "apellidos",
            "telefono",
            "correo",
            "servicios",
            "dias_disponibles",
            "hora_inicio",
            "hora_fin",
            "permiso_contabilidad",
            "estado",
            "hora_ingreso",
            "estado_manual",
        )

    def get_estado(self, obj) -> str:
        from citas.services.estado_service import calcular_estado
        return calcular_estado(obj)

    def get_hora_ingreso(self, obj) -> str:
        from citas.services.estado_service import ingreso_hoy
        if obj.ultimo_ingreso and ingreso_hoy(obj):
            return obj.ultimo_ingreso.strftime("%H:%M")
        return ""


class TrabajadorCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Trabajador
        fields = (
            "id",
            "nombre",
            "apellidos",
            "telefono",
            "correo",
            "password",
        )

    def validate_correo(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este correo")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        correo = validated_data["correo"]

        with transaction.atomic():
            user = User.objects.create_user(
                username=correo,
                email=correo,
                password=password,
                first_name=validated_data.get("nombre", ""),
                last_name=validated_data.get("apellidos", ""),
            )
            trabajador = Trabajador.objects.create(user=user, **validated_data)
        return trabajador


class TrabajadorServiciosSerializer(serializers.Serializer):
    servicios = serializers.PrimaryKeyRelatedField(
        queryset=Servicio.objects.all(), many=True
    )


class TrabajadorDisponibilidadSerializer(serializers.ModelSerializer):
    dias_disponibles = serializers.ListField(
        child=serializers.CharField(), required=False
    )

    class Meta:
        model = Trabajador
        fields = ("dias_disponibles", "hora_inicio", "hora_fin")
