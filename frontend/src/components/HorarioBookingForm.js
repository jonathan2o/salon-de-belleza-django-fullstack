import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import ServiceBackgroundCard from "./ServiceBackgroundCard";

const API_BASE = "/api";

const addMinutesToTime = (timeStr, minutesToAdd) => {
  const parts = timeStr.split(":");
  let hours = parseInt(parts[0], 10);
  let minutes = parseInt(parts[1], 10);
  minutes += minutesToAdd;
  hours += Math.floor(minutes / 60);
  hours = hours % 24;
  minutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

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

export default function HorarioBookingForm({ trabajadorId, fecha, hora, servicios, onBooked }) {
  const { authFetch } = useContext(AuthContext);

  const [nombre, setNombre] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [categoriaExpandida, setCategoriaExpandida] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensajeCita, setMensajeCita] = useState("");
  const [citaExitosa, setCitaExitosa] = useState(false);

  const categoriasObj = {};
  (servicios || []).forEach((s) => {
    let catName = "Otros Servicios";
    if (s.nombre.includes(" - ")) {
      catName = s.nombre.split(" - ")[0].trim();
    }
    if (!categoriasObj[catName]) categoriasObj[catName] = [];
    categoriasObj[catName].push(s);
  });

  const handleServiceSelect = (servicio) => {
    if (!serviciosSeleccionados.find((s) => s.id === servicio.id)) {
      setServiciosSeleccionados([...serviciosSeleccionados, servicio]);
      setMensajeCita("");
    }
  };

  const handleRemoveService = (id) => {
    setServiciosSeleccionados(serviciosSeleccionados.filter((s) => s.id !== id));
  };

  const crearCita = async () => {
    if (!nombre.trim() || telefonoCliente.length !== 10) return;
    if (serviciosSeleccionados.length === 0 || !trabajadorId || !fecha || !hora) return;

    setLoading(true);
    setMensajeCita("");

    try {
      let currentHora = hora;
      for (let i = 0; i < serviciosSeleccionados.length; i++) {
        const s = serviciosSeleccionados[i];
        const res = await authFetch(`${API_BASE}/citas/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre,
            telefono: telefonoCliente,
            servicio: s.id,
            trabajador: trabajadorId,
            fecha,
            hora: currentHora,
            estado: "confirmada",
            origen: "directo",
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "No se pudo agendar la cita para " + s.nombre);
        }

        const duracion = s.duracion || (s.bloques ? s.bloques * 30 : 30);
        currentHora = addMinutesToTime(currentHora, duracion);
      }

      setCitaExitosa(true);
    } catch (err) {
      setMensajeCita(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (citaExitosa) {
    return (
      <div className="horario-booking-form">
        <div className="premium-confirmation-card">
          <div className="premium-header">
            <h3>¡Cita agendada!</h3>
            <p>La reserva fue registrada correctamente.</p>
          </div>

          <div className="premium-detail-row">
            <span className="premium-label">👤 Cliente</span>
            <span className="premium-value">{nombre}</span>
          </div>

          <div className="premium-detail-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <span className="premium-label" style={{ marginBottom: "10px" }}>✂ Servicios</span>
            {serviciosSeleccionados.map((s) => {
              const parsed = parseServiceName(s.nombre);
              return (
                <div key={s.id} style={{ width: "100%", marginBottom: "8px" }}>
                  <ServiceBackgroundCard
                    nombre={parsed.subtitle || parsed.category}
                    tiempo={s.duracion || (s.bloques ? s.bloques * 30 : 30)}
                    background_id={parsed.fondo}
                    isSelected={true}
                    onClick={() => {}}
                  />
                </div>
              );
            })}
          </div>

          <div className="premium-detail-row">
            <span className="premium-label">📅 Fecha</span>
            <span className="premium-value">{fecha}</span>
          </div>

          <div className="premium-detail-row">
            <span className="premium-label">🕒 Hora</span>
            <span className="premium-value">{hora}</span>
          </div>

          <button className="btn-finalizar" onClick={onBooked}>
            Finalizar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="horario-booking-form">
      {mensajeCita && <div className="error-mensaje">{mensajeCita}</div>}

      <div className="form-section active fade-in-section">
        <label>👤 Nombre</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ingresa el nombre del cliente"
          disabled={loading}
        />
      </div>

      <div className="form-section active fade-in-section">
        <label>📞 Teléfono</label>
        <input
          type="tel"
          value={telefonoCliente}
          onChange={(e) => setTelefonoCliente(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="Ej. 3001234567"
          maxLength={10}
          disabled={loading}
        />
      </div>

      <div className="form-section active fade-in-section">
        <button
          type="button"
          className="custom-dropdown-toggle"
          onClick={() => setDropdownAbierto(!dropdownAbierto)}
          disabled={loading}
        >
          {dropdownAbierto ? "▼ ✂ Seleccionar servicios" : "▶ ✂ Seleccionar servicios"}
        </button>

        {dropdownAbierto && (
          <div className="custom-dropdown-menu">
            {Object.keys(categoriasObj).map((catName) => (
              <div key={catName} className="dropdown-category">
                <button
                  type="button"
                  className={`premium-category-header ${categoriaExpandida === catName ? "open" : ""}`}
                  onClick={() => setCategoriaExpandida(categoriaExpandida === catName ? null : catName)}
                >
                  <div className="premium-category-icon-wrapper">
                    <span className="premium-category-icon">✂</span>
                  </div>
                  <div className="premium-category-info">
                    <span className="premium-category-title">{catName}</span>
                    <span className="premium-category-subtitle">
                      {categoriasObj[catName].length} {categoriasObj[catName].length === 1 ? "servicio disponible" : "servicios disponibles"}
                    </span>
                  </div>
                  <div className="premium-category-arrow">▶</div>
                </button>

                {categoriaExpandida === catName && (
                  <div className="category-services">
                    {categoriasObj[catName].map((s) => {
                      const isSelected = serviciosSeleccionados.some((sel) => sel.id === s.id);
                      const parsed = parseServiceName(s.nombre);
                      return (
                        <ServiceBackgroundCard
                          key={s.id}
                          nombre={parsed.subtitle || parsed.category}
                          tiempo={s.duracion || (s.bloques ? s.bloques * 30 : 30)}
                          background_id={parsed.fondo}
                          isSelected={isSelected}
                          onClick={() => handleServiceSelect(s)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {serviciosSeleccionados.length > 0 && (
        <div className="form-section active fade-in-section">
          <label>Servicios seleccionados</label>
          {serviciosSeleccionados.map((s) => {
            const parsed = parseServiceName(s.nombre);
            return (
              <div key={s.id} className="selected-service-row">
                <ServiceBackgroundCard
                  nombre={parsed.subtitle || parsed.category}
                  tiempo={s.duracion || (s.bloques ? s.bloques * 30 : 30)}
                  background_id={parsed.fondo}
                  isSelected={true}
                  onClick={() => {}}
                />
                <button
                  type="button"
                  className="remove-service-btn"
                  onClick={() => handleRemoveService(s.id)}
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="btn-finalizar"
        onClick={crearCita}
        disabled={loading || nombre.trim().length < 2 || telefonoCliente.length !== 10 || serviciosSeleccionados.length === 0}
      >
        {loading ? "Agendando..." : "Finalizar"}
      </button>
    </div>
  );
}
