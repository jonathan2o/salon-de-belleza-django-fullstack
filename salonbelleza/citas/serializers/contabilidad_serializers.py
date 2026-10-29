from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from citas.models import RegistroContabilidad, Trabajador


class RegistroContabilidadSerializer(serializers.ModelSerializer):
    trabajador_nombre = serializers.SerializerMethodField()
    creado_por_nombre = serializers.SerializerMethodField()
    modificado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = RegistroContabilidad
        fields = (
            "id",
            "trabajador",
            "trabajador_nombre",
            "descripcion",
            "cliente",
            "cliente_telefono",
            "precio",
            "porcentaje_comision",
            "valor_comision",
            "valor_salon",
            "fecha",
            "hora",
            "creado_por",
            "creado_por_nombre",
            "modificado_por",
            "modificado_por_nombre",
            "creado_en",
            "actualizado_en",
        )
        read_only_fields = (
            "id",
            "valor_comision",
            "valor_salon",
            "creado_por",
            "creado_por_nombre",
            "modificado_por",
            "modificado_por_nombre",
            "creado_en",
            "actualizado_en",
        )

    def get_trabajador_nombre(self, obj) -> str:
        if obj.trabajador:
            return f"{obj.trabajador.nombre} {obj.trabajador.apellidos}".strip()
        return "Desconocido"

    def get_creado_por_nombre(self, obj) -> str:
        if obj.creado_por:
            first = obj.creado_por.first_name
            last = obj.creado_por.last_name
            if first or last:
                return f"{first} {last}".strip()
            return obj.creado_por.username
        return "Sistema"

    def get_modificado_por_nombre(self, obj) -> str:
        if obj.modificado_por:
            first = obj.modificado_por.first_name
            last = obj.modificado_por.last_name
            if first or last:
                return f"{first} {last}".strip()
            return obj.modificado_por.username
        return ""


class RegistroContabilidadCreateUpdateSerializer(serializers.ModelSerializer):
    trabajador = serializers.PrimaryKeyRelatedField(
        queryset=Trabajador.objects.all(), required=True
    )
    descripcion = serializers.CharField(max_length=255, required=True)
    cliente = serializers.CharField(
        max_length=100, required=False, allow_blank=True, allow_null=True
    )
    cliente_telefono = serializers.CharField(
        max_length=20, required=False, allow_blank=True, allow_null=True
    )
    hora = serializers.TimeField(required=False, allow_null=True)
    precio = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=True
    )
    porcentaje_comision = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.00"),
        max_value=Decimal("100.00"),
        default=Decimal("50.00"),
        required=False,
    )
    fecha = serializers.DateField(default=timezone.localdate, required=False)

    class Meta:
        model = RegistroContabilidad
        fields = (
            "id",
            "trabajador",
            "descripcion",
            "cliente",
            "cliente_telefono",
            "precio",
            "porcentaje_comision",
            "fecha",
            "hora",
        )
        read_only_fields = ("id",)

    def validate_descripcion(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("La descripción no puede estar vacía.")
        return val

    def validate_cliente_telefono(self, value):
        if value is None:
            return None
        val = value.strip()
        if not val:
            return None
        if len(val) < 5 or not any(ch.isdigit() for ch in val):
            raise serializers.ValidationError("El teléfono no es válido.")
        return val
