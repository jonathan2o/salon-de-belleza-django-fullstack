from django.contrib import admin
from .models import Servicio ,Cita,Trabajador, RegistroContabilidad
# Register your models here.

admin.site.register(Servicio)
admin.site.register(Cita)
admin.site.register(Trabajador)


@admin.register(RegistroContabilidad)
class RegistroContabilidadAdmin(admin.ModelAdmin):
    list_display = (
        "fecha", "trabajador", "descripcion", "precio",
        "porcentaje_comision", "valor_comision", "valor_salon",
        "creado_por",
    )
    list_filter = ("fecha", "trabajador")
    search_fields = ("descripcion", "trabajador__nombre", "trabajador__apellidos")
    readonly_fields = ("valor_comision", "valor_salon", "creado_en", "actualizado_en")
    date_hierarchy = "fecha"

