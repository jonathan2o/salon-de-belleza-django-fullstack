import React, { useState, useRef } from "react";
import { smoothScrollTo } from "../utils/smoothScroll";
import ServiceBackgroundCard from "./ServiceBackgroundCard";

const API_BASE = "/api";

const THEMES = [
  { id: "gold", label: "Oro" },
  { id: "silver", label: "Plata" },
  { id: "bronze", label: "Bronce" },
  { id: "obsidian", label: "Obsidiana" },
  { id: "sapphire", label: "Zafiro" },
  { id: "amethyst", label: "Amatista" },
  { id: "emerald", label: "Esmeralda" },
  { id: "ruby", label: "Rubí" },
  { id: "pink", label: "Rosa" },
  { id: "turquoise", label: "Turquesa" },
  { id: "violet", label: "Violeta" },
  { id: "marble", label: "Mármol" },
];

export default function AddServiceWizard({ fetchServicios, setParentMensaje }) {
  const [desplegado, setDesplegado] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [tituloConfirmado, setTituloConfirmado] = useState(false);
  const [subtitulos, setSubtitulos] = useState([
    { id: Date.now(), nombre: "", bloques: 2, fondo: "gold" }
  ]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cardRefs = useRef({});
  const panelRef = useRef(null);
  const step2Ref = useRef(null);

  // Auto-scroll function
  const scrollToElement = (element, blockMode = "start") => {
    if (element) {
      setTimeout(() => {
        // Reducimos drásticamente la duración a 350ms para un movimiento rápido y ágil.
        // Usamos block: "start" con un offset de 100px para que el elemento se ancle en la parte superior,
        // evitando que el formulario brinque o se reajuste mientras se expande dinámicamente.
        smoothScrollTo(element, { duration: 350, block: blockMode, offset: 100 });
      }, 30); // Solo 30ms para asegurar que el DOM inicializó el elemento
    }
  };

  const manejarContinuar = () => {
    if (!titulo.trim()) {
      setMensaje("❌ Por favor escribe el Título del Servicio.");
      return;
    }
    setMensaje("");
    setTituloConfirmado(true);
    
    // Desplazamiento casi inmediato al renderizar el Paso 2
    setTimeout(() => {
      if (step2Ref.current) {
        scrollToElement(step2Ref.current, "start");
      }
    }, 50);
  };

  const agregarTarjetaSubtitulo = () => {
    // Validate if the previous card has some input to prevent spam
    const ultimaTarjeta = subtitulos[subtitulos.length - 1];
    if (ultimaTarjeta && !ultimaTarjeta.nombre.trim()) {
      setMensaje("⚠️ Por favor ingresa el nombre del subtítulo actual antes de añadir otro.");
      if (cardRefs.current[ultimaTarjeta.id]) {
        scrollToElement(cardRefs.current[ultimaTarjeta.id], "center");
      }
      return;
    }

    const nuevoId = Date.now();
    const nuevaTarjeta = {
      id: nuevoId,
      nombre: "",
      bloques: 2,
      fondo: "gold",
    };

    setSubtitulos([...subtitulos, nuevaTarjeta]);
    setMensaje("");

    // Scroll casi inmediato a la nueva tarjeta
    setTimeout(() => {
      if (cardRefs.current[nuevoId]) {
        scrollToElement(cardRefs.current[nuevoId], "center");
      }
    }, 50);
  };

  const actualizarSubtitulo = (id, campo, valor) => {
    setSubtitulos(
      subtitulos.map((sub) => (sub.id === id ? { ...sub, [campo]: valor } : sub))
    );
  };

  const eliminarTarjeta = (id) => {
    // Prevent deleting the only card
    if (subtitulos.length === 1) {
      actualizarSubtitulo(id, "nombre", "");
      actualizarSubtitulo(id, "bloques", 2);
      actualizarSubtitulo(id, "fondo", "gold");
      return;
    }
    setSubtitulos(subtitulos.filter((sub) => sub.id !== id));
  };

  const guardarTodo = async () => {
    setMensaje("");
    
    // Validations
    if (!titulo.trim()) {
      setMensaje("❌ Por favor escribe el Título del Servicio.");
      return;
    }
    if (subtitulos.length === 0 || (subtitulos.length === 1 && !subtitulos[0].nombre.trim())) {
      setMensaje("❌ Debes configurar al menos un subtítulo.");
      return;
    }

    for (let i = 0; i < subtitulos.length; i++) {
      const sub = subtitulos[i];
      if (!sub.nombre.trim()) {
        setMensaje(`❌ Por favor escribe el nombre para el Subtítulo #${i + 1}.`);
        if (cardRefs.current[sub.id]) {
          scrollToElement(cardRefs.current[sub.id]);
        }
        return;
      }
      // Price is removed
    }

    setLoading(true);
    let guardadosConExito = 0;
    let errores = [];

    try {
      // Create each subtitle sequentially as a Django Servicio
      for (const sub of subtitulos) {
        const nombreCompleto = `${titulo.trim()} - ${sub.nombre.trim()} |fondo:${sub.fondo}|`;

        const res = await fetch(`${API_BASE}/servicios/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombreCompleto,
            bloques: Number(sub.bloques),
            precio: 0,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          guardadosConExito++;
          // Save color styling locally
          const localColors = JSON.parse(localStorage.getItem("servicio_colors") || "{}");
          localColors[nombreCompleto] = sub.fondo;
          localStorage.setItem("servicio_colors", JSON.stringify(localColors));
        } else {
          errores.push(data.error || `Error al guardar "${sub.nombre}"`);
        }
      }

      if (guardadosConExito === subtitulos.length) {
        const msg = `✅ Se guardaron correctamente ${guardadosConExito} servicios de "${titulo}".`;
        setMensaje(msg);
        if (setParentMensaje) setParentMensaje(msg);

        // Reset wizard
        setTitulo("");
        setTituloConfirmado(false);
        setSubtitulos([
          { id: Date.now(), nombre: "", bloques: 2, fondo: "gold" }
        ]);
        
        setTimeout(() => {
          setDesplegado(false);
        }, 1500);

        if (fetchServicios) fetchServicios();
      } else {
        setMensaje(`❌ Guardados: ${guardadosConExito}/${subtitulos.length}. Errores: ${errores.join(", ")}`);
      }
    } catch (error) {
      console.error(error);
      setMensaje("❌ Hubo un error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDespliegue = () => {
    setDesplegado(!desplegado);
    if (!desplegado) {
      setMensaje("");
      setTitulo("");
      setTituloConfirmado(false);
      setSubtitulos([
        { id: Date.now(), nombre: "", bloques: 2, fondo: "gold" }
      ]);
      setTimeout(() => {
        if (panelRef.current) {
          scrollToElement(panelRef.current, "start");
        }
      }, 30); // Minimizado a 30ms para sensación instantánea
    }
  };

  return (
    <section className="ad-card">
      {/* Accordion trigger card */}
      <button
        type="button"
        className="ad-header ad-header-gold"
        onClick={toggleDespliegue}
        aria-expanded={desplegado}
      >
        <span className="ad-icon">✨</span>
        <span className="ad-titles">
          <span className="ad-title">Añadir Servicios</span>
          <span className="ad-subtitle">Crea categorías con subtítulos y fondos</span>
        </span>
        <span className={`ad-chevron ${desplegado ? "open" : ""}`}>▼</span>
      </button>

      {/* Collapsible Panel */}
      <div ref={panelRef}>
        {desplegado && (
          <div className="ad-panel">
            
            {/* Status Alert */}
            {mensaje && (
              <div className={mensaje.includes("✅") ? "wizard-success-alert" : "wizard-error-alert"}>
                {mensaje}
              </div>
            )}

            {/* Título del Servicio */}
            <div className="ad-step">
              <div className="ad-step-head">
                <span className="ad-step-num">1</span>
                <h4 className="ad-step-title">Título del Servicio</h4>
              </div>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Cortes, Coloración, Peinados, Barbería..."
                className="ad-main-input"
                disabled={loading || tituloConfirmado}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    manejarContinuar();
                  }
                }}
              />

              {!tituloConfirmado && (
                <div className="ad-step-actions">
                  <button
                    type="button"
                    onClick={manejarContinuar}
                    className="ad-btn-gold"
                    disabled={loading || !titulo.trim()}
                  >
                    Continuar
                  </button>
                </div>
              )}
            </div>

            {/* PASO 2: Se revela dinámicamente sólo cuando el título está confirmado */}
            {tituloConfirmado && (
              <div ref={step2Ref} className="ad-step animated-fade-in">
                <div className="ad-step-head">
                  <span className="ad-step-num">2</span>
                  <h4 className="ad-step-title">Configuración de Subtítulos</h4>
                </div>

                <div className="ad-sub-list">
                  {subtitulos.map((sub, index) => {
                    return (
                      <div
                        key={sub.id}
                        ref={(el) => (cardRefs.current[sub.id] = el)}
                        className="ad-sub-card"
                      >
                        {/* Card Header */}
                        <div className="ad-sub-head">
                          <span className="ad-sub-chip">
                            Subtítulo #{index + 1}
                          </span>
                          {subtitulos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarTarjeta(sub.id)}
                              className="ad-sub-del"
                              title="Eliminar este subtítulo"
                              disabled={loading}
                            >
                              ❌
                            </button>
                          )}
                        </div>

                        {/* Card Input Fields Grouped */}
                        <div className="ad-sub-grid">
                          {/* Subtitle Name */}
                          <div className="ad-field">
                            <label className="ad-label">Nombre del subtítulo</label>
                            <input
                              type="text"
                              value={sub.nombre}
                              onChange={(e) => actualizarSubtitulo(sub.id, "nombre", e.target.value)}
                              placeholder="Ej. Corte para hombre, Corte para mujer..."
                              className="ad-input"
                              disabled={loading}
                            />
                          </div>

                          {/* Blocks Selection (1 to 30 blocks) */}
                          <div className="ad-field">
                            <label className="ad-label">Bloques (1 bloque = 30 min)</label>
                            <select
                              value={sub.bloques}
                              onChange={(e) => actualizarSubtitulo(sub.id, "bloques", Number(e.target.value))}
                              disabled={loading}
                              className="ad-input"
                            >
                              {Array.from({ length: 30 }, (_, i) => i + 1).map((b) => (
                                <option key={b} value={b}>
                                  {b} {b === 1 ? "bloque" : "bloques"} ({b * 30} minutos)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Gallery for Fondo de Servicio */}
                          <div className="ad-field wide">
                            <label className="ad-label">Fondo de Servicio (Identidad Visual)</label>
                            <div className="ad-theme-grid">
                              {THEMES.map((theme) => (
                                <div
                                  key={theme.id}
                                  className={`ad-theme ${sub.fondo === theme.id ? "active" : ""}`}
                                  onClick={() => actualizarSubtitulo(sub.id, "fondo", theme.id)}
                                >
                                  <img src={`/assets/fondos-servicios/${theme.id}.webp`} style={{objectFit: 'cover'}} alt={theme.label} />
                                  <span className="ad-theme-label">{theme.label}</span>
                                  {sub.fondo === theme.id && (
                                    <span className="ad-theme-check">✓</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Live Preview using ServiceCard */}
                          <div className="ad-field wide">
                            <label className="ad-label">Vista previa en tiempo real</label>
                            <div className="ad-preview">
                              <ServiceBackgroundCard
                                nombre={sub.nombre || "Subtítulo del servicio"}
                                tiempo={sub.bloques * 30}
                                background_id={sub.fondo}
                                isSelected={false}
                                onClick={() => {}}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Right-Aligned Buttons [ Añadir ] [ Guardar ] */}
                <div className="ad-actions">
                  <button
                    type="button"
                    onClick={agregarTarjetaSubtitulo}
                    className="ad-btn-ghost"
                    disabled={loading}
                  >
                    ➕ Añadir Subtítulo
                  </button>
                  <button
                    type="button"
                    onClick={guardarTodo}
                    className="ad-btn-gold"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="wizard-spinner"></span>
                        Guardando...
                      </>
                    ) : (
                      "💎 Guardar Servicios"
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>
        )}
      </div>
    </section>
  );
}
