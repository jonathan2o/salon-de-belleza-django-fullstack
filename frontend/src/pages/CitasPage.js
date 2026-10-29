import { useEffect, useState, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Carousel from "../components/Carousel";
import ServiceBackgroundCard from "../components/ServiceBackgroundCard";
import { smoothScrollTo } from "../utils/smoothScroll";

const API_BASE = "/api";

const formatTime12h = (timeStr) => {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hoursStr}:${minutes} ${ampm}`;
};

const addMinutesToTime = (timeStr, minutesToAdd) => {
  const parts = timeStr.split(":");
  let hours = parseInt(parts[0], 10);
  let minutes = parseInt(parts[1], 10);
  minutes += minutesToAdd;
  hours += Math.floor(minutes / 60);
  hours = hours % 24; 
  minutes = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getDayOfWeekName = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return days[date.getDay()];
};

const getUpcomingDateForWeekday = (weekdayName) => {
  const daysOrder = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const targetIndex = daysOrder.indexOf(weekdayName);
  if (targetIndex === -1) return "";

  const today = new Date();
  const currentDayIndex = today.getDay();

  let diff = targetIndex - currentDayIndex;
  if (diff < 0) {
    diff += 7;
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
  const dd = String(targetDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const generateAllHours = (startStr, endStr) => {
  if (!startStr || !endStr) return [];
  const parseTime = (timeStr) => {
    const parts = timeStr.split(":");
    return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
  };
  const start = parseTime(startStr);
  const end = parseTime(endStr);
  const hoursList = [];
  let currentHours = start.hours;
  let currentMinutes = start.minutes;
  while (currentHours < end.hours || (currentHours === end.hours && currentMinutes < end.minutes)) {
    const hh = String(currentHours).padStart(2, '0');
    const mm = String(currentMinutes).padStart(2, '0');
    hoursList.push(`${hh}:${mm}`);
    currentMinutes += 30;
    if (currentMinutes >= 60) {
      currentHours += 1;
      currentMinutes -= 60;
    }
  }
  return hoursList;
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



export default function CitasPage() {
  const { authFetch } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Data State
  const [trabajadores, setTrabajadores] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [horas, setHoras] = useState([]);
  
  // Form State
  const [nombre, setNombre] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
  const [trabajadorId, setTrabajadorId] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [mensajeCita, setMensajeCita] = useState("");
  const [disponibilidadTrabajador, setDisponibilidadTrabajador] = useState({
    dias_disponibles: [], hora_inicio: "", hora_fin: "",
  });

  // UI Flow State (Progressive Disclosure)
  const [stepNombreCompleted, setStepNombreCompleted] = useState(false);
  const [stepTelefonoCompleted, setStepTelefonoCompleted] = useState(false);
  const [stepServiciosCompleted, setStepServiciosCompleted] = useState(false);
  const [stepTrabajadorCompleted, setStepTrabajadorCompleted] = useState(false);
  const [stepFechaCompleted, setStepFechaCompleted] = useState(false);
  const [stepHoraCompleted, setStepHoraCompleted] = useState(false);

  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [categoriaExpandida, setCategoriaExpandida] = useState(null);
  const [citaExitosa, setCitaExitosa] = useState(false);

  // Temporary Messages State
  const [msgTempTelefono, setMsgTempTelefono] = useState(false);
  const [msgTempServicio, setMsgTempServicio] = useState(false);
  const [msgTempTrabajador, setMsgTempTrabajador] = useState(false);
  const [msgTempDia, setMsgTempDia] = useState(false);
  const [msgTempHora, setMsgTempHora] = useState(false);

  // Refs for auto-scroll
  const telefonoRef = useRef(null);
  const serviciosRef = useRef(null);
  const seleccionadosRef = useRef(null);
  const trabajadorRef = useRef(null);
  const disponibilidadRef = useRef(null);
  const horasRef = useRef(null);
  const agendarRef = useRef(null);
  const confirmacionRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/servicios/`)
      .then((res) => res.json())
      .then((data) => setServicios(data));
  }, []);

  useEffect(() => {
    if (serviciosSeleccionados.length > 0 && trabajadores.length === 0) {
      fetch(`${API_BASE}/trabajadores/`)
        .then((res) => res.json())
        .then((data) => setTrabajadores(data));
    }
  }, [serviciosSeleccionados, trabajadores.length]);

  // Fetch hours when worker and date are selected
  useEffect(() => {
    if (trabajadorId && fecha) {
      const selectedDayName = getDayOfWeekName(fecha);
      const isWorkingDay = disponibilidadTrabajador?.dias_disponibles?.includes(selectedDayName);
      if (isWorkingDay) {
        fetch(`${API_BASE}/horas/?trabajador=${trabajadorId}&fecha=${fecha}`)
          .then((res) => res.json())
          .then((data) => setHoras(data));
      } else {
        setHoras([]);
      }
    }
  }, [trabajadorId, fecha, disponibilidadTrabajador]);

  // Handlers for Progression
  const handleNombreBlur = () => {
    if (nombre.trim().length >= 2 && !stepNombreCompleted) {
      setStepNombreCompleted(true);
      setTimeout(() => smoothScrollTo(telefonoRef.current, { duration: 300, block: "center" }), 150);
    }
  };

  const handleSiguienteNombre = () => {
    if (nombre.trim().length >= 2) {
      setStepNombreCompleted(true);
      setTimeout(() => smoothScrollTo(telefonoRef.current, { duration: 300, block: "center" }), 150);
    }
  };

  const handleTelefonoChange = (e) => {
    const valor = e.target.value.replace(/\D/g, '');
    if (valor.length <= 10) {
      setTelefonoCliente(valor);
      if (valor.length === 10) {
        setStepTelefonoCompleted(true);
        setMsgTempTelefono(true);
        setTimeout(() => setMsgTempTelefono(false), 2000);
        setTimeout(() => {
          setDropdownAbierto(true);
          smoothScrollTo(serviciosRef.current, { duration: 400, block: "center" });
        }, 800);
      } else {
        setStepTelefonoCompleted(false);
      }
    }
  };

  const handleServiceSelect = (servicio) => {
    if (!serviciosSeleccionados.find((s) => s.id === servicio.id)) {
      setServiciosSeleccionados([...serviciosSeleccionados, servicio]);
      setStepServiciosCompleted(false);
      setStepTrabajadorCompleted(false);
      setStepFechaCompleted(false);
      setStepHoraCompleted(false);
      setTrabajadorId("");
      setFecha("");
      setHora("");
      
      setMsgTempServicio(true);
      setTimeout(() => setMsgTempServicio(false), 2000);
      
      setTimeout(() => {
        setDropdownAbierto(false);
        smoothScrollTo(seleccionadosRef.current, { duration: 300, block: "center" });
      }, 600);
    }
  };

  const handleContinuarServicios = () => {
    setStepServiciosCompleted(true);
    setTimeout(() => smoothScrollTo(trabajadorRef.current, { duration: 400, block: "center" }), 150);
  };

  const handleAddAnotherService = () => {
    setStepServiciosCompleted(false);
    setDropdownAbierto(true);
    setTimeout(() => smoothScrollTo(serviciosRef.current, { duration: 300, block: "center" }), 150);
  };

  const handleRemoveService = (id) => {
    const newSelected = serviciosSeleccionados.filter(s => s.id !== id);
    setServiciosSeleccionados(newSelected);
    if (newSelected.length === 0) {
      setStepServiciosCompleted(false);
      setDropdownAbierto(true);
      setTimeout(() => smoothScrollTo(serviciosRef.current, { duration: 300, block: "center" }), 150);
    }
    setStepTrabajadorCompleted(false);
    setStepFechaCompleted(false);
    setStepHoraCompleted(false);
    setTrabajadorId("");
    setFecha("");
    setHora("");
  };

  const handleTrabajadorSelect = (id) => {
    setTrabajadorId(id);
    setStepTrabajadorCompleted(true);
    setStepFechaCompleted(false);
    setStepHoraCompleted(false);
    setFecha("");
    setHora("");
    
    const tgSeleccionado = trabajadores.find((t) => t.id === Number(id));
    if (tgSeleccionado) {
      setDisponibilidadTrabajador({
        dias_disponibles: tgSeleccionado.dias_disponibles || [],
        hora_inicio: tgSeleccionado.hora_inicio || "",
        hora_fin: tgSeleccionado.hora_fin || "",
      });
    }

    if (id) {
      setMsgTempTrabajador(true);
      setTimeout(() => setMsgTempTrabajador(false), 2000);
      setTimeout(() => smoothScrollTo(disponibilidadRef.current, { duration: 400, block: "center" }), 800);
    }
  };

  const handleFechaSelect = (upcomingDate) => {
    setFecha(upcomingDate);
    setStepFechaCompleted(true);
    setStepHoraCompleted(false);
    setHora("");

    setMsgTempDia(true);
    setTimeout(() => setMsgTempDia(false), 2000);
    setTimeout(() => smoothScrollTo(horasRef.current, { duration: 400, block: "center" }), 800);
  };

  const handleHoraSelect = (h) => {
    setHora(h);
    setStepHoraCompleted(true);

    setMsgTempHora(true);
    setTimeout(() => setMsgTempHora(false), 2000);
    setTimeout(() => smoothScrollTo(agendarRef.current, { duration: 400, block: "center" }), 800);
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
            estado: "pendiente",
            origen: "cliente_manual",
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
      setTimeout(() => smoothScrollTo(confirmacionRef.current, { duration: 400, block: "center" }), 200);

    } catch (err) {
      setMensajeCita(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setCitaExitosa(false);
    setNombre("");
    setTelefonoCliente("");
    setServiciosSeleccionados([]);
    setTrabajadorId("");
    setFecha("");
    setHora("");
    setStepNombreCompleted(false);
    setStepTelefonoCompleted(false);
    setStepServiciosCompleted(false);
    setStepTrabajadorCompleted(false);
    setStepFechaCompleted(false);
    setStepHoraCompleted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pre-calculations
  const selectedDayName = getDayOfWeekName(fecha);
  const isWorkingDay = fecha ? disponibilidadTrabajador?.dias_disponibles?.includes(selectedDayName) : true;

  const todosLosServicios = servicios || [];

  const categoriasObj = {};
  todosLosServicios.forEach((s) => {
    let catName = "Otros Servicios";
    let subName = s.nombre;
    if (s.nombre.includes(" - ")) {
      const parts = s.nombre.split(" - ");
      catName = parts[0].trim();
      subName = parts.slice(1).join(" - ").trim();
    }
    if (!categoriasObj[catName]) categoriasObj[catName] = [];
    categoriasObj[catName].push({ ...s, subName });
  });

  const trabajadoresFiltrados = trabajadores.filter((t) => {
    if (serviciosSeleccionados.length === 0) return false;
    const workerServiceIds = (t.servicios || []).map(s => s.id);
    return serviciosSeleccionados.every(ss => workerServiceIds.includes(ss.id));
  });

  const allGeneratedHours = generateAllHours(
    disponibilidadTrabajador?.hora_inicio,
    disponibilidadTrabajador?.hora_fin
  );

  // If appointment is booked, show ONLY the premium card
  if (citaExitosa) {
    const trabajadorSeleccionado = trabajadores.find(t => t.id === Number(trabajadorId));
    return (
      <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Carousel />
        <div ref={confirmacionRef} className="premium-confirmation-card">
          <div className="premium-header">
            <h2>🎉 ¡Solicitud de Cita Enviada!</h2>
            <p>Tu solicitud fue registrada con éxito.<br/>Tu estilista la confirmará directamente desde su panel de citas.</p>
          </div>
          
          <div className="premium-detail-row">
            <span className="premium-label">👤 Cliente</span>
            <span className="premium-value">{nombre}</span>
          </div>

          <div className="premium-detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="premium-label" style={{ marginBottom: '10px' }}>✂ Servicios</span>
            <div style={{ width: '100%', textAlign: 'left', paddingLeft: '20px' }}>
              {serviciosSeleccionados.map(s => {
                const parsed = parseServiceName(s.nombre);
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', width: '100%' }}>
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
          </div>

          <div className="premium-detail-row">
            <span className="premium-label">💈 Trabajador</span>
            <span className="premium-value">{trabajadorSeleccionado?.nombre}</span>
          </div>

          <div className="premium-detail-row">
            <span className="premium-label">📅 Fecha</span>
            <span className="premium-value">{selectedDayName}</span>
          </div>

          <div className="premium-detail-row">
            <span className="premium-label">🕒 Hora</span>
            <span className="premium-value">{formatTime12h(hora)}</span>
          </div>

          <div className="premium-detail-row">
            <span className="premium-label">📍 Estado</span>
            <span className="status-confirmada">🟢 Confirmada</span>
          </div>

          <button className="btn-finalizar" onClick={resetFlow}>
            Finalizar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Carousel />
      <h2 className="page-title" style={{ marginBottom: '40px' }}>Agendar Cita</h2>
      
      {mensajeCita && <div className="error-mensaje" style={{ marginBottom: '20px' }}>{mensajeCita}</div>}

      <div className="progressive-form" style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '100px' }}>
        
        {/* PASO 1: Nombre */}
        <div className="form-section active fade-in-section">
          <label>👤 Nombre</label>
          <div className="nombre-input-group">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={handleNombreBlur}
              onKeyDown={(e) => { 
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSiguienteNombre();
                }
              }}
              placeholder="Ingresa tu nombre completo"
              disabled={loading}
            />
            <button
              type="button"
              className="btn-siguiente-nombre"
              onClick={handleSiguienteNombre}
              disabled={loading || nombre.trim().length < 2}
            >
              Siguiente
            </button>
          </div>
        </div>

        {/* PASO 2: Teléfono */}
        {(stepNombreCompleted || telefonoCliente.length > 0) && (
          <div ref={telefonoRef} className="form-section active fade-in-section">
            <label>📞 Teléfono</label>
            <input
              type="tel"
              value={telefonoCliente}
              onChange={handleTelefonoChange}
              placeholder="Ej. 3001234567"
              maxLength={10}
              disabled={loading}
            />
            {msgTempTelefono && <div className="success-message-temp">✓ Número válido</div>}
          </div>
        )}

        {/* PASO 3: Selección de Servicios */}
        {stepTelefonoCompleted && (
          <div ref={serviciosRef} className="form-section active fade-in-section" style={{ marginTop: '20px' }}>
            <div className="custom-dropdown-container">
              <button 
                className="custom-dropdown-toggle"
                onClick={() => setDropdownAbierto(!dropdownAbierto)}
                style={{ textAlign: 'center', background: 'rgba(255, 107, 26, 0.1)', border: '1px solid rgba(255, 107, 26, 0.4)' }}
              >
                {dropdownAbierto ? "▼ ✂ Seleccionar servicios" : "▶ ✂ Seleccionar servicios"}
              </button>
              
              {dropdownAbierto && (
                <div className="custom-dropdown-menu">
                  {Object.keys(categoriasObj).map((catName) => (
                    <div key={catName} className="dropdown-category">
                      <button 
                        className={`premium-category-header ${categoriaExpandida === catName ? 'open' : ''}`}
                        onClick={() => setCategoriaExpandida(categoriaExpandida === catName ? null : catName)}
                      >
                        <div className="premium-category-icon-wrapper">
                          <span className="premium-category-icon">
                            {(() => {
                              const n = catName.toLowerCase();
                              if (n.includes('corte')) return '✂';
                              if (n.includes('color') || n.includes('tinte') || n.includes('mecha')) return '🎨';
                              if (n.includes('barba')) return '🧔';
                              if (n.includes('trata') || n.includes('spa')) return '💈';
                              if (n.includes('manicure') || n.includes('pedicure') || n.includes('uña')) return '💅';
                              if (n.includes('depila') || n.includes('ceja') || n.includes('pestaña')) return '✨';
                              if (n.includes('maquilla')) return '💄';
                              return '✨';
                            })()}
                          </span>
                        </div>
                        <div className="premium-category-info">
                          <span className="premium-category-title">{catName}</span>
                          <span className="premium-category-subtitle">
                            {categoriasObj[catName].length} {categoriasObj[catName].length === 1 ? 'servicio disponible' : 'servicios disponibles'}
                          </span>
                        </div>
                        <div className="premium-category-arrow">▶</div>
                      </button>
                      
                      {categoriaExpandida === catName && (
                        <div className="category-services">
                          {categoriasObj[catName].map((s) => {
                            const isSelected = serviciosSeleccionados.some(sel => sel.id === s.id);
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
            {msgTempServicio && <div className="success-message-temp">✓ Servicio agregado correctamente</div>}
          </div>
        )}

        {/* PASO 4: Servicios Seleccionados */}
        {serviciosSeleccionados.length > 0 && (
          <div ref={seleccionadosRef} className="form-section active fade-in-section" style={{ marginTop: '20px' }}>
            <label style={{ fontSize: "16px", color: "white", marginBottom: "16px", display: "block", textAlign: "center" }}>
              Servicios seleccionados
            </label>
            <div className="selected-services-list">
              {serviciosSeleccionados.map((s) => {
                const parsed = parseServiceName(s.nombre);
                return (
                  <div key={s.id} style={{ position: "relative" }}>
                    <ServiceBackgroundCard 
                      nombre={parsed.subtitle || parsed.category}
                      tiempo={s.duracion || (s.bloques ? s.bloques * 30 : 30)}
                      background_id={parsed.fondo}
                      isSelected={true}
                      onClick={() => {}}
                    />
                    <button 
                      className="remove-service-btn" 
                      onClick={() => handleRemoveService(s.id)}
                      style={{ position: "absolute", top: "-8px", right: "-8px", zIndex: 10, background: "rgba(239, 68, 68, 0.9)", border: "none", borderRadius: "50%", width: "22px", height: "22px", color: "white", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
            
            <div className="service-action-buttons" style={{ marginTop: '20px' }}>
               <button className="btn-add-another" onClick={handleAddAnotherService}>
                 + Añadir otro servicio
               </button>
               <button className="btn-continue" onClick={handleContinuarServicios}>
                 ✓ Continuar
               </button>
            </div>
          </div>
        )}

        {/* El Modo Resumen Intermedio ha sido eliminado */}

        {/* PASO 5: Trabajadores Disponibles */}
        {stepServiciosCompleted && (
          <div ref={trabajadorRef} className="form-section active fade-in-section" style={{ marginTop: '30px' }}>
            <label style={{ fontSize: "18px", color: "white", marginBottom: "8px", display: "block", textAlign: "center" }}>
              👤 Elige quién realizará el servicio
            </label>
            <p style={{ color: "var(--text-secondary)", textAlign: "center", marginBottom: "20px", fontSize: "14px" }}>
              Selecciona uno de los trabajadores disponibles para este servicio.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {trabajadoresFiltrados.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTrabajadorSelect(t.id)}
                  style={{
                    padding: '15px 20px',
                    borderRadius: '12px',
                    background: trabajadorId === t.id ? 'rgba(255, 107, 26, 0.16)' : 'rgba(16, 31, 56, 0.6)',
                    border: trabajadorId === t.id ? '1px solid #FF6B1A' : '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <span style={{ color: trabajadorId === t.id ? '#FF6B1A' : '#888' }}>
                    {trabajadorId === t.id ? "●" : "○"}
                  </span>
                  {t.nombre}
                </button>
              ))}
            </div>
            {trabajadoresFiltrados.length === 0 && (
               <div style={{ color: "var(--error)", marginTop: "15px", textAlign: "center" }}>
                 ❌ Ningún trabajador ofrece todos los servicios seleccionados.
               </div>
            )}
            {msgTempTrabajador && <div className="success-message-temp">✓ Trabajador seleccionado</div>}
          </div>
        )}

        {/* PASO 6: Disponibilidad Semana */}
        {stepTrabajadorCompleted && (
          <div ref={disponibilidadRef} className="form-section active fade-in-section" style={{ marginTop: '30px' }}>
            <label style={{ fontSize: "18px", color: "white", marginBottom: "16px", display: "block", textAlign: "center" }}>
              📅 Disponibilidad de la semana
            </label>
            <div className="weekdays-grid">
              {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((d) => {
                const disponible = disponibilidadTrabajador?.dias_disponibles?.includes(d);
                
                const upcomingDate = getUpcomingDateForWeekday(d);
                const isSelected = fecha === upcomingDate;

                let btnClass = "chip-dia-btn no-disponible";
                if (disponible) {
                  btnClass = isSelected ? "chip-dia-btn seleccionado" : "chip-dia-btn disponible";
                }

                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                        if (disponible) handleFechaSelect(upcomingDate);
                    }}
                    className={btnClass}
                    disabled={loading || !disponible}
                    style={{ width: '100%', justifyContent: 'center', margin: '0' }}
                  >
                    {d} {!disponible && " 🔒"}
                  </button>
                );
              })}
            </div>
            {msgTempDia && <div className="success-message-temp">✓ Día seleccionado</div>}
          </div>
        )}

        {/* PASO 7: Horarios Disponibles */}
        {stepFechaCompleted && (
          <div ref={horasRef} className="form-section active fade-in-section" style={{ marginTop: '30px' }}>
            <label style={{ fontSize: "18px", color: "white", marginBottom: "16px", display: "block", textAlign: "center" }}>
              🕒 Horarios disponibles
            </label>
            {allGeneratedHours.length > 0 ? (
              <div className="hours-grid">
                {allGeneratedHours.map((h) => {
                  const libre = horas.includes(h);
                  
                  const isSelected = hora === h;
                  
                  let btnClass = "chip-hora-btn no-disponible";
                  if (libre) {
                    btnClass = isSelected ? "chip-hora-btn seleccionado" : "chip-hora-btn libre";
                  }

                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                          if (libre) handleHoraSelect(h);
                      }}
                      className={btnClass}
                      disabled={loading || !libre}
                      style={{ justifyContent: 'center' }}
                    >
                      {formatTime12h(h)} {!libre && " 🔒"}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
                No hay horarios disponibles para este trabajador.
              </p>
            )}
            {msgTempHora && <div className="success-message-temp">✓ Hora seleccionada</div>}
            
            {/* LEYENDA VISUAL */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '25px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                Disponible
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8B5CF6' }}></span>
                Seleccionado
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#7F1D1D' }}></span>
                No disponible
              </div>
            </div>
            
          </div>
        )}

        {/* PASO 8: Agendar Cita */}
        {stepHoraCompleted && (
          <div ref={agendarRef} className="form-section active fade-in-section" style={{ marginTop: '40px' }}>
            <button
              onClick={crearCita}
              className="btn-agendar"
              style={{ padding: '18px', fontSize: '18px', boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4)' }}
              disabled={loading || !hora || !isWorkingDay}
            >
              {loading ? "Agendando..." : "✓ Agendar cita"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
