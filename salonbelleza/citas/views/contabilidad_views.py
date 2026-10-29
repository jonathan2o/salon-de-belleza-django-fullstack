"""
Vistas para el módulo de contabilidad de BARBER PRO.
- RegistroContabilidadListCreateView: Listar y crear registros
- RegistroContabilidadDetailView: Detalle, actualizar, eliminar (solo admin)
- ResumenContabilidadView: Totales agrupados por trabajador/quincena
- PermisoContabilidadView: Conceder/retirar permiso de contabilidad
"""

from decimal import Decimal
from datetime import date, datetime
import calendar

from django.db.models import Sum, Count, Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from citas.models import RegistroContabilidad, Trabajador
from citas.serializers.contabilidad_serializers import (
    RegistroContabilidadSerializer,
    RegistroContabilidadCreateUpdateSerializer,
)


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def get_quincena_range(year: int, month: int, quincena: int):
    """
    Devuelve (fecha_inicio, fecha_fin) para la quincena dada.
    quincena=0 → mes completo (días 1-último)
    quincena=1 → días 1-15
    quincena=2 → días 16-último día del mes
    """
    ultimo = calendar.monthrange(year, month)[1]
    if quincena == 0:
        return date(year, month, 1), date(year, month, ultimo)
    if quincena == 1:
        return date(year, month, 1), date(year, month, 15)
    else:
        return date(year, month, 16), date(year, month, ultimo)


def quincena_from_date(d: date):
    """Dado un date, devuelve (year, month, quincena_num)."""
    return d.year, d.month, 1 if d.day <= 15 else 2


def quincena_label(year: int, month: int, q: int) -> str:
    nombres_meses = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    sufijo = "1ra quincena" if q == 1 else "2da quincena"
    return f"{sufijo} de {nombres_meses[month]} {year}"


