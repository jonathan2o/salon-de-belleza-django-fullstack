import React, { useState, useEffect, useCallback } from "react";
import "./SolicitudesCitas.css";

const API_BASE = "/api";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const DIAS = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
];

const formatearFechaHora = (fechaStr, horaStr) => {
  try {
    const [y, m, d] = fechaStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const diaSemana = DIAS[dateObj.getDay()];
    const mesNombre = MESES[m - 1];

    let horaFormato = horaStr;
    if (horaStr) {
      const [h, min] = horaStr.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      horaFormato = `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
    }

    return `${diaSemana}, ${d} de ${mesNombre} · ${horaFormato}`;
  } catch (e) {
    return `${fechaStr} ${horaStr}`;
  }
};

const limpiarNombreServicio = (nombre) => {
  if (!nombre) return "Servicio";
  return nombre.replace(/\|fondo:[^|]+\|/g, "").replace(/\s*\([^)]+\)$/, "").trim();
};

export default function SolicitudesCitasCard({ trabajadorId, authFetch, onActualizar }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchSolicitudes = useCallback(async () => {
    if (!trabajadorId) return;
    try {
      setCargando(true);
      const res = await (authFetch || fetch)(
        `${API_BASE}/citas/pendientes/?trabajador=${trabajadorId}`
      );
      if (res.ok) {
        const data = await res.json();
        setSolicitudes(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error al cargar solicitudes de citas:", err);
    } finally {
      setCargando(false);
    }
  }, [trabajadorId, authFetch]);

  useEffect(() => {
    fetchSolicitudes();

    // Refresco periódico cada 25 segundos para detectar citas nuevas que agenden clientes
    const interval = setInterval(() => {
      fetchSolicitudes();
    }, 25000);

    return () => clearInterval(interval);
  }, [fetchSolicitudes]);

  const handleAccion = async (citaId, accion) => {
    setProcesandoId(citaId);
    setFeedback(null);

    try {
      const res = await (authFetch || fetch)(
        `${API_BASE}/citas/${citaId}/gestionar/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accion }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        // Remover cita de la lista de pendientes local
        setSolicitudes((prev) => prev.filter((c) => c.id !== citaId));

        const esAceptada = accion === "aceptar";
        setFeedback({
          tipo: esAceptada ? "success" : "danger",
          mensaje: esAceptada
            ? "✨ Cita aceptada exitosamente. Se ha incorporado a tu agenda."
            : "❌ Cita cancelada. El horario ha sido liberado.",
        });

        if (onActualizar) {
          onActualizar();
        }

        setTimeout(() => setFeedback(null), 5000);
      } else {
        alert(data.error || "Ocurrió un error al procesar la cita");
      }
    } catch (err) {
      alert("Error de conexión al procesar la cita");
    } finally {
      setProcesandoId(null);
    }
  };

  const totalPendientes = solicitudes.length;

  return (
    <section className="sc-card">
      <button
        type="button"
        className="sc-toggle"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
      >
        <span className="sc-icon">✨</span>

        <span className="sc-titles">
          <span className="sc-title">Aceptación de Citas</span>
          <span className="sc-subtitle">
            {totalPendientes > 0
              ? `Tienes ${totalPendientes} ${totalPendientes === 1 ? "solicitud agendada por cliente" : "solicitudes agendadas por clientes"}`
              : "Revisa y confirma las citas agendadas por tus clientes"}
          </span>
        </span>

        <span
          className={`sc-badge ${
            totalPendientes > 0 ? "sc-badge-pending" : "sc-badge-empty"
          }`}
        >
          <span className="sc-badge-dot" />
          {totalPendientes > 0
            ? `${totalPendientes} ${totalPendientes === 1 ? "pendiente" : "pendientes"}`
            : "Al día (0)"}
        </span>

        <span className={`sc-chevron ${abierto ? "open" : ""}`}>▼</span>
      </button>

      {abierto && (
        <div className="sc-panel">
          {feedback && (
            <div
              className={`sc-feedback-msg ${
                feedback.tipo === "success"
                  ? "sc-feedback-success"
                  : "sc-feedback-danger"
              }`}
            >
              <span>{feedback.mensaje}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ✕
              </button>
            </div>
          )}

          {cargando && solicitudes.length === 0 ? (
            <div className="sc-empty-state">
              <span className="sc-empty-icon">⏳</span>
              <h4 className="sc-empty-title">Consultando solicitudes...</h4>
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="sc-empty-state">
              <span className="sc-empty-icon">🎉</span>
              <h4 className="sc-empty-title">¡Estás al día!</h4>
              <p className="sc-empty-desc">
                No tienes solicitudes de citas pendientes en este momento. Cuando un
                cliente agende una cita manualmente, aparecerá aquí de inmediato para
                que la aceptes o canceles.
              </p>
            </div>
          ) : (
            <div className="sc-grid">
              {solicitudes.map((cita) => {
                const enProceso = procesandoId === cita.id;
                const telLimpio = (cita.telefono || "").replace(/\D/g, "");
                const waLink = telLimpio
                  ? `https://wa.me/57${telLimpio}?text=${encodeURIComponent(
                      `Hola ${cita.nombre}, te escribo de Salón de Belleza respecto a tu cita agendada.`
                    )}`
                  : null;

                return (
                  <div key={cita.id} className="sc-item-card">
                    <div className="sc-item-top">
                      <span className="sc-datetime-badge">
                        📅 {formatearFechaHora(cita.fecha, cita.hora)}
                      </span>
                      <span className="sc-origin-pill">
                        {cita.origen === "cliente_manual"
                          ? "Agendada por Cliente"
                          : "Solicitud Externa"}
                      </span>
                    </div>

                    <div className="sc-item-body">
                      <div className="sc-client-info">
                        <span className="sc-client-name">
                          👤 {cita.nombre || "Cliente"}
                        </span>
                        <div className="sc-client-contact">
                          <a
                            href={`tel:${cita.telefono}`}
                            className="sc-phone-link"
                            title="Llamar al cliente"
                          >
                            📞 {cita.telefono || "Sin teléfono"}
                          </a>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="sc-btn-whatsapp"
                              title="Contactar al cliente por WhatsApp"
                            >
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="sc-service-info">
                        <span className="sc-service-badge">
                          ✂️ {limpiarNombreServicio(cita.servicio_nombre)}
                        </span>
                        <div className="sc-service-meta">
                          {cita.servicio_duracion && (
                            <span>⏱ {cita.servicio_duracion} min</span>
                          )}
                          {cita.servicio_precio && (
                            <span className="sc-meta-price">
                              💵 ${Number(cita.servicio_precio).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="sc-item-actions">
                      <button
                        type="button"
                        className="sc-btn sc-btn-accept"
                        disabled={enProceso}
                        onClick={() => handleAccion(cita.id, "aceptar")}
                      >
                        {enProceso ? (
                          <span className="sc-spinner" />
                        ) : (
                          <>✓ Aceptar Cita</>
                        )}
                      </button>

                      <button
                        type="button"
                        className="sc-btn sc-btn-cancel"
                        disabled={enProceso}
                        onClick={() => handleAccion(cita.id, "cancelar")}
                      >
                        {enProceso ? (
                          <span className="sc-spinner" />
                        ) : (
                          <>✕ Cancelar Cita</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
