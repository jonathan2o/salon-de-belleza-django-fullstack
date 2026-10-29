import React, { useState, useEffect, useCallback } from "react";
import "./PermisoContabilidadPanel.css";

const API_BASE = "/api";

/**
 * Panel que se incrusta en la sección "Trabajadores Registrados" del AdminWelcomePage.
 * Muestra el toggle de permiso de contabilidad por trabajador con confirmación.
 *
 * Props:
 *   - trabajadores: array de trabajadores ya cargados desde el padre
 *   - tokens: objeto { access } del AuthContext
 *   - onUpdate: callback para recargar la lista de trabajadores en el padre
 */
export default function PermisoContabilidadPanel({ trabajadores, tokens, onUpdate }) {
  const [loadingId, setLoadingId] = useState(null);
  const [msg, setMsg] = useState({ id: null, text: "", ok: true });

  const authHeader = useCallback(() => {
    if (tokens?.access) return { Authorization: `Bearer ${tokens.access}` };
    return {};
  }, [tokens]);

  const togglePermiso = async (t) => {
    const accion = t.permiso_contabilidad ? "retirar" : "conceder";
    const confirmMsg = t.permiso_contabilidad
      ? `¿Retirar el permiso de contabilidad a ${t.nombre} ${t.apellidos}?`
      : `¿Conceder permiso de contabilidad a ${t.nombre} ${t.apellidos}?\n\nEste trabajador podrá registrar servicios y ver su historial de quincenas.`;

    if (!window.confirm(confirmMsg)) return;

    setLoadingId(t.id);
    setMsg({ id: null, text: "", ok: true });

    try {
      const res = await fetch(
        `${API_BASE}/trabajadores/${t.id}/permiso-contabilidad/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({ permiso_contabilidad: !t.permiso_contabilidad }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setMsg({
          id: t.id,
          text: `✅ Permiso ${accion === "conceder" ? "concedido" : "retirado"} a ${t.nombre}.`,
          ok: true,
        });
        if (onUpdate) onUpdate();
      } else {
        setMsg({
          id: t.id,
          text: `❌ ${data.error || "No se pudo actualizar el permiso."}`,
          ok: false,
        });
      }
    } catch {
      setMsg({ id: t.id, text: "❌ Error de conexión.", ok: false });
    } finally {
      setLoadingId(null);
    }
  };

  if (!trabajadores || trabajadores.length === 0) {
    return (
      <div className="pcp-empty">No hay trabajadores registrados.</div>
    );
  }

  return (
    <div className="pcp-container">
      <div className="pcp-header">
        <span className="pcp-icon">🔐</span>
        <div>
          <h4 className="pcp-title">Permisos de Contabilidad</h4>
          <p className="pcp-sub">
            Activa o desactiva el acceso de cada trabajador al módulo de contabilidad.
          </p>
        </div>
      </div>

      <div className="pcp-list">
        {trabajadores.map((t) => {
          const isLoading = loadingId === t.id;
          const hasPermiso = !!t.permiso_contabilidad;

          return (
            <div
              key={t.id}
              className={`pcp-item ${hasPermiso ? "pcp-item-on" : ""}`}
            >
              <div className="pcp-item-info">
                <div className="pcp-avatar">
                  {(t.nombre || "?")[0].toUpperCase()}
                </div>
                <div>
                  <span className="pcp-name">
                    {t.nombre} {t.apellidos}
                  </span>
                  <span className="pcp-correo">{t.correo}</span>
                </div>
              </div>

              <div className="pcp-item-right">
                {msg.id === t.id && (
                  <span
                    className={`pcp-msg ${msg.ok ? "pcp-msg-ok" : "pcp-msg-err"}`}
                  >
                    {msg.text}
                  </span>
                )}
                <div className="pcp-badge-wrap">
                  <span className={`pcp-status ${hasPermiso ? "pcp-on" : "pcp-off"}`}>
                    {hasPermiso ? "✅ Autorizado" : "⛔ Sin permiso"}
                  </span>
                  <button
                    className={`pcp-toggle-btn ${hasPermiso ? "pcp-toggle-revoke" : "pcp-toggle-grant"}`}
                    onClick={() => togglePermiso(t)}
                    disabled={isLoading}
                    title={hasPermiso ? "Retirar permiso" : "Conceder permiso"}
                  >
                    {isLoading ? (
                      <span className="pcp-spinner" />
                    ) : hasPermiso ? (
                      "Retirar"
                    ) : (
                      "Conceder"
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
