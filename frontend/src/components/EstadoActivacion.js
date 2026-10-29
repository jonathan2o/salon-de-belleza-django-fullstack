import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const API_BASE = "/api";

/* ── Overlay flotante de activación manual del turno del trabajador ──
   Se muestra al entrar al panel si no hay ingreso registrado HOY.
   Desenfoca todo el panel hasta que activa su estado manualmente.     */
export default function EstadoActivacion({ onActivado }) {
  const { user, authFetch } = useContext(AuthContext);
  const [verificando, setVerificando] = useState(true);
  const [mostrar, setMostrar] = useState(false);
  const [activando, setActivando] = useState(false);
  const [activado, setActivado] = useState(false);
  const [error, setError] = useState("");

  // Verificar si el trabajador ya registró su ingreso hoy
  useEffect(() => {
    if (!user?.trabajador_id) {
      setVerificando(false);
      return;
    }

    let cancelado = false;
    const verificar = async () => {
      try {
        const res = await fetch(`${API_BASE}/trabajadores/`);
        if (!res.ok) {
          if (!cancelado) setVerificando(false);
          return;
        }
        const data = await res.json();
        const yo = (Array.isArray(data) ? data : []).find(
          (t) => String(t.id) === String(user.trabajador_id),
        );
        if (cancelado) return;
        // hora_ingreso vacía → todavía no activó hoy → mostrar overlay
        setMostrar(Boolean(yo && !yo.hora_ingreso));
        setVerificando(false);
      } catch (e) {
        console.error(e);
        if (!cancelado) setVerificando(false);
      }
    };

    verificar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Cerrar con fade tras la activación exitosa
  useEffect(() => {
    if (!activado) return;
    const t = setTimeout(() => setMostrar(false), 1400);
    return () => clearTimeout(t);
  }, [activado]);

  if (verificando) {
    return (
      <div className="st-ov-fondo st-ov-suave">
        <div className="st-ov-card st-ov-cargando">
          <span className="st-ov-spinner"></span>
          <span className="st-ov-cargando-texto">Verificando tu estado…</span>
        </div>
      </div>
    );
  }

  if (!user?.trabajador_id || !mostrar) return null;

  const activarTurno = async () => {
    if (activando || activado) return;
    setActivando(true);
    setError("");
    try {
      const res = await authFetch(
        `${API_BASE}/trabajadores/${user.trabajador_id}/ingreso/`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo activar el turno");
      }
      setActivado(true);
      onActivado?.();
    } catch (e) {
      setError("❌ " + (e.message || "No se pudo activar el turno"));
    } finally {
      setActivando(false);
    }
  };

  return (
    <div className={`st-ov-fondo ${activado ? "st-ov-saliendo" : ""}`}>
      <div className={`st-ov-card ${activado ? "st-ov-success" : ""}`}>
        <span className="st-ov-halo">
          <span className="st-ov-avatar">
            {(user.nombre || user.correo || "?").charAt(0).toUpperCase()}
          </span>
        </span>

        <h3 className="st-ov-titulo">
          {activado ? "✅ Activado — ¡Buen turno!" : "Activa tu estado de trabajador"}
        </h3>

        <p className="st-ov-sub">
          {activado ? (
            "Ingreso registrado. ¡Comenzamos el turno!"
          ) : (
            <>
             Hola, <strong>{user.nombre}</strong>. Tu estado hoy es{" "}
              <span className="st-ov-estado-destacado">Sin servicio</span>.
              <br />
              Activa tu ingreso para comenzar tu turno.
            </>
          )}
        </p>

        {!activado && (
          <button
            type="button"
            className="st-ov-btn"
            onClick={activarTurno}
            disabled={activando}
          >
            {activando ? (
              <>
                <span className="st-ov-spinner st-ov-spinner-btn"></span>
                Activando…
              </>
            ) : (
              "🟢 Estás activo"
            )}
          </button>
        )}

        {error && <p className="st-ov-error">{error}</p>}

        <span className="st-ov-hora">
          🕒 {new Date().toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
