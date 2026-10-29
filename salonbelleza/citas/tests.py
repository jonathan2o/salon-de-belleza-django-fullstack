"""
Pruebas para el módulo de contabilidad de BARBER PRO.
Cubre: permisos, creación, consulta por quincena, seguridad y cálculos.
"""
from decimal import Decimal
from datetime import date, time as dt_time, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from citas.models import Servicio, Trabajador, RegistroContabilidad, Cita


def _hora_cita_en_curso(now):
    """Hora (TimeField) de una cita que esté en curso AHORA, robusta a medianoche:
    si restar 15 min cruza el día, la cita empieza a las 00:00 (sigue en curso)."""
    inicio = now - timedelta(minutes=15)
    if inicio.date() != now.date():
        return dt_time(0, 0)
    return inicio.time().replace(microsecond=0)


def _hora_fin_ya_pasada(now):
    """Hora_fin de HOY que ya venció, robusta a los primeros minutos del día."""
    fin = now - timedelta(minutes=30)
    if fin.date() == now.date():
        return fin.time().replace(microsecond=0)
    return (now - timedelta(seconds=10)).time().replace(microsecond=0)


def _atras_mismo_dia(now, minutos):
    """Datetime de hace ~'minutos' que pertenezca al mismo día que now."""
    for m in (minutos, min(minutos, 1)):
        if m <= 0:
            continue
        candidato = now - timedelta(minutes=m)
        if candidato.date() == now.date():
            return candidato
    return now - timedelta(seconds=1)


