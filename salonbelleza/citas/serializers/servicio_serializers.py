import math
from rest_framework import serializers
from citas.models import Servicio
from citas.services.disponibilidad_service import BLOCK_MINUTES


class ServicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicio
        fields = ("id", "nombre", "precio", "duracion", "bloques")

    def create(self, validated_data):
        bloques = validated_data.get("bloques", 1)
        validated_data["duracion"] = int(bloques) * BLOCK_MINUTES
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "bloques" in validated_data:
            validated_data["duracion"] = int(validated_data["bloques"]) * BLOCK_MINUTES
        elif "duracion" in validated_data:
            validated_data["bloques"] = max(
                1, math.ceil(int(validated_data["duracion"]) / BLOCK_MINUTES)
            )
        return super().update(instance, validated_data)
