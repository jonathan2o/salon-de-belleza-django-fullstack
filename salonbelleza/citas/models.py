from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# Create your models here.


class Servicio(models.Model):
    nombre = models.CharField(max_length=100)
    # duración histórica en minutos (mantener compatibilidad)
    duracion = models.IntegerField(default=30)
    # número de bloques de 30 minutos que ocupa el servicio
    bloques = models.IntegerField(default=1)
    # precio del servicio
    precio = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return self.nombre


class Trabajador(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    nombre = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20)
    # Servicios que el trabajador puede realizar
    servicios = models.ManyToManyField(
        Servicio, blank=True, related_name="trabajadores"
    )
    correo = models.EmailField()

    dias_disponibles = models.JSONField(default=list, blank=True)

    hora_inicio = models.TimeField(null=True, blank=True)

    hora_fin = models.TimeField(null=True, blank=True)

    # Permiso para registrar servicios de contabilidad
    permiso_contabilidad = models.BooleanField(default=False)

    # Último ingreso (login) del trabajador, para estado de disponibilidad
    ultimo_ingreso = models.DateTimeField(null=True, blank=True)

    # Estado elegido manualmente en el perfil (persiste hasta cambiarlo).
    # null = automático (queda a la lógica de cita en curso / ingreso del día)
    ESTADO_MANUAL_CHOICES = [
        ("activo", "Activo"),
        ("descanso", "Descanso"),
        ("apagado", "Apagado"),
    ]
    estado_manual = models.CharField(
        max_length=10, choices=ESTADO_MANUAL_CHOICES, null=True, blank=True
    )

    # Día en que se fijó el estado manual: pasada la hora_fin de ese día
    # (o la medianoche si no tiene horario) el estado expira y hay que
    # activar de nuevo manualmente.
    estado_manual_fecha = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.nombre


class Cita(models.Model):
    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("confirmada", "Confirmada"),
        ("cancelada", "Cancelada"),
    ]
    ORIGEN_CHOICES = [
        ("cliente_manual", "Cliente Manual"),
        ("directo", "Directo"),
    ]

    nombre = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20)
    servicio = models.ForeignKey(Servicio, on_delete=models.CASCADE)
    trabajador = models.ForeignKey(Trabajador, on_delete=models.CASCADE)
    fecha = models.DateField()
    hora = models.TimeField()
    estado = models.CharField(
        max_length=20, choices=ESTADO_CHOICES, default="pendiente"
    )
    origen = models.CharField(
        max_length=20, choices=ORIGEN_CHOICES, default="cliente_manual"
    )
    creado_en = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return f"{self.nombre}-{self.servicio}-{self.fecha}-{self.hora} [{self.estado}]"


class CodigoQR(models.Model):
    url_destino = models.URLField(max_length=500)
    imagen_base64 = models.TextField()
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"QR Code -> {self.url_destino}"


class RegistroContabilidad(models.Model):
    trabajador = models.ForeignKey(
        Trabajador,
        on_delete=models.CASCADE,
        related_name="registros_contabilidad",
        help_text="Trabajador que realizó el servicio",
    )
    descripcion = models.CharField(max_length=255)
    cliente = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Nombre del cliente (opcional)",
    )
    cliente_telefono = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Teléfono del cliente (opcional)",
    )
    precio = models.DecimalField(max_digits=12, decimal_places=2)
    porcentaje_comision = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("50.00")
    )
    valor_comision = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    valor_salon = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    fecha = models.DateField(default=timezone.now)
    hora = models.TimeField(
        blank=True,
        null=True,
        help_text="Hora del servicio (opcional)",
    )

    # Auditoría / Trazabilidad
    creado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="servicios_contables_creados",
    )
    modificado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="servicios_contables_modificados",
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha", "-creado_en"]

    def save(self, *args, **kwargs):
        # Calcular con precisión decimal
        if self.precio is not None and self.porcentaje_comision is not None:
            self.valor_comision = round(
                Decimal(str(self.precio))
                * (Decimal(str(self.porcentaje_comision)) / Decimal("100.0")),
                2,
            )
            self.valor_salon = round(
                Decimal(str(self.precio)) - self.valor_comision, 2
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.fecha} - {self.trabajador.nombre}: {self.descripcion} (${self.precio})"