def get_jwt(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class ContabilidadSetupMixin:
    def setUp(self):
        # Admin
        self.admin_user = User.objects.create_superuser(
            username="admin@test.com", password="admin123", email="admin@test.com",
            is_staff=True,
        )
        # Trabajador con permiso
        self.user_con_permiso = User.objects.create_user(
            username="trabajador1@test.com", password="pass123"
        )
        self.trabajador_con_permiso = Trabajador.objects.create(
            user=self.user_con_permiso,
            nombre="Juan", apellidos="Pérez", telefono="3001234567",
            correo="trabajador1@test.com", permiso_contabilidad=True,
        )
        # Trabajador sin permiso
        self.user_sin_permiso = User.objects.create_user(
            username="trabajador2@test.com", password="pass123"
        )
        self.trabajador_sin_permiso = Trabajador.objects.create(
            user=self.user_sin_permiso,
            nombre="Ana", apellidos="Gómez", telefono="3009876543",
            correo="trabajador2@test.com", permiso_contabilidad=False,
        )
        self.client = APIClient()


class TestPermisoContabilidad(ContabilidadSetupMixin, TestCase):
    """Pruebas para endpoint de permiso de contabilidad."""

    def test_admin_puede_conceder_permiso(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        url = f"/api/trabajadores/{self.trabajador_sin_permiso.id}/permiso-contabilidad/"
        res = self.client.patch(url, {"permiso_contabilidad": True}, format="json")
        self.assertEqual(res.status_code, 200)
        self.trabajador_sin_permiso.refresh_from_db()
        self.assertTrue(self.trabajador_sin_permiso.permiso_contabilidad)

    def test_admin_puede_retirar_permiso(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        url = f"/api/trabajadores/{self.trabajador_con_permiso.id}/permiso-contabilidad/"
        res = self.client.patch(url, {"permiso_contabilidad": False}, format="json")
        self.assertEqual(res.status_code, 200)
        self.trabajador_con_permiso.refresh_from_db()
        self.assertFalse(self.trabajador_con_permiso.permiso_contabilidad)

    def test_trabajador_no_puede_cambiar_permiso(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        url = f"/api/trabajadores/{self.trabajador_sin_permiso.id}/permiso-contabilidad/"
        res = self.client.patch(url, {"permiso_contabilidad": True}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_no_autenticado_rechazado(self):
        self.client.credentials()
        url = f"/api/trabajadores/{self.trabajador_sin_permiso.id}/permiso-contabilidad/"
        res = self.client.patch(url, {"permiso_contabilidad": True}, format="json")
        self.assertIn(res.status_code, [401, 403])


class TestRegistroContabilidad(ContabilidadSetupMixin, TestCase):
    """Pruebas para crear y listar registros de contabilidad."""

    def _payload(self, trabajador_id=None, precio="50000", porcentaje="50"):
        return {
            "trabajador": trabajador_id or self.trabajador_con_permiso.id,
            "descripcion": "Corte de cabello",
            "precio": precio,
            "porcentaje_comision": porcentaje,
            "fecha": str(date.today()),
        }

    def test_trabajador_autorizado_puede_crear(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/", self._payload(), format="json"
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["precio"], "50000.00")
        self.assertEqual(data["porcentaje_comision"], "50.00")
        self.assertEqual(data["valor_comision"], "25000.00")
        self.assertEqual(data["valor_salon"], "25000.00")

    def test_trabajador_sin_permiso_no_puede_crear(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_sin_permiso)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/", self._payload(), format="json"
        )
        self.assertEqual(res.status_code, 403)

    def test_admin_puede_crear(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.post(
            "/api/contabilidad/registros/", self._payload(), format="json"
        )
        self.assertEqual(res.status_code, 201)

    def test_no_autenticado_no_puede_crear(self):
        self.client.credentials()
        res = self.client.post(
            "/api/contabilidad/registros/", self._payload(), format="json"
        )
        self.assertIn(res.status_code, [401, 403])

    def test_calculo_comision_correcto(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.post(
            "/api/contabilidad/registros/",
            self._payload(precio="100000", porcentaje="30"),
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["valor_comision"], "30000.00")
        self.assertEqual(data["valor_salon"], "70000.00")

    def test_trabajador_solo_ve_sus_registros(self):
        """Trabajador con permiso solo ve sus propios registros."""
        # Crear registro propio
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Corte", precio=Decimal("40000"),
            porcentaje_comision=Decimal("50"),
            fecha=date.today(), creado_por=self.user_con_permiso,
        )
        # Crear registro de otro trabajador (como admin)
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_sin_permiso,
            descripcion="Manicure", precio=Decimal("30000"),
            porcentaje_comision=Decimal("50"),
            fecha=date.today(), creado_por=self.admin_user,
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.get("/api/contabilidad/registros/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Solo debe ver sus propios registros
        for r in data:
            self.assertEqual(r["trabajador"], self.trabajador_con_permiso.id)


class TestEliminarEditar(ContabilidadSetupMixin, TestCase):
    """Solo el administrador puede editar y eliminar registros."""

    def setUp(self):
        super().setUp()
        self.registro = RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Tinte", precio=Decimal("80000"),
            porcentaje_comision=Decimal("50"),
            fecha=date.today(), creado_por=self.user_con_permiso,
        )

    def test_trabajador_no_puede_eliminar(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.delete(f"/api/contabilidad/registros/{self.registro.id}/")
        self.assertEqual(res.status_code, 403)

    def test_admin_puede_eliminar(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.delete(f"/api/contabilidad/registros/{self.registro.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(RegistroContabilidad.objects.filter(id=self.registro.id).exists())

    def test_admin_puede_editar(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.patch(
            f"/api/contabilidad/registros/{self.registro.id}/",
            {"descripcion": "Tinte complejo", "precio": "90000", "porcentaje_comision": "40"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.registro.refresh_from_db()
        self.assertEqual(self.registro.descripcion, "Tinte complejo")
        self.assertEqual(self.registro.precio, Decimal("90000"))
        self.assertEqual(self.registro.valor_comision, Decimal("36000.00"))

    def test_trabajador_no_puede_editar(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.patch(
            f"/api/contabilidad/registros/{self.registro.id}/",
            {"descripcion": "Hack"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)


class TestResumenYQuincenas(ContabilidadSetupMixin, TestCase):
    """Pruebas para el resumen administrativo y las quincenas."""

    def setUp(self):
        super().setUp()
        # Registros en 1ra quincena de octubre 2026
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Corte", precio=Decimal("50000"),
            porcentaje_comision=Decimal("50"),
            fecha=date(2026, 10, 5), creado_por=self.admin_user,
        )
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_sin_permiso,
            descripcion="Manicure", precio=Decimal("30000"),
            porcentaje_comision=Decimal("40"),
            fecha=date(2026, 10, 10), creado_por=self.admin_user,
        )
        # Registro en 2da quincena
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Tinte", precio=Decimal("80000"),
            porcentaje_comision=Decimal("50"),
            fecha=date(2026, 10, 20), creado_por=self.admin_user,
        )

    def test_resumen_trabajador_sin_permiso_ve_solo_suyo(self):
        """Cualquier trabajador autenticado ve su propio resumen (sin permiso de contabilidad)."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_sin_permiso)}"
        )
        res = self.client.get("/api/contabilidad/resumen/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        total = float(data["totales_globales"]["total_precio"])
        # Ana: Manicure 30000 (Q1) = 30000
        self.assertAlmostEqual(total, 30000.0, places=0)
        self.assertEqual(data["totales_globales"]["num_servicios"], 1)
        ids = [row["trabajador_id"] for row in data["por_trabajador"]]
        self.assertEqual(ids, [self.trabajador_sin_permiso.id])
        # No debe ver registros de Juan
        nombres = [row["trabajador_nombre"] for row in data["por_trabajador"]]
        self.assertTrue(all("Juan" not in str(n) for n in nombres))

    def test_resumen_trabajador_con_permiso_ve_solo_suyo(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.get("/api/contabilidad/resumen/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        total = float(data["totales_globales"]["total_precio"])
        # Juan: 50000 (Q1) + 80000 (Q2) = 130000
        self.assertAlmostEqual(total, 130000.0, places=0)
        self.assertEqual(data["totales_globales"]["num_servicios"], 2)
        # Solo debe aparecer Juan en por_trabajador
        ids = [row["trabajador_id"] for row in data["por_trabajador"]]
        self.assertEqual(ids, [self.trabajador_con_permiso.id])

    def test_resumen_trabajador_filtro_quincena_ve_solo_suyo(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.get(
            "/api/contabilidad/resumen/?year=2026&month=10&quincena=1"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        total = float(data["totales_globales"]["total_precio"])
        self.assertAlmostEqual(total, 50000.0, places=0)
        self.assertEqual(data["totales_globales"]["num_servicios"], 1)
        ids = [row["trabajador_id"] for row in data["por_trabajador"]]
        self.assertEqual(ids, [self.trabajador_con_permiso.id])
        # No debe ver datos de Manicure (trabajador_sin_permiso)
        nombres = [row["trabajador_nombre"] for row in data["por_trabajador"]]
        self.assertTrue(all("NO PERMITIDO" not in str(n).upper() for n in nombres))

    def test_resumen_global(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get("/api/contabilidad/resumen/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        total = float(data["totales_globales"]["total_precio"])
        self.assertAlmostEqual(total, 160000.0, places=0)
        self.assertEqual(data["totales_globales"]["num_servicios"], 3)

    def test_resumen_filtro_quincena(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get(
            "/api/contabilidad/resumen/?year=2026&month=10&quincena=1"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["totales_globales"]["num_servicios"], 2)

    def test_resumen_filtro_mes_completo(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get(
            "/api/contabilidad/resumen/?year=2026&month=10&quincena=0"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Mes completo: 3 registros (Corte 50k + Manicure 30k + Tinte 80k)
        self.assertEqual(data["totales_globales"]["num_servicios"], 3)
        self.assertAlmostEqual(
            float(data["totales_globales"]["total_precio"]), 160000.0, places=0
        )

    def test_quincena_invalida_rechazada(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get(
            "/api/contabilidad/resumen/?year=2026&month=10&quincena=3"
        )
        self.assertEqual(res.status_code, 400)

    def test_quincenas_disponibles_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get("/api/contabilidad/quincenas/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Debe haber 2 quincenas (Q1 y Q2 de octubre 2026)
        labels = [q["label"] for q in data]
        self.assertTrue(any("1ra" in l for l in labels))
        self.assertTrue(any("2da" in l for l in labels))

    def test_quincenas_trabajador_solo_ve_las_suyas(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.get("/api/contabilidad/quincenas/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Juan tiene registros en Q1 y Q2
        self.assertEqual(len(data), 2)
        for q in data:
            # Todos deben tener total correspondiente a Juan
            self.assertGreater(float(q["total_precio"]), 0)


class TestHistorialServicios(TestResumenYQuincenas, TestCase):
    """GET /api/contabilidad/historial/: dueño propio, orden por fecha y campo cliente."""

    def test_filtro_quincena_trabajador(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.get(
            "/api/contabilidad/historial/?year=2026&month=10&quincena=1"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Juan solo tiene "Corte" (5-oct, Q1); "Tinte" (20-oct) es Q2
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["descripcion"], "Corte")

    def test_filtro_quincena_admin_con_trabajador(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}"
        )
        res = self.client.get(
            f"/api/contabilidad/historial/?trabajador={self.trabajador_con_permiso.id}"
            "&year=2026&month=10&quincena=2"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["descripcion"], "Tinte")

    def test_filtro_invalido_rechazado(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}"
        )
        res = self.client.get(
            "/api/contabilidad/historial/?year=abc&month=10&quincena=1"
        )
        self.assertEqual(res.status_code, 400)

    def test_filtro_mes_completo(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}"
        )
        res = self.client.get(
            f"/api/contabilidad/historial/?trabajador={self.trabajador_con_permiso.id}"
            "&year=2026&month=10&quincena=0"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Juan: Corte (Q1) + Tinte (Q2) = mes completo
        self.assertEqual(
            sorted(d["descripcion"] for d in data), ["Corte", "Tinte"]
        )

    def test_trabajador_ve_solo_suyo_ordenado(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.get("/api/contabilidad/historial/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Juan: Corte (5-oct) y Tinte (20-oct), en fecha descendente
        self.assertEqual(len(data), 2)
        self.assertEqual(
            [d["descripcion"] for d in data],
            ["Tinte", "Corte"],
        )
        for d in data:
            self.assertIn("cliente", d)
            self.assertIn("porcentaje_comision", d)
            self.assertIn("ganancia", d)
            self.assertIn("fecha", d)
            self.assertIn("quincena", d)

    def test_trabajador_sin_permiso_ve_solo_suyo(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_sin_permiso)}"
        )
        res = self.client.get("/api/contabilidad/historial/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Ana: solo Manicure; no ve registros de Juan
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["descripcion"], "Manicure")

    def test_admin_filtro_trabajador(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}"
        )
        res = self.client.get(
            f"/api/contabilidad/historial/?trabajador={self.trabajador_con_permiso.id}"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Solo registros de Juan; Ana no aparece
        self.assertEqual(len(data), 2)
        descripciones = [d["descripcion"] for d in data]
        self.assertIn("Corte", descripciones)
        self.assertIn("Tinte", descripciones)
        self.assertNotIn("Manicure", descripciones)

    def test_creacion_con_cliente(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/",
            {
                "trabajador": self.trabajador_con_permiso.id,
                "descripcion": "Peinado",
                "cliente": "Laura G",
                "precio": "45000",
                "porcentaje_comision": "50",
                "fecha": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        registro = RegistroContabilidad.objects.get(id=res.json()["id"])
        self.assertEqual(registro.cliente, "Laura G")

    def test_creacion_sin_cliente_queda_vacio(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/",
            {
                "trabajador": self.trabajador_con_permiso.id,
                "descripcion": "Sin cliente",
                "precio": "45000",
                "porcentaje_comision": "50",
                "fecha": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        registro = RegistroContabilidad.objects.get(id=res.json()["id"])
        self.assertIn(registro.cliente, (None, ""))

    def test_creacion_con_hora_y_telefono(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/",
            {
                "trabajador": self.trabajador_con_permiso.id,
                "descripcion": "Corte con hora",
                "cliente": "María",
                "cliente_telefono": "3134346983",
                "hora": "14:30",
                "precio": "50000",
                "porcentaje_comision": "50",
                "fecha": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        registro = RegistroContabilidad.objects.get(id=res.json()["id"])
        self.assertEqual(registro.cliente_telefono, "3134346983")
        self.assertEqual(str(registro.hora), "14:30:00")

    def test_telefono_invalido_rechazado(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/",
            {
                "trabajador": self.trabajador_con_permiso.id,
                "descripcion": "Teléfono malo",
                "cliente_telefono": "abc",
                "precio": "50000",
                "porcentaje_comision": "50",
                "fecha": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_historial_incluye_hora_y_telefono(self):
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Corte con detalles",
            cliente="María",
            cliente_telefono="3134346983",
            hora="14:30",
            precio=Decimal("50000"),
            porcentaje_comision=Decimal("50"),
            fecha=date(2026, 10, 6), creado_por=self.admin_user,
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}"
        )
        res = self.client.get(
            f"/api/contabilidad/historial/?trabajador={self.trabajador_con_permiso.id}"
        )
        self.assertEqual(res.status_code, 200)
        item = next(
            d for d in res.json() if d["descripcion"] == "Corte con detalles"
        )
        self.assertEqual(item["hora"], "14:30:00")
        self.assertEqual(item["cliente_telefono"], "3134346983")

    def test_patch_actualiza_hora_telefono(self):
        registro = RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Corte", precio=Decimal("50000"),
            porcentaje_comision=Decimal("50"),
            fecha=date.today(), creado_por=self.admin_user,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.patch(
            f"/api/contabilidad/registros/{registro.id}/",
            {"hora": "09:45", "cliente": "Pedro", "cliente_telefono": "3007778899"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        registro.refresh_from_db()
        self.assertEqual(str(registro.hora), "09:45:00")
        self.assertEqual(registro.cliente, "Pedro")
        self.assertEqual(registro.cliente_telefono, "3007778899")

    def test_patch_trabajador_rechazado(self):
        registro = RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Corte", precio=Decimal("50000"),
            porcentaje_comision=Decimal("50"),
            fecha=date.today(), creado_por=self.admin_user,
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.patch(
            f"/api/contabilidad/registros/{registro.id}/",
            {"hora": "09:45"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)


class TestSeguridadYAuditoria(ContabilidadSetupMixin, TestCase):
    """Seguridad: sin cross-trabajador, auditoría y validación de filtros."""

    def test_trabajador_autorizado_puede_registrar_a_otro_nombre(self):
        """Con permiso, puede registrar servicios realizados por otro trabajador."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/",
            {
                "trabajador": self.trabajador_sin_permiso.id,
                "descripcion": "Corte ajeno",
                "precio": "50000",
                "porcentaje_comision": "50",
                "fecha": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        registro = RegistroContabilidad.objects.get(id=res.json()["id"])
        self.assertEqual(registro.trabajador, self.trabajador_sin_permiso)
        self.assertEqual(registro.creado_por, self.user_con_permiso)

    def test_trabajador_sin_permiso_no_ve_detalle(self):
        """Sin permiso_contabilidad no puede ver ni su propio detalle por pk."""
        registro = RegistroContabilidad.objects.create(
            trabajador=self.trabajador_sin_permiso,
            descripcion="Corte", precio=Decimal("40000"),
            porcentaje_comision=Decimal("50"),
            fecha=date.today(), creado_por=self.admin_user,
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_sin_permiso)}"
        )
        res = self.client.get(f"/api/contabilidad/registros/{registro.id}/")
        self.assertEqual(res.status_code, 403)

    def test_creado_por_se_registra(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.user_con_permiso)}"
        )
        res = self.client.post(
            "/api/contabilidad/registros/",
            {
                "trabajador": self.trabajador_con_permiso.id,
                "descripcion": "Corte", "precio": "50000",
                "porcentaje_comision": "50", "fecha": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        registro = RegistroContabilidad.objects.get(id=res.json()["id"])
        self.assertEqual(registro.creado_por, self.user_con_permiso)

    def test_modificado_por_se_registra(self):
        registro = RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Corte", precio=Decimal("50000"),
            porcentaje_comision=Decimal("50"),
            fecha=date.today(), creado_por=self.user_con_permiso,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.patch(
            f"/api/contabilidad/registros/{registro.id}/",
            {"descripcion": "Corte editado"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        registro.refresh_from_db()
        self.assertEqual(registro.modificado_por, self.admin_user)
        self.assertEqual(registro.creado_por, self.user_con_permiso)

    def test_porcentaje_por_defecto_50(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.post(
            "/api/contabilidad/registros/",
            {
                "trabajador": self.trabajador_con_permiso.id,
                "descripcion": "Corte sin porcentaje",
                "precio": "60000",
                "fecha": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["porcentaje_comision"], "50.00")
        self.assertEqual(data["valor_comision"], "30000.00")

    def test_filtro_rango_fechas(self):
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Viejo", precio=Decimal("10000"),
            porcentaje_comision=Decimal("50"),
            fecha=date(2026, 9, 1), creado_por=self.admin_user,
        )
        RegistroContabilidad.objects.create(
            trabajador=self.trabajador_con_permiso,
            descripcion="Nuevo", precio=Decimal("20000"),
            porcentaje_comision=Decimal("50"),
            fecha=date(2026, 10, 10), creado_por=self.admin_user,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get(
            "/api/contabilidad/registros/?fecha_desde=2026-10-01&fecha_hasta=2026-10-31"
        )
        self.assertEqual(res.status_code, 200)
        descripciones = [r["descripcion"] for r in res.json()]
        self.assertEqual(descripciones, ["Nuevo"])

    def test_filtro_fecha_invalida_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get("/api/contabilidad/registros/?fecha_desde=no-fecha")
        self.assertEqual(res.status_code, 400)

    def test_filtro_quincena_invalida_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        res = self.client.get("/api/contabilidad/resumen/?year=2026&month=13&quincena=1")
        self.assertEqual(res.status_code, 400)
        res = self.client.get("/api/contabilidad/resumen/?year=2026&month=10&quincena=3")
        self.assertEqual(res.status_code, 400)

    def test_permiso_valor_invalido_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(self.admin_user)}")
        url = f"/api/trabajadores/{self.trabajador_con_permiso.id}/permiso-contabilidad/"
        res = self.client.patch(url, {"permiso_contabilidad": "quizas"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_login_incluye_permiso_contabilidad(self):
        """El login informa el permiso para que el frontend lo use."""
        res = self.client.post(
            "/api/login/",
            {"username": "trabajador1@test.com", "password": "pass123"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["permiso_contabilidad"])
        res = self.client.post(
            "/api/login/",
            {"username": "trabajador2@test.com", "password": "pass123"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["permiso_contabilidad"])


class TestEstadoTrabajador(TestCase):
    """Estado de disponibilidad: ingreso (activación) y estados en tiempo real."""

    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin@test.com", password="admin123"
        )
        self.user = User.objects.create_user(
            username="flor@test.com", password="pass123"
        )
        self.trabajador = Trabajador.objects.create(
            user=self.user,
            nombre="Flor", apellidos="Meléndez", telefono="3000000000",
            correo="flor@test.com",
        )
        self.otro_user = User.objects.create_user(
            username="otro@test.com", password="pass123"
        )
        self.otro_trabajador = Trabajador.objects.create(
            user=self.otro_user,
            nombre="Otro", apellidos="Trabajador", telefono="3011111111",
            correo="otro@test.com",
        )
        self.client = APIClient()

    def _login(self, user, password="pass123"):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_jwt(user)}")

    def test_ingreso_registrado_con_hora(self):
        self._login(self.user)
        res = self.client.post(f"/api/trabajadores/{self.trabajador.id}/ingreso/")
        self.assertEqual(res.status_code, 200)
        self.trabajador.refresh_from_db()
        self.assertIsNotNone(self.trabajador.ultimo_ingreso)
        self.assertEqual(res.json()["estado"], "activo")

    def test_ingreso_otro_no_autorizado(self):
        self._login(self.otro_user)
        res = self.client.post(f"/api/trabajadores/{self.trabajador.id}/ingreso/")
        self.assertEqual(res.status_code, 403)

    def test_ingreso_admin_autorizado(self):
        self._login(self.admin_user, "admin123")
        res = self.client.post(f"/api/trabajadores/{self.trabajador.id}/ingreso/")
        self.assertEqual(res.status_code, 200)

    def test_estado_sin_ingreso(self):
        """Sin ingreso hoy → 'sin servicio' (aún sin citas)."""
        self.client.credentials()
        res = self.client.get("/api/trabajadores/")
        data = res.json()
        flor = next(t for t in data if t["id"] == self.trabajador.id)
        self.assertEqual(flor["estado"], "sin servicio")
        self.assertEqual(flor["hora_ingreso"], "")

    def test_estado_ocupado_con_cita_en_curso(self):
        """Turno con cita en curso → 'ocupado' aunque haya ingreso."""
        now = timezone.now()
        self.trabajador.ultimo_ingreso = now
        self.trabajador.save()
        servicio = Servicio.objects.create(
            nombre="Rasurado", duracion=60, bloques=2, precio=15000
        )
        Cita.objects.create(
            nombre="Cliente", telefono="3000", trabajador=self.trabajador,
            servicio=servicio,
            fecha=now.date(),
            hora=_hora_cita_en_curso(now),
        )
        self.client.credentials()
        res = self.client.get("/api/trabajadores/")
        flor = next(t for t in res.json() if t["id"] == self.trabajador.id)
        self.assertEqual(flor["estado"], "ocupado")

    def test_ingresos_solo_admin(self):
        self.trabajador.ultimo_ingreso = timezone.now()
        self.trabajador.save()
        self._login(self.user)
        res = self.client.get("/api/trabajadores/ingresos/")
        self.assertEqual(res.status_code, 403)
        self._login(self.admin_user, "admin123")
        res = self.client.get("/api/trabajadores/ingresos/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)


class TestEstadoManualTrabajador(TestEstadoTrabajador):
    """Estados manuales del trabajador: activo | descanso | apagado."""

    def _patch(self, estado=None, **kw):
        payload = {} if estado is None else {"estado": estado}
        return self.client.patch(
            f"/api/trabajadores/{self.trabajador.id}/estado/",
            data=payload,
            content_type="application/json",
        )

    def test_manual_activo_registra_ingreso(self):
        self._login(self.user)
        res = self._patch("activo")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["estado_manual"], "activo")
        self.assertEqual(data["estado"], "activo")
        self.assertNotEqual(data["hora_ingreso"], "")
        self.trabajador.refresh_from_db()
        self.assertIsNotNone(self.trabajador.ultimo_ingreso)

    def test_manual_descanso_gana_a_ocupado(self):
        """Descanso manual se ve aunque haya cita en curso (manual gana siempre)."""
        now = timezone.now()
        self.trabajador.ultimo_ingreso = now
        self.trabajador.save()
        servicio = Servicio.objects.create(
            nombre="Rasurado", duracion=60, bloques=2, precio=15000
        )
        Cita.objects.create(
            nombre="Cliente", telefono="3000", trabajador=self.trabajador,
            servicio=servicio, fecha=now.date(),
            hora=_hora_cita_en_curso(now),
        )
        self._login(self.user)
        res = self._patch("descanso")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["estado"], "descanso")

    def test_manual_apagado_no_registra_ingreso(self):
        self._login(self.user)
        res = self._patch("apagado")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["estado"], "apagado")
        self.assertEqual(res.json()["hora_ingreso"], "")
        self.trabajador.refresh_from_db()
        self.assertIsNone(self.trabajador.ultimo_ingreso)

    def test_manual_activo_no_sobreescribe_hora_original(self):
        """Si ya había ingreso hoy, no se cambia la hora registrada."""
        hora_ingreso = _atras_mismo_dia(timezone.now(), 3 * 60)
        self.trabajador.ultimo_ingreso = hora_ingreso
        self.trabajador.save()
        self._login(self.user)
        self._patch("descanso")
        self.trabajador.refresh_from_db()
        self.assertEqual(self.trabajador.ultimo_ingreso, hora_ingreso)

    def test_manual_otro_no_autorizado(self):
        self._login(self.otro_user)
        res = self._patch("activo")
        self.assertEqual(res.status_code, 403)

    def test_manual_estado_invalido(self):
        self._login(self.user)
        res = self._patch("de vacaciones")
        self.assertEqual(res.status_code, 400)

    def test_manual_reflejado_en_listado(self):
        self._login(self.user)
        self._patch("descanso")
        self.client.credentials()
        res = self.client.get("/api/trabajadores/")
        flor = next(t for t in res.json() if t["id"] == self.trabajador.id)
        self.assertEqual(flor["estado"], "descanso")
        self.assertEqual(flor["estado_manual"], "descanso")


class TestExpiracionJornada(TestEstadoTrabajador):
    """El estado manual expira al fin de la jornada del trabajador."""

    def _set_manual(self, estado, fecha, hora_fin=None):
        self.trabajador.estado_manual = estado
        self.trabajador.estado_manual_fecha = fecha
        if hora_fin is not None:
            self.trabajador.hora_fin = hora_fin
        self.trabajador.save()

    def _estado_listado(self):
        self.client.credentials()
        res = self.client.get("/api/trabajadores/")
        return next(t for t in res.json() if t["id"] == self.trabajador.id)["estado"]

    def test_activo_vigente_con_hora_fin_futura(self):
        now = timezone.now()
        futura = now + timedelta(hours=2)
        if futura.date() != now.date():
            futura = now + timedelta(seconds=30)
        self._set_manual("activo", now.date(), hora_fin=futura.time().replace(microsecond=0))
        self.assertEqual(self._estado_listado(), "activo")

    def test_jornada_terminada_fija_sin_servicio(self):
        """Pasada la hora_fin queda Sin servicio fijo, aunque haya cita en curso."""
        now = timezone.now()
        self._set_manual("descanso", now.date(), hora_fin=_hora_fin_ya_pasada(now))
        servicio = Servicio.objects.create(
            nombre="Rasurado", duracion=60, bloques=2, precio=15000
        )
        Cita.objects.create(
            nombre="Cliente", telefono="3000", trabajador=self.trabajador,
            servicio=servicio, fecha=now.date(),
            hora=_hora_cita_en_curso(now),
        )
        self.assertEqual(self._estado_listado(), "sin servicio")

    def test_estado_de_ayer_expira(self):
        """Estado fijado un día anterior no cuenta: flujo automático."""
        self._set_manual("descanso", timezone.localdate() - timedelta(days=1))
        self.assertEqual(self._estado_listado(), "sin servicio")

    def test_estado_de_ayer_con_cita_automatica(self):
        """Expirado no bloquea el automático: cita en curso → ocupado."""
        now = timezone.now()
        self._set_manual("apagado", now.date() - timedelta(days=1))
        servicio = Servicio.objects.create(
            nombre="Rasurado", duracion=60, bloques=2, precio=15000
        )
        Cita.objects.create(
            nombre="Cliente", telefono="3000", trabajador=self.trabajador,
            servicio=servicio, fecha=now.date(),
            hora=_hora_cita_en_curso(now),
        )
        self.assertEqual(self._estado_listado(), "ocupado")

    def test_patch_reactiva_tras_expiracion(self):
        self._set_manual("descanso", timezone.localdate() - timedelta(days=1))
        self.assertEqual(self._estado_listado(), "sin servicio")
        self._login(self.user)
        res = self.client.patch(
            f"/api/trabajadores/{self.trabajador.id}/estado/",
            {"estado": "activo"}, content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._estado_listado(), "activo")

    def test_sin_hora_fin_vigente_todo_el_dia(self):
        """Sin hora_fin → vigente todo el día (medianoche)."""
        self._set_manual("activo", timezone.localdate(), hora_fin=None)
        self.assertEqual(self._estado_listado(), "activo")


class AceptacionCitasTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="estilista@test.com", password="password123"
        )
        self.servicio = Servicio.objects.create(
            nombre="Corte Moderno", duracion=30, bloques=1, precio=25000
        )
        self.trabajador = Trabajador.objects.create(
            user=self.user,
            nombre="Carlos",
            apellidos="Pérez",
            telefono="3009998888",
            correo="estilista@test.com",
            hora_inicio=dt_time(9, 0),
            hora_fin=dt_time(18, 0),
            dias_disponibles=["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
        )
        self.trabajador.servicios.add(self.servicio)

    def test_creacion_cita_cliente_manual_nace_pendiente(self):
        res = self.client.post(
            "/api/citas/",
            {
                "nombre": "Ana Gómez",
                "telefono": "3101112233",
                "servicio": self.servicio.id,
                "trabajador": self.trabajador.id,
                "fecha": "2026-11-25",
                "hora": "10:00:00",
                "estado": "pendiente",
                "origen": "cliente_manual",
            },
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["estado"], "pendiente")
        self.assertEqual(res.data["origen"], "cliente_manual")

    def test_listar_citas_pendientes_trabajador(self):
        cita = Cita.objects.create(
            nombre="Luis",
            telefono="3123456789",
            servicio=self.servicio,
            trabajador=self.trabajador,
            fecha=date(2026, 11, 25),
            hora=dt_time(11, 0),
            estado="pendiente",
            origen="cliente_manual",
        )
        res = self.client.get(f"/api/citas/pendientes/?trabajador={self.trabajador.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["id"], cita.id)
        self.assertEqual(res.data[0]["nombre"], "Luis")

    def test_aceptar_cita_cambia_a_confirmada(self):
        cita = Cita.objects.create(
            nombre="Laura",
            telefono="3155554444",
            servicio=self.servicio,
            trabajador=self.trabajador,
            fecha=date(2026, 11, 25),
            hora=dt_time(14, 0),
            estado="pendiente",
        )
        res = self.client.post(
            f"/api/citas/{cita.id}/gestionar/",
            {"accion": "aceptar"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        cita.refresh_from_db()
        self.assertEqual(cita.estado, "confirmada")

    def test_cancelar_cita_cambia_a_cancelada(self):
        cita = Cita.objects.create(
            nombre="Pedro",
            telefono="3166667777",
            servicio=self.servicio,
            trabajador=self.trabajador,
            fecha=date(2026, 11, 25),
            hora=dt_time(15, 0),
            estado="pendiente",
        )
        res = self.client.post(
            f"/api/citas/{cita.id}/gestionar/",
            {"accion": "cancelar"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        cita.refresh_from_db()
        self.assertEqual(cita.estado, "cancelada")
