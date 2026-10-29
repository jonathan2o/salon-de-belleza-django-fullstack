from rest_framework import serializers
from citas.models import Cita


class CitaSerializer(serializers.ModelSerializer):
    servicio_nombre = serializers.ReadOnlyField(source="servicio.nombre")
    servicio_precio = serializers.ReadOnlyField(source="servicio.precio")
    servicio_duracion = serializers.ReadOnlyField(source="servicio.duracion")
    trabajador_nombre = serializers.ReadOnlyField(source="trabajador.nombre")

    class Meta:
        model = Cita
        fields = "__all__"

    def validate(self, data):
        trabajador = data.get("trabajador")
        servicio = data.get("servicio")

        if trabajador and servicio:
            if servicio not in trabajador.servicios.all():
                raise serializers.ValidationError(
                    {"servicio": "El trabajador no ofrece ese servicio"}
                )

        return data
