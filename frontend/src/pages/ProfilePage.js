import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import ServiceBackgroundCard from "../components/ServiceBackgroundCard";
import EstadoActivacion from "../components/EstadoActivacion";
import SolicitudesCitasCard from "../components/SolicitudesCitasCard";
import "./ProfileQuincena.css";

const API_BASE = "/api";

const fmt = (val) =>
  Number(val || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

// Primer nombre + inicial del apellido ("FLOR VELANDIA" → "FLOR V.")
const nombreCorto = (n) => {
  const partes = String(n || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0];
  if (!partes[1] || partes[1].length === 0) return partes[0];
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`;
};

const NOMBRES_MES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MESES_MIN = [
  "", "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// YYYY-MM-DD → "21 oct 2026"
const fechaCorta = (f) => {
  if (!f) return "—";
  const partes = String(f).split("-");
  if (partes.length !== 3) return String(f);
  return `${partes[2]} ${MESES_MIN[Number(partes[1])]} ${partes[0]}`;
};

// YYYY-MM-DD → "Octubre 2026"
const mesAnioLabel = (f) => {
  const partes = String(f).split("-");
  const mes = NOMBRES_MES[Number(partes[1])] || "";
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${partes[0]}`;
};

// YYYY-MM-DD → tubo mini "Q1" | "Q2"
const quincenaMini = (f) => {
  const dia = Number(String(f).split("-")[2]);
  return Number.isNaN(dia) ? "" : dia <= 15 ? "Q1" : "Q2";
};

const periodoInfo = (year, month, quincena) => {
  const ultimoDia = new Date(year, month, 0).getDate();
  const rango = quincena === 1 ? "días 1–15" : `días 16–${ultimoDia}`;
  const etiqueta = `${quincena === 1 ? "1ra" : "2da"} quincena de ${NOMBRES_MES[month]} ${year}`;
  const dInicio = quincena === 1 ? 1 : 16;
  const dFin = quincena === 1 ? 15 : ultimoDia;
  const rangoFechas = `${dInicio} ${MESES_MIN[month]} – ${dFin} ${MESES_MIN[month]} ${year}`;
  return { year, month, quincena, rango, etiqueta, rangoFechas };
};

const quincenaVigente = (() => {
  const hoy = new Date();
  return periodoInfo(
    hoy.getFullYear(),
    hoy.getMonth() + 1,
    hoy.getDate() <= 15 ? 1 : 2
  );
})();

export default function ProfilePage() {
  const { user, authFetch } = useContext(AuthContext);
  const navigate = useNavigate();
  const [servicios, setServicios] = useState([]);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
  const [serviciosSeleccionadosInicial, setServiciosSeleccionadosInicial] = useState([]);
  const [mensajeServicios, setMensajeServicios] = useState("");
  const [mensajeDias, setMensajeDias] = useState("");
  const [isSavingServicios, setIsSavingServicios] = useState(false);
  const [isSavingDias, setIsSavingDias] = useState(false);
  const [mostrarServicios, setMostrarServicios] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [diasSeleccionados, setDiasSeleccionados] = useState([]);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [resumen, setResumen] = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [quincenaAbierta, setQuincenaAbierta] = useState(false);
  const [historial, setHistorial] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [fechasAbiertas, setFechasAbiertas] = useState({});
  const [diasAbierto, setDiasAbierto] = useState(false);
  const [periodoSel, setPeriodoSel] = useState(null);
  const [errorQuincena, setErrorQuincena] = useState("");
  const [estadoPropio, setEstadoPropio] = useState(null);
  const [estadoBump, setEstadoBump] = useState(0);
  const [estadoPatch, setEstadoPatch] = useState(null); // estado enviando

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const serviciosRes = await fetch(`${API_BASE}/servicios/`);
        const serviciosData = await serviciosRes.json();

        setServicios(serviciosData);

        const trabajadoresRes = await fetch(`${API_BASE}/trabajadores/`);
        const trabajadoresData = await trabajadoresRes.json();

        const trabajador = trabajadoresData.find(
          (t) => t.id === user.trabajador_id,
        );

        if (trabajador) {
          if (trabajador.servicios) {
            const idsServicios = trabajador.servicios.map((s) => s.id);

            setServiciosSeleccionados(idsServicios);
            setServiciosSeleccionadosInicial(idsServicios);
          }

          if (trabajador.dias_disponibles) {
            setDiasSeleccionados(trabajador.dias_disponibles);
          }

          if (trabajador.hora_inicio) {
            setHoraInicio(trabajador.hora_inicio);
          }

          if (trabajador.hora_fin) {
            setHoraFin(trabajador.hora_fin);
          }
        }
      } catch (error) {
        console.log(error);
      }
    };

    cargarDatos();
  }, []);

  // ── Carga resumen de quincena (período seleccionado o vigente) ──
  useEffect(() => {
    const puedeVer = !!user?.trabajador_id;
    if (!puedeVer) return;

    let cancelado = false;
    const cargarResumen = async () => {
      setLoadingResumen(true);
      setErrorQuincena("");
      try {
        const p = periodoSel || quincenaVigente;
        const params = new URLSearchParams({
          year: p.year,
          month: p.month,
          quincena: p.quincena,
        });
        const res = await authFetch(
          `${API_BASE}/contabilidad/resumen/?${params.toString()}`,
        );
        if (cancelado) return;
        if (!res.ok) {
          let mensaje = "No se pudo cargar la quincena";
          if (res.status === 403) {
            mensaje = "⛔ No tienes acceso a la contabilidad";
          } else {
            try {
              const data = await res.json();
              mensaje = data?.error || data?.detail || mensaje;
            } catch (e) {
              /* respuesta sin JSON */
            }
          }
          setErrorQuincena(typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje));
          setResumen(null);
          return;
        }
        const data = await res.json();
        if (!cancelado) setResumen(data);
      } catch (error) {
        console.error(error);
        if (!cancelado) setErrorQuincena("Error de conexión al cargar el resumen");
      } finally {
        if (!cancelado) setLoadingResumen(false);
      }
    };

    cargarResumen();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, periodoSel]);

  // ── Historial de servicios (filtrado por el mismo período que Mi Quincena) ──
  useEffect(() => {
    if (!user?.trabajador_id) return;

    let cancelado = false;
    const cargarHistorial = async () => {
      setLoadingHistorial(true);
      try {
        const p = periodoSel || quincenaVigente;
        const params = new URLSearchParams({
          year: p.year,
          month: p.month,
          quincena: p.quincena,
        });
        const res = await authFetch(
          `${API_BASE}/contabilidad/historial/?${params.toString()}`,
        );
        if (!cancelado && res.ok) {
          const data = await res.json();
          if (!cancelado) setHistorial(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelado) setLoadingHistorial(false);
      }
    };

    cargarHistorial();
    setFechasAbiertas({});
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, periodoSel]);

  // ── Estado de disponibilidad propio (activo/ocupado/sin servicio) ──
  useEffect(() => {
    if (!user?.trabajador_id) return;

    let cancelado = false;
    const cargarEstado = async () => {
      try {
        const res = await fetch(`${API_BASE}/trabajadores/`);
        if (!res.ok) return;
        const data = await res.json();
        const t = (Array.isArray(data) ? data : []).find(
          (x) => String(x.id) === String(user.trabajador_id),
        );
        if (t && !cancelado) setEstadoPropio(t);
      } catch (error) {
        console.error(error);
      }
    };

    cargarEstado();
    const id = setInterval(cargarEstado, 60000);
    return () => { cancelado = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, estadoBump]);

  const parseServiceName = (nombre) => {
    const parts = nombre.split(" - ");
    if (parts.length > 1) {
      const category = parts[0].trim();
      const rest = parts.slice(1).join(" - ").trim();
      
      const fondoMatch = rest.match(/\|fondo:([^|]+)\|/);
      let fondo = fondoMatch ? fondoMatch[1] : "";
      let subtitle = fondoMatch ? rest.replace(/\|fondo:[^|]+\|/, "").trim() : rest;
      
      if (!fondo) {
        const gemMatch = subtitle.match(/\(([^)]+)\)$/);
        if (gemMatch) {
          fondo = gemMatch[1].toLowerCase();
          subtitle = subtitle.replace(/\s*\([^)]+\)$/, "").trim();
        }
      }
      return { category, subtitle, fondo };
    }
    return { category: nombre, subtitle: "", fondo: "" };
  };
  const manejarSeleccion = (id) => {
    const idNumero = Number(id);

    if (serviciosSeleccionados.includes(idNumero)) {
      const nuevosServicios = serviciosSeleccionados.filter(
        (servicioId) => servicioId !== idNumero,
      );

      setServiciosSeleccionados(nuevosServicios);
    } else {
      setServiciosSeleccionados([...serviciosSeleccionados, idNumero]);
    }
  };

  const manejarSeleccionCategoria = (items) => {
    const idsCategoria = items.map((s) => s.id);
    const isSelected = items.some((s) => serviciosSeleccionados.includes(s.id));
    if (isSelected) {
      setServiciosSeleccionados((prev) =>
        prev.filter((id) => !idsCategoria.includes(id))
      );
    } else {
      setServiciosSeleccionados((prev) => [
        ...new Set([...prev, ...idsCategoria]),
      ]);
    }
  };

  const hasChanges =
    JSON.stringify([...serviciosSeleccionados].sort()) !==
    JSON.stringify([...serviciosSeleccionadosInicial].sort());

  const getErrorMessage = async (response, fallback) => {
    try {
      const data = await response.json();
      const detail = data?.error || data?.detail || fallback;
      return typeof detail === "string" ? detail : JSON.stringify(detail);
    } catch (error) {
      return fallback;
    }
  };

  const guardarServicios = async () => {
    setMensajeServicios("⏳ Guardando cambios...");
    setIsSavingServicios(true);

    try {
      const response = await authFetch(
        `${API_BASE}/trabajadores/${user.trabajador_id}/servicios/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            servicios: serviciosSeleccionados,
          }),
        },
      );

      if (response.ok) {
        setMensajeServicios("✅ Cambios guardados correctamente");
        setServiciosSeleccionadosInicial(serviciosSeleccionados);
        setTimeout(() => setMensajeServicios(""), 4000);
      } else {
        const message = await getErrorMessage(response, "Error al guardar los cambios");
        setMensajeServicios(`❌ ${message}`);
      }
    } catch (error) {
      console.log(error);
      setMensajeServicios("❌ Error al guardar los cambios");
    } finally {
      setIsSavingServicios(false);
    }
  };

  const guardarDias = async () => {
    setMensajeDias("⏳ Guardando cambios...");
    setIsSavingDias(true);

    try {
      const response = await authFetch(
        `${API_BASE}/trabajadores/${user.trabajador_id}/disponibilidad/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dias: diasSeleccionados,
            hora_inicio: horaInicio || null,
            hora_fin: horaFin || null,
          }),
        },
      );

      if (response.ok) {
        setMensajeDias("✅ Cambios guardados correctamente");
        setTimeout(() => setMensajeDias(""), 4000);
      } else {
        const message = await getErrorMessage(response, "Error al guardar los cambios");
        setMensajeDias(`❌ ${message}`);
      }
    } catch (error) {
      console.log(error);
      setMensajeDias("❌ Error al guardar los cambios");
    } finally {
      setIsSavingDias(false);
    }
  };
  const diasSemana = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];
  const seleccionarDia = (dia) => {
    if (diasSeleccionados.includes(dia)) {
      setDiasSeleccionados(diasSeleccionados.filter((d) => d !== dia));
    } else {
      setDiasSeleccionados([...diasSeleccionados, dia]);
    }
  };

  if (!user) {
    return (
      <div className="page-container">
        <p>Cargando perfil...</p>
      </div>
    );
  }

  // ── Resumen de quincena (solo trabajador autenticado) ──
  const periodoActivo = periodoSel || quincenaVigente;
  const añosFiltro = (() => {
    const set = new Set([quincenaVigente.year]);
    (resumen?.quincenas_disponibles || []).forEach((q) => set.add(q.year));
    return [...set].sort((a, b) => b - a);
  })();
  const elegirPeriodo = (year, month, quincena) =>
    setPeriodoSel(periodoInfo(year, month, quincena));
  const volverHoy = () => setPeriodoSel(null);
  const miFila = (resumen?.por_trabajador || []).find(
    (r) => String(r.trabajador_id) === String(user.trabajador_id),
  );
  const puedeVerQuincena = !!user.trabajador_id;

  // ── Historial: agrupado por "Mes año" → fechas ──
  const historialGrupos = (() => {
    if (!Array.isArray(historial)) return [];
    const ordenMeses = [];
    const meses = {};
    historial.forEach((r) => {
      const labelMes = mesAnioLabel(r.fecha);
      if (!meses[labelMes]) {
        meses[labelMes] = { orden: [], fechas: {} };
        ordenMeses.push(labelMes);
      }
      const mes = meses[labelMes];
      if (!mes.fechas[r.fecha]) {
        mes.fechas[r.fecha] = [];
        mes.orden.push(r.fecha);
      }
      mes.fechas[r.fecha].push(r);
    });
    return ordenMeses.map((labelMes) => ({
      label: labelMes,
      fechas: meses[labelMes].orden.map((f) => {
        const items = meses[labelMes].fechas[f];
        return {
          fecha: f,
          label: fechaCorta(f),
          items,
          numServicios: items.length,
          totalGanancia: items.reduce(
            (sum, it) => sum + Number(it.ganancia || 0),
            0,
          ),
        };
      }),
    }));
  })();
  const historialTotal = Array.isArray(historial) ? historial.length : 0;

  const estadoActual = estadoPropio?.estado || "sin servicio";

  const jornadaFinalizada = (() => {
    if (estadoActual !== "sin servicio") return false;
    const fin = estadoPropio?.hora_fin;
    if (!fin) return false;
    const [h, m] = String(fin).split(":").map(Number);
    const ahora = new Date();
    const finHoy = new Date(ahora);
    finHoy.setHours(h || 0, m || 0, 0, 0);
    return ahora >= finHoy;
  })();
  const estadoTitulo =
    estadoActual === "ocupado"
      ? "🟠 Estás ocupado — atención en curso"
      : estadoActual === "activo"
      ? "🟢 Estás activo"
      : estadoActual === "descanso"
      ? "☕ Estás en descanso"
      : estadoActual === "apagado"
      ? "⚫ Estás apagado"
      : "⚪ Sin servicio por ahora";

  const cambiarEstadoManual = async (nuevo) => {
    if (estadoPatch || !user?.trabajador_id) return;
    setEstadoPatch(nuevo);
    try {
      const res = await authFetch(
        `${API_BASE}/trabajadores/${user.trabajador_id}/estado/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: nuevo }),
        },
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        console.error(error.error || "No se pudo cambiar el estado");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEstadoPatch(null);
      setEstadoBump((b) => b + 1);
    }
  };

  return (
    <div className="page-container">
      {/* ── Overlay flotante de activación manual (desenfoca el panel) ── */}
      <EstadoActivacion onActivado={() => setEstadoBump((b) => b + 1)} />

      <h2 className="page-title">Mi Perfil</h2>
      <div className="profile-card">
        <div className="profile-info">
          <h3>Bienvenido, {user.nombre}</h3>
          <p className="profile-text">
            <strong>Nombre completo:</strong> {user.nombre} {user.apellidos}
          </p>
          <p className="profile-text">
            <strong>Correo:</strong> {user.correo}
          </p>
          <p className="profile-text">
            <strong>Teléfono:</strong> {user.telefono}
          </p>
          {user.numero_cc && (
            <p className="profile-text">
              <strong>CC:</strong> {user.numero_cc}
            </p>
          )}
        </div>
      </div>

      {/* ── Alerta de activación + estado en vivo ── */}
      {user.trabajador_id && (
        <div className={`st-banner st-banner-${estadoActual}`}>
          <span className="st-banner-icon">
            {estadoActual === "ocupado"
              ? "🟠"
              : estadoActual === "activo"
              ? "🟢"
              : estadoActual === "descanso"
              ? "☕"
              : estadoActual === "apagado"
              ? "⚫"
              : "⚪"}
          </span>
          <div className="st-banner-texts">
            <span className="st-banner-titulo">{estadoTitulo}</span>
            <span className={`st-banner-sub ${jornadaFinalizada ? "st-banner-jornada" : ""}`}>
              {estadoPropio?.hora_ingreso
                ? `✅ Activación registrada hoy a las ${estadoPropio.hora_ingreso}`
                : jornadaFinalizada
                ? "🔵 Jornada finalizada por hoy — te activas de nuevo mañana"
                : estadoActual === "apagado"
                ? "Estás apagado — no aparecerás como activo para la administración"
                : "Aún sin activar hoy — activa tu turno o elige un estado"}
            </span>
          </div>
          <div className="st-seg" role="group" aria-label="Cambiar estado">
            <button
              type="button"
              className={`st-seg-btn st-seg-activo ${estadoActual === "activo" ? "on" : ""}`}
              onClick={() => cambiarEstadoManual("activo")}
              disabled={Boolean(estadoPatch) || estadoActual === "activo"}
            >
              {estadoPatch === "activo" ? "…" : "🟢"}
              <span>Activo</span>
            </button>
            <button
              type="button"
              className={`st-seg-btn st-seg-descanso ${estadoActual === "descanso" ? "on" : ""}`}
              onClick={() => cambiarEstadoManual("descanso")}
              disabled={Boolean(estadoPatch) || estadoActual === "descanso"}
            >
              {estadoPatch === "descanso" ? "…" : "☕"}
              <span>Descanso</span>
            </button>
            <button
              type="button"
              className={`st-seg-btn st-seg-apagado ${estadoActual === "apagado" ? "on" : ""}`}
              onClick={() => cambiarEstadoManual("apagado")}
              disabled={Boolean(estadoPatch) || estadoActual === "apagado"}
            >
              {estadoPatch === "apagado" ? "…" : "⚫"}
              <span>Apagado</span>
            </button>
          </div>
        </div>
      )}

      {(user.is_staff || user.permiso_contabilidad) && (
        <div
          className="premium-dashboard-card animated-fade-in-scale"
          onClick={() => navigate("/contabilidad")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") navigate("/contabilidad"); }}
          style={{ cursor: "pointer", marginBottom: "30px" }}
          title="Ir al módulo de contabilidad"
        >
          <div className="premium-dashboard-header">
            <span className="premium-icon">💰</span>
            <div className="premium-titles">
              <h3 className="premium-title">Contabilidad</h3>
              <p className="premium-subtitle">
                {user.is_staff
                  ? "Panel administrativo de ingresos y comisiones"
                  : "Registra tus servicios y consulta tus quincenas"}
              </p>
            </div>
          </div>
        </div>
      )}

      {puedeVerQuincena && (
        <SolicitudesCitasCard
          trabajadorId={user.trabajador_id}
          authFetch={authFetch}
        />
      )}

      {puedeVerQuincena && (
        <section className="mq-card">
          <button
            type="button"
            className="mq-toggle"
            onClick={() => setQuincenaAbierta(!quincenaAbierta)}
            aria-expanded={quincenaAbierta}
          >
            <span className="mq-icon">💰</span>
            <span className="mq-titles">
              <span className="mq-title">Mi Quincena</span>
              <span className="mq-subtitle">
                {periodoActivo.etiqueta} · {periodoActivo.rangoFechas}
              </span>
            </span>
            <span className="mq-badge">
              <span className="mq-badge-dot" />
              {periodoActivo.quincena === 1 ? "Q1" : "Q2"} · {periodoActivo.year}
            </span>
            <span className={`mq-chevron ${quincenaAbierta ? "open" : ""}`}>▼</span>
          </button>

          {quincenaAbierta && (
            <div className="mq-panel">
              <div className="mq-controls">
                <select
                  className="mq-select"
                  value={String(periodoActivo.year)}
                  onChange={(e) =>
                    elegirPeriodo(
                      Number(e.target.value),
                      periodoActivo.month,
                      periodoActivo.quincena,
                    )
                  }
                >
                  {añosFiltro.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  className="mq-select"
                  value={String(periodoActivo.month)}
                  onChange={(e) =>
                    elegirPeriodo(
                      periodoActivo.year,
                      Number(e.target.value),
                      periodoActivo.quincena,
                    )
                  }
                >
                  {NOMBRES_MES.slice(1).map((nombre, idx) => (
                    <option key={idx + 1} value={String(idx + 1)}>
                      {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="mq-segment">
                  <button
                    type="button"
                    className={`mq-seg-btn ${periodoActivo.quincena === 1 ? "active" : ""}`}
                    onClick={() => elegirPeriodo(periodoActivo.year, periodoActivo.month, 1)}
                  >
                    Q1
                  </button>
                  <button
                    type="button"
                    className={`mq-seg-btn ${periodoActivo.quincena === 2 ? "active" : ""}`}
                    onClick={() => elegirPeriodo(periodoActivo.year, periodoActivo.month, 2)}
                  >
                    Q2
                  </button>
                </div>
                <button
                  type="button"
                  className="mq-hoy"
                  onClick={volverHoy}
                >
                  Hoy
                </button>
              </div>

              <div className="mq-rango-chip">📅 {periodoActivo.rangoFechas}</div>

              {errorQuincena ? (
                <div className="mq-estado mq-estado-error">
                  <span className="mq-estado-icon">⛔</span>
                  <p>{errorQuincena}</p>
                </div>
              ) : loadingResumen ? (
                <div className="mq-estado mq-estado-loading">
                  <div className="mq-skeleton" />
                  <div className="mq-skeleton mq-skeleton-sm" />
                  <div className="mq-skeleton mq-skeleton-sm" />
                </div>
              ) : !miFila ? (
                <div className="mq-estado mq-estado-empty">
                  <span className="mq-estado-icon">📭</span>
                  <p>Sin registros para esta quincena</p>
                  <span>
                    Los servicios se muestran según la fecha en que se realizaron
                    (Q1: días 1–15, Q2: días 16–fin de mes).
                  </span>
                </div>
              ) : (
                <div className="mq-resumen">
                  <div className="mq-resumen-top">
                    <span className="mq-resumen-label">Trabajador</span>
                    <span className="mq-resumen-nombre">
                      {nombreCorto(
                        miFila?.trabajador_nombre ||
                          `${user.nombre || ""} ${user.apellidos || ""}`.trim() ||
                          "—",
                      )}
                    </span>
                  </div>
                  <div className="mq-resumen-stats">
                    <div className="mq-stat">
                      <span className="mq-stat-label">Servicios</span>
                      <span className="mq-stat-val mq-stat-teal">{miFila.num_servicios}</span>
                    </div>
                    <div className="mq-stat mq-stat-gold">
                      <span className="mq-stat-label">Quincena</span>
                      <span className="mq-stat-val">{fmt(miFila.total_comisiones)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {puedeVerQuincena && (
        <section className="hs-card">
          <button
            type="button"
            className="hs-toggle"
            onClick={() => setHistorialAbierto(!historialAbierto)}
            aria-expanded={historialAbierto}
          >
            <span className="hs-icon">📜</span>
            <span className="hs-titles">
              <span className="hs-title">Historial de Servicios</span>
              <span className="hs-subtitle">{periodoActivo.etiqueta}</span>
            </span>
            <span className="hs-badge">
              <span className="hs-badge-dot" />
              {historialTotal} {historialTotal === 1 ? "servicio" : "servicios"}
            </span>
            <span className={`hs-chevron ${historialAbierto ? "open" : ""}`}>▼</span>
          </button>

          {historialAbierto && (
            <div className="hs-panel">
              <div className="hs-controls">
                <select
                  className="hs-select"
                  value={String(periodoActivo.year)}
                  onChange={(e) =>
                    elegirPeriodo(
                      Number(e.target.value),
                      periodoActivo.month,
                      periodoActivo.quincena,
                    )
                  }
                >
                  {añosFiltro.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  className="hs-select"
                  value={String(periodoActivo.month)}
                  onChange={(e) =>
                    elegirPeriodo(
                      periodoActivo.year,
                      Number(e.target.value),
                      periodoActivo.quincena,
                    )
                  }
                >
                  {NOMBRES_MES.slice(1).map((nombre, idx) => (
                    <option key={idx + 1} value={String(idx + 1)}>
                      {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="hs-segment">
                  <button
                    type="button"
                    className={`hs-seg-btn ${periodoActivo.quincena === 1 ? "active" : ""}`}
                    onClick={() => elegirPeriodo(periodoActivo.year, periodoActivo.month, 1)}
                  >
                    Q1
                  </button>
                  <button
                    type="button"
                    className={`hs-seg-btn ${periodoActivo.quincena === 2 ? "active" : ""}`}
                    onClick={() => elegirPeriodo(periodoActivo.year, periodoActivo.month, 2)}
                  >
                    Q2
                  </button>
                </div>
                <button
                  type="button"
                  className="hs-hoy"
                  onClick={volverHoy}
                >
                  Hoy
                </button>
              </div>

              <div className="hs-rango-chip">📅 {periodoActivo.rangoFechas}</div>

              {loadingHistorial ? (
                <div className="mq-estado mq-estado-loading">
                  <div className="mq-skeleton" />
                  <div className="mq-skeleton mq-skeleton-sm" />
                  <div className="mq-skeleton mq-skeleton-sm" />
                </div>
              ) : historialTotal === 0 ? (
                <div className="mq-estado mq-estado-empty">
                  <span className="mq-estado-icon">📭</span>
                  <p>Sin servicios en esta quincena</p>
                  <span>
                    Cambia el período con los filtros de arriba; los servicios
                    pertenecen a la quincena de su fecha (Q1: días 1–15,
                    Q2: días 16–fin de mes).
                  </span>
                </div>
              ) : (
                historialGrupos.map((grupo) => (
                  <div className="hs-grupo" key={grupo.label}>
                    <div className="hs-timeline">
                      {grupo.fechas.map((dia) => {
                        const abierta = !!fechasAbiertas[dia.fecha];
                        return (
                          <div
                            className={`hs-fecha ${abierta ? "open" : ""}`}
                            key={dia.fecha}
                          >
                            <button
                              type="button"
                              className="hs-fecha-toggle"
                              onClick={() =>
                                setFechasAbiertas((prev) => ({
                                  ...prev,
                                  [dia.fecha]: !prev[dia.fecha],
                                }))
                              }
                              aria-expanded={abierta}
                            >
                              <span className="hs-item-dot" />
                              <span className="hs-fecha-label">
                                📅 {dia.label}
                              </span>
                              <span className="hs-item-quincena">
                                {quincenaMini(dia.fecha)}
                              </span>
                              <span className="hs-fecha-count">
                                {dia.numServicios}{" "}
                                {dia.numServicios === 1 ? "servicio" : "servicios"}
                              </span>
                              <span className="hs-fecha-ganancia">
                                {fmt(dia.totalGanancia)}
                              </span>
                              <span
                                className={`hs-chevron ${abierta ? "open" : ""}`}
                              >
                                ▼
                              </span>
                            </button>

                            {abierta && (
                              <div className="hs-fecha-panel">
                                {dia.items.map((r) => (
                                  <article className="hs-item" key={r.id}>
                                    <div className="hs-item-content">
                                      <div className="hs-item-desc">
                                        {r.descripcion}
                                      </div>
                                      <div className="hs-item-cliente">
                                        👤 {r.cliente ? r.cliente : "Sin cliente"}
                                      </div>
                                      <div className="hs-item-montos">
                                        <span className="hs-monto">
                                          <span className="hs-monto-label">Precio total</span>
                                          <span className="hs-monto-val">{fmt(r.precio)}</span>
                                        </span>
                                        <span className="hs-flecha">→</span>
                                        <span className="hs-monto">
                                          <span className="hs-monto-label">% Comisión</span>
                                          <span className="hs-monto-val">
                                            {Number(r.porcentaje_comision)}%
                                          </span>
                                        </span>
                                        <span className="hs-flecha">→</span>
                                        <span className="hs-monto hs-monto-gold">
                                          <span className="hs-monto-label">Ganancia</span>
                                          <span className="hs-monto-val">{fmt(r.ganancia)}</span>
                                        </span>
                                      </div>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      <div className="profile-actions">
      <section className="ss-card">
        <button
          type="button"
          className="ss-toggle"
          onClick={() => setMostrarServicios(!mostrarServicios)}
          aria-expanded={mostrarServicios}
        >
          <span className="ss-icon">✂</span>
          <span className="ss-titles">
            <span className="ss-title">Servicios Seleccionados</span>
            <span className="ss-subtitle">Servicios activos actualmente</span>
          </span>
          {(() => {
            const catCon_Activos = new Set();
            servicios.forEach((s) => {
              const title = s.nombre.split(" - ")[0].trim();
              if (serviciosSeleccionados.includes(s.id)) catCon_Activos.add(title);
            });
            return (
              <span className="ss-badge">
                <span className="ss-badge-dot" />
                {catCon_Activos.size} {catCon_Activos.size === 1 ? "activo" : "activos"}
              </span>
            );
          })()}
          <span className={`ss-chevron ${mostrarServicios ? "open" : ""}`}>▼</span>
        </button>

        {mostrarServicios && (
          <div className="ss-panel">
            {(() => {
              const groupedServicios = {};
              servicios.forEach((s) => {
                const parts = s.nombre.split(" - ");
                const title = parts[0].trim();
                const subtitle = parts.length > 1 ? parts.slice(1).join(" - ").trim() : "";
                if (!groupedServicios[title]) {
                  groupedServicios[title] = [];
                }
                groupedServicios[title].push({ ...s, subtitle });
              });

              const toggleCat = (cat, e) => {
                e.stopPropagation();
                setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
              };

              const keys = Object.keys(groupedServicios);
              if (keys.length === 0) {
                return (
                  <div className="mq-estado mq-estado-empty">
                    <span className="mq-estado-icon">📭</span>
                    <p>No hay servicios creados</p>
                    <span>Crea servicios desde el panel de administración para activarlos aquí.</span>
                  </div>
                );
              }

              return keys.map((title) => {
                const items = groupedServicios[title];
                const isExpanded = !!expandedCategories[title];
                const hasSubservices = items.some(item => item.subtitle !== "");
                const isCategorySelected = items.some(item => serviciosSeleccionados.includes(item.id));

                return (
                  <div key={title} className={`ss-cat ${isCategorySelected ? "activa" : ""}`}>
                    <div
                      className="ss-cat-header"
                      onClick={hasSubservices ? (e) => toggleCat(title, e) : undefined}
                      role={hasSubservices ? "button" : undefined}
                      tabIndex={hasSubservices ? 0 : undefined}
                    >
                      <input
                        type="checkbox"
                        className="custom-checkbox ss-cat-check"
                        checked={isCategorySelected}
                        onChange={() => manejarSeleccionCategoria(items)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="ss-cat-info">
                        <span className="ss-cat-title">{title}</span>
                        {isCategorySelected && (
                          <span className="ss-cat-activo">
                            <span className="ss-activo-dot" />
                            Activo
                          </span>
                        )}
                      </div>
                      {hasSubservices && (
                        <span className="ss-cat-count">
                          {items.length} {items.length === 1 ? "opción" : "opciones"}
                        </span>
                      )}
                      {hasSubservices && (
                        <span className={`ss-chevron ss-chevron-sm ${isExpanded ? "open" : ""}`}>▼</span>
                      )}
                    </div>

                    {hasSubservices && isExpanded && (
                      <div className="ss-servs animated-fade-in">
                        {items.map((s) => {
                          const isSelected = serviciosSeleccionados.includes(s.id);
                          const parsed = parseServiceName(s.nombre);

                          return (
                            <ServiceBackgroundCard
                              key={s.id}
                              nombre={parsed.subtitle || parsed.category}
                              tiempo={s.duracion}
                              background_id={parsed.fondo}
                              isSelected={isSelected}
                              onClick={() => manejarSeleccion(s.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {hasChanges && (
              <div className="ss-save-row">
                <button
                  onClick={guardarServicios}
                  className="ss-save-btn animated-fade-in-scale"
                  disabled={isSavingServicios}
                >
                  {isSavingServicios ? "Guardando..." : "💾 Guardar Cambios"}
                </button>
              </div>
            )}

            {mensajeServicios && (
              <div className={mensajeServicios.includes("✅") ? "wizard-success-alert" : (mensajeServicios.includes("⏳") ? "wizard-info-alert" : "wizard-error-alert")} style={{ marginTop: "16px" }}>
                {mensajeServicios}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="dd-card">
        <button
          type="button"
          className="dd-toggle"
          onClick={() => setDiasAbierto(!diasAbierto)}
          aria-expanded={diasAbierto}
        >
          <span className="dd-icon">🗓</span>
          <span className="dd-titles">
            <span className="dd-title">Mis Días Disponibles</span>
            <span className="dd-subtitle">Horario de atención semanal</span>
          </span>
          <span className="dd-badge">
            <span className="dd-badge-dot" />
            {diasSeleccionados.length} {diasSeleccionados.length === 1 ? "día activo" : "días activos"}
          </span>
          {horaInicio && horaFin ? (
            <span className="dd-horario-chip">🕘 {horaInicio} – {horaFin}</span>
          ) : (
            <span className="dd-horario-chip sin">🕘 Sin horario</span>
          )}
          <span className={`dd-chevron ${diasAbierto ? "open" : ""}`}>▼</span>
        </button>

        {diasAbierto && (
          <div className="dd-panel">
            <div className="dd-dias-grid">
              {diasSemana.map((dia) => {
                const isAvailable = diasSeleccionados.includes(dia);
                return (
                  <button
                    key={dia}
                    onClick={() => seleccionarDia(dia)}
                    className={`dd-dia-btn ${isAvailable ? "disponible" : "no-disponible"}`}
                    aria-pressed={isAvailable}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>

            <div className="dd-horario-grid">
              <div className="dd-hora-card">
                <label className="dd-hora-label">🕘 Hora de inicio</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="dd-hora-card">
                <label className="dd-hora-label">🕔 Hora de fin</label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            </div>

            <div className="ss-save-row">
              <button
                onClick={guardarDias}
                className="ss-save-btn"
                disabled={isSavingDias}
              >
                {isSavingDias ? "Guardando..." : "💾 Guardar Días"}
              </button>
            </div>

            {mensajeDias && (
              <div
                className={
                  mensajeDias.includes("✅") ? "wizard-success-alert" : (mensajeDias.includes("⏳") ? "wizard-info-alert" : "wizard-error-alert")
                }
                style={{ marginTop: "15px", width: "100%" }}
              >
                {mensajeDias}
              </div>
            )}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