def validar_filtros_fecha(params):
    """
    Valida los filtros de fecha de los query params.
    Devuelve (fecha_inicio, fecha_fin, error_response).
    - year+month+quincena (los 3 juntos) tienen prioridad.
    - Si no, fecha_desde / fecha_hasta (YYYY-MM-DD), cada uno opcional.
    - Filtros inválidos devuelven un Response 400 en error_response.
    """
    year = params.get("year")
    month = params.get("month")
    quincena = params.get("quincena")
    fecha_desde = params.get("fecha_desde")
    fecha_hasta = params.get("fecha_hasta")

    if year or month or quincena:
        try:
            y, m, q = int(year), int(month), int(quincena)
        except (TypeError, ValueError):
            return None, None, Response(
                {"error": "Los filtros year, month y quincena deben ser números."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 1 <= m <= 12 or q not in (0, 1, 2):
            return None, None, Response(
                {"error": "month debe estar entre 1 y 12 y quincena debe ser 0 (mes completo), 1 o 2."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            inicio, fin = get_quincena_range(y, m, q)
        except ValueError:
            return None, None, Response(
                {"error": "Combinación year/month inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return inicio, fin, None

    inicio = fin = None
    if fecha_desde:
        try:
            inicio = datetime.strptime(fecha_desde, "%Y-%m-%d").date()
        except ValueError:
            return None, None, Response(
                {"error": "fecha_desde debe tener formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    if fecha_hasta:
        try:
            fin = datetime.strptime(fecha_hasta, "%Y-%m-%d").date()
        except ValueError:
            return None, None, Response(
                {"error": "fecha_hasta debe tener formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    if inicio and fin and inicio > fin:
        return None, None, Response(
            {"error": "fecha_desde no puede ser posterior a fecha_hasta."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return inicio, fin, None


def parsear_booleano(valor):
    """Convierte True/False/1/0/"true"/"false" a bool. Devuelve None si no es válido."""
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, (int, float)):
        if valor in (0, 1):
            return bool(valor)
        return None
    if isinstance(valor, str):
        texto = valor.strip().lower()
        if texto in ("true", "1", "si", "sí"):
            return True
        if texto in ("false", "0", "no"):
            return False
    return None


# ─────────────────────────────────────────────
#  Permiso único para administradores
# ─────────────────────────────────────────────

class IsAdminUser(IsAuthenticated):
    """Permite acceso solo a usuarios is_staff."""
    def has_permission(self, request, view):
        base = super().has_permission(request, view)
        return base and request.user.is_staff


class HasContabilidadPermission(IsAuthenticated):
    """Permite acceso a admins y trabajadores con permiso_contabilidad=True."""
    def has_permission(self, request, view):
        base = super().has_permission(request, view)
        if not base:
            return False
        if request.user.is_staff:
            return True
        try:
            return request.user.trabajador.permiso_contabilidad
        except Exception:
            return False


class HasCuentaPropiaPermission(IsAuthenticated):
    """Permite acceso a admins y a cualquier trabajador autenticado."""
    def has_permission(self, request, view):
        base = super().has_permission(request, view)
        if not base:
            return False
        if request.user.is_staff:
            return True
        return hasattr(request.user, "trabajador")


# ─────────────────────────────────────────────
#  Permiso de contabilidad por trabajador
# ─────────────────────────────────────────────

class PermisoContabilidadView(APIView):
    """
    PATCH /api/trabajadores/<pk>/permiso-contabilidad/
    Body: { "permiso_contabilidad": true | false }
    Solo administradores pueden cambiar este permiso.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            trabajador = Trabajador.objects.get(pk=pk)
        except Trabajador.DoesNotExist:
            return Response({"error": "Trabajador no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        valor = request.data.get("permiso_contabilidad")
        if valor is None:
            return Response({"error": "Se requiere el campo 'permiso_contabilidad'"}, status=status.HTTP_400_BAD_REQUEST)

        permitido = parsear_booleano(valor)
        if permitido is None:
            return Response(
                {"error": "El campo 'permiso_contabilidad' debe ser verdadero o falso."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trabajador.permiso_contabilidad = permitido
        trabajador.save(update_fields=["permiso_contabilidad"])

        return Response({
            "message": f"Permiso {'concedido' if trabajador.permiso_contabilidad else 'retirado'} correctamente.",
            "trabajador_id": trabajador.id,
            "permiso_contabilidad": trabajador.permiso_contabilidad,
        })


# ─────────────────────────────────────────────
#  CRUD de Registros de Contabilidad
# ─────────────────────────────────────────────

class RegistroContabilidadListCreateView(APIView):
    """
    GET  /api/contabilidad/registros/   → Lista registros (con filtros)
    POST /api/contabilidad/registros/   → Crear registro (requiere permiso)
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [HasContabilidadPermission]

    def get(self, request):
        qs = RegistroContabilidad.objects.select_related("trabajador", "creado_por", "modificado_por").all()

        # Filtros opcionales
        trabajador_id = request.query_params.get("trabajador")

        # Si NO es admin, solo ve sus propios registros
        if not request.user.is_staff:
            try:
                t = request.user.trabajador
                qs = qs.filter(trabajador=t)
            except Exception:
                return Response([], status=status.HTTP_200_OK)

        if trabajador_id:
            qs = qs.filter(trabajador__id=trabajador_id)

        inicio, fin, error = validar_filtros_fecha(request.query_params)
        if error:
            return error
        if inicio:
            qs = qs.filter(fecha__gte=inicio)
        if fin:
            qs = qs.filter(fecha__lte=fin)

        serializer = RegistroContabilidadSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        # Verificar permiso en Django (doble validación).
        # El trabajador autorizado puede registrar servicios realizados por
        # cualquier trabajador; queda auditado en creado_por.
        if not request.user.is_staff:
            try:
                if not request.user.trabajador.permiso_contabilidad:
                    return Response(
                        {"error": "No tienes permiso para registrar servicios de contabilidad."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Exception:
                return Response(
                    {"error": "No tienes permiso para registrar servicios de contabilidad."},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = RegistroContabilidadCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            registro = serializer.save(creado_por=request.user)
            output = RegistroContabilidadSerializer(registro)
            return Response(output.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegistroContabilidadDetailView(APIView):
    """
    GET    /api/contabilidad/registros/<pk>/  → Detalle
    PATCH  /api/contabilidad/registros/<pk>/  → Actualizar (solo admin)
    DELETE /api/contabilidad/registros/<pk>/  → Eliminar (solo admin)
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [HasContabilidadPermission]

    def _get_objeto(self, pk):
        try:
            return RegistroContabilidad.objects.select_related(
                "trabajador", "creado_por", "modificado_por"
            ).get(pk=pk)
        except RegistroContabilidad.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_objeto(pk)
        if not obj:
            return Response({"error": "Registro no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        # Trabajador no admin solo puede ver sus propios registros
        if not request.user.is_staff:
            try:
                if obj.trabajador.user != request.user:
                    return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)

        serializer = RegistroContabilidadSerializer(obj)
        return Response(serializer.data)

    def patch(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "Solo el administrador puede modificar registros."}, status=status.HTTP_403_FORBIDDEN)

        obj = self._get_objeto(pk)
        if not obj:
            return Response({"error": "Registro no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        serializer = RegistroContabilidadCreateUpdateSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            registro = serializer.save(modificado_por=request.user)
            output = RegistroContabilidadSerializer(registro)
            return Response(output.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "Solo el administrador puede eliminar registros."}, status=status.HTTP_403_FORBIDDEN)

        obj = self._get_objeto(pk)
        if not obj:
            return Response({"error": "Registro no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        obj.delete()
        return Response({"message": "Registro eliminado correctamente."}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
#  Resumen / Dashboard de Contabilidad
# ─────────────────────────────────────────────

class ResumenContabilidadView(APIView):
    """
    GET /api/contabilidad/resumen/
    Devuelve totales agrupados con quincenas.
    Parámetros opcionales: trabajador, year, month, quincena, fecha_desde, fecha_hasta
    Admin ve todos; cualquier trabajador autenticado ve solo su resumen.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [HasCuentaPropiaPermission]

    def get(self, request):
        qs = RegistroContabilidad.objects.select_related("trabajador").all()

        if request.user.is_staff:
            trabajador_id = request.query_params.get("trabajador")
            if trabajador_id:
                qs = qs.filter(trabajador__id=trabajador_id)
        else:
            try:
                qs = qs.filter(trabajador=request.user.trabajador)
            except Exception:
                return Response(
                    {
                        "totales_globales": {
                            "total_precio": "0.00",
                            "total_comisiones": "0.00",
                            "total_salon": "0.00",
                            "num_servicios": 0,
                        },
                        "por_trabajador": [],
                        "quincenas_disponibles": [],
                    },
                    status=status.HTTP_200_OK,
                )

        inicio, fin, error = validar_filtros_fecha(request.query_params)
        if error:
            return error
        if inicio:
            qs = qs.filter(fecha__gte=inicio)
        if fin:
            qs = qs.filter(fecha__lte=fin)

        # Totales globales
        totales = qs.aggregate(
            total_precio=Sum("precio"),
            total_comisiones=Sum("valor_comision"),
            total_salon=Sum("valor_salon"),
            num_servicios=Count("id"),
        )

        # Totales por trabajador (una sola consulta agrupada)
        por_trabajador = []
        filas = (
            qs.values("trabajador__id", "trabajador__nombre", "trabajador__apellidos")
            .annotate(
                total_precio=Sum("precio"),
                total_comisiones=Sum("valor_comision"),
                total_salon=Sum("valor_salon"),
                num_servicios=Count("id"),
            )
            .order_by("-total_precio")
        )
        for f in filas:
            if (f["num_servicios"] or 0) > 0:
                por_trabajador.append({
                    "trabajador_id": f["trabajador__id"],
                    "trabajador_nombre": f"{f['trabajador__nombre']} {f['trabajador__apellidos']}".strip(),
                    "num_servicios": f["num_servicios"],
                    "total_precio": str(f["total_precio"] or Decimal("0.00")),
                    "total_comisiones": str(f["total_comisiones"] or Decimal("0.00")),
                    "total_salon": str(f["total_salon"] or Decimal("0.00")),
                })

        # Quincenas disponibles (historial)
        fechas = qs.values_list("fecha", flat=True).distinct().order_by("fecha")
        quincenas_vistas = set()
        quincenas = []
        for f in fechas:
            y, m, q = quincena_from_date(f)
            key = (y, m, q)
            if key not in quincenas_vistas:
                quincenas_vistas.add(key)
                inicio, fin = get_quincena_range(y, m, q)
                quincenas.append({
                    "year": y,
                    "month": m,
                    "quincena": q,
                    "label": quincena_label(y, m, q),
                    "fecha_inicio": str(inicio),
                    "fecha_fin": str(fin),
                })

        return Response({
            "totales_globales": {
                "total_precio": str(totales["total_precio"] or Decimal("0.00")),
                "total_comisiones": str(totales["total_comisiones"] or Decimal("0.00")),
                "total_salon": str(totales["total_salon"] or Decimal("0.00")),
                "num_servicios": totales["num_servicios"] or 0,
            },
            "por_trabajador": por_trabajador,
            "quincenas_disponibles": quincenas,
        })


class HistorialServiciosView(APIView):
    """
    GET /api/contabilidad/historial/  (?trabajador=<id> solo admin)
    Historial completo de servicios del trabajador autenticado
    (ordenado por fecha descendente). Para el apartado
    "Historial de Servicios" del perfil.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [HasCuentaPropiaPermission]

    def get(self, request):
        qs = RegistroContabilidad.objects.select_related("trabajador").all()

        if request.user.is_staff:
            trabajador_id = request.query_params.get("trabajador")
            if trabajador_id:
                qs = qs.filter(trabajador__id=trabajador_id)
        else:
            try:
                qs = qs.filter(trabajador=request.user.trabajador)
            except Exception:
                return Response([], status=status.HTTP_200_OK)

        # Filtro opcional de período: year+month+quincena o fecha_desde/hasta
        inicio, fin, error = validar_filtros_fecha(request.query_params)
        if error:
            return error
        if inicio:
            qs = qs.filter(fecha__gte=inicio)
        if fin:
            qs = qs.filter(fecha__lte=fin)

        registros = [
            {
                "id": r.id,
                "fecha": str(r.fecha),
                "hora": str(r.hora) if r.hora else "",
                "quincena": quincena_label(*quincena_from_date(r.fecha)),
                "descripcion": r.descripcion,
                "cliente": r.cliente or "",
                "cliente_telefono": r.cliente_telefono or "",
                "precio": str(r.precio),
                "porcentaje_comision": str(r.porcentaje_comision),
                "ganancia": str(r.valor_comision),
            }
            for r in qs.order_by("-fecha", "-id")
        ]
        return Response(registros)


class QuincenasDisponiblesView(APIView):
    """
    GET /api/contabilidad/quincenas/
    Devuelve la lista de quincenas con registros.
    Trabajadores con permiso ven solo las suyas; admin ve todas.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [HasContabilidadPermission]

    def get(self, request):
        qs = RegistroContabilidad.objects.all()

        if not request.user.is_staff:
            try:
                qs = qs.filter(trabajador=request.user.trabajador)
            except Exception:
                return Response([], status=status.HTTP_200_OK)

        trabajador_id = request.query_params.get("trabajador")
        if trabajador_id and request.user.is_staff:
            qs = qs.filter(trabajador__id=trabajador_id)

        fechas = qs.values_list("fecha", flat=True).distinct().order_by("fecha")
        quincenas_vistas = set()
        quincenas = []
        for f in fechas:
            y, m, q = quincena_from_date(f)
            key = (y, m, q)
            if key not in quincenas_vistas:
                quincenas_vistas.add(key)
                inicio, fin = get_quincena_range(y, m, q)
                q_qs = qs.filter(fecha__gte=inicio, fecha__lte=fin)
                agg = q_qs.aggregate(
                    total_precio=Sum("precio"),
                    total_comisiones=Sum("valor_comision"),
                    total_salon=Sum("valor_salon"),
                    num_servicios=Count("id"),
                )
                quincenas.append({
                    "year": y,
                    "month": m,
                    "quincena": q,
                    "label": quincena_label(y, m, q),
                    "fecha_inicio": str(inicio),
                    "fecha_fin": str(fin),
                    "num_servicios": agg["num_servicios"] or 0,
                    "total_precio": str(agg["total_precio"] or Decimal("0.00")),
                    "total_comisiones": str(agg["total_comisiones"] or Decimal("0.00")),
                    "total_salon": str(agg["total_salon"] or Decimal("0.00")),
                })

        # Ordenar descendente (más recientes primero)
        quincenas.sort(key=lambda x: (x["year"], x["month"], x["quincena"]), reverse=True)
        return Response(quincenas)
