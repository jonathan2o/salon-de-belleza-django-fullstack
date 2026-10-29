import React, { useState, useEffect, useRef } from 'react';
import HorarioBookingForm from '../components/HorarioBookingForm';
import './HorarioPage.css';

const API_BASE = "/api";

const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const parseTimeMinutes = (timeString) => {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatSlotTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
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

export default function HorarioPage() {
  const [trabajadores, setTrabajadores] = useState([]);
  const [citas, setCitas] = useState([]);
  const [servicios, setServicios] = useState([]);
  
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [currentWeekMonday, setCurrentWeekMonday] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedSlots, setExpandedSlots] = useState({});
  const daysContainerRef = useRef(null);
  const dayCardRefs = useRef([]);
  
  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);

    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(today);
    monday.setDate(diff);
    setCurrentWeekMonday(monday);
  };

  useEffect(() => {
    goToToday();
    fetchTrabajadores();
    fetchCitas();
    fetchServicios();
  }, []);

  // ── Tiempo real: refresco automático cada 30 s (trabajadores con estado + citas) ──
  useEffect(() => {
    const id = setInterval(() => {
      fetchTrabajadores();
      fetchCitas();
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedWorkerId) {
      goToToday();
    }
  }, [selectedWorkerId]);

  const fetchTrabajadores = async () => {
    try {
      const res = await fetch(`${API_BASE}/trabajadores/`);
      const data = await res.json();
      if (res.ok) {
        setTrabajadores(data);
        if (data.length > 0 && !selectedWorkerId) {
          setSelectedWorkerId(data[0].id.toString());
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchCitas = async () => {
    try {
      const res = await fetch(`${API_BASE}/citas/`);
      const data = await res.json();
      if (res.ok) {
        setCitas(data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchServicios = async () => {
    try {
      const res = await fetch(`${API_BASE}/servicios/`);
      const data = await res.json();
      if (res.ok) {
        setServicios(data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getMondayOfDate = (date) => {
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    return monday;
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    setCurrentWeekMonday(getMondayOfDate(prev));
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    setCurrentWeekMonday(getMondayOfDate(next));
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekMonday);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays();
  
  // Format month and year
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const formattedSelectedDate = `${selectedDate.getDate()} de ${monthNames[selectedDate.getMonth()]} de ${selectedDate.getFullYear()}`;

  useEffect(() => {
    const container = daysContainerRef.current;
    const index = weekDays.findIndex((d) => isSelected(d));
    const card = dayCardRefs.current[index];
    if (!container || !card) return;

    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const target = container.scrollLeft + (cardRect.left - containerRect.left) - (container.clientWidth - cardRect.width) / 2;

    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [selectedDate, currentWeekMonday]);

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date) => {
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const getDayName = (date) => {
    const names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return names[date.getDay()];
  };

  // Format YYYY-MM-DD for comparison with citas
  const formatDateString = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatHora = (horaString) => {
    if (!horaString) return "";
    const parts = horaString.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? String(parts[1]).padStart(2, "0") : "00";
    if (Number.isNaN(hours)) return horaString;

    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Check if a cita is in the past
  const isCitaPasada = (cita) => {
    const now = new Date();
    const citaDate = new Date(`${cita.fecha}T${cita.hora}`);
    return now > citaDate;
  };

  const selectedDateString = formatDateString(selectedDate);
  
  // Filter and sort citas (solo se agregan las citas confirmadas)
  const citasFiltradas = citas.filter(c => 
    c.trabajador.toString() === selectedWorkerId && 
    c.fecha === selectedDateString &&
    (c.estado === "confirmada" || !c.estado)
  ).sort((a, b) => {
    return a.hora.localeCompare(b.hora);
  });

  const selectedWorker = trabajadores.find((t) => t.id.toString() === selectedWorkerId);
  const dayName = DAY_NAMES_FULL[selectedDate.getDay()];

  const generateSlots = () => {
    if (!selectedWorker) return [];
    if (!selectedWorker.dias_disponibles?.includes(dayName)) return [];

    const start = parseTimeMinutes(selectedWorker.hora_inicio || "09:00") ?? 540;
    const end = parseTimeMinutes(selectedWorker.hora_fin || "18:00") ?? 1080;

    const slots = [];
    for (let minutes = start; minutes < end; minutes += 30) {
      slots.push(formatSlotTime(minutes));
    }
    return slots;
  };

  const slotCitaMap = {};
  citasFiltradas.forEach((cita) => {
    const servicio = servicios.find((s) => s.id === cita.servicio);
    const bloques = servicio?.bloques ? Number(servicio.bloques) : Math.ceil((servicio?.duracion || 30) / 30);
    const startMinutes = parseTimeMinutes(cita.hora) ?? 0;

    for (let i = 0; i < bloques; i++) {
      const slot = formatSlotTime(startMinutes + i * 30);
      slotCitaMap[slot] = { cita, servicio };
    }
  });

  const now = new Date();
  const todayString = formatDateString(now);
  const isPastDate = selectedDateString < todayString;

  const slots = generateSlots()
    .map((time) => ({
      time,
      booked: Boolean(slotCitaMap[time]),
      info: slotCitaMap[time] || null,
    }))
    .filter((slot) => {
      if (slot.booked) return true;
      if (isPastDate) return false;
      if (selectedDateString === todayString) {
        const slotDate = new Date(`${selectedDateString}T${slot.time}:00`);
        return slotDate.getTime() >= now.getTime();
      }
      return true;
    });

  const bookedCount = slots.filter((slot) => slot.booked).length;
  const availableCount = slots.length - bookedCount;

  return (
    <div className="horario-container">
      <h2 className="horario-title">HORARIO DE TRABAJADOR</h2>
      
      <div className="horario-selector-wrapper">
        <select 
          className="horario-selector" 
          value={selectedWorkerId}
          onChange={(e) => setSelectedWorkerId(e.target.value)}
        >
          {trabajadores.map(t => (
            <option key={t.id} value={t.id.toString()}>
              {t.estado === "ocupado" ? "🟠" : t.estado === "activo" ? "🟢" : t.estado === "descanso" ? "☕" : t.estado === "apagado" ? "⚫" : "⚪"} {t.nombre} {t.apellidos}
            </option>
          ))}
        </select>
        <span className="horario-selector-icon">▼</span>
      </div>

      <div className="horario-calendar-section">
        <div className="horario-month-year">
          Horario: {formattedSelectedDate}
        </div>
        <div className="horario-week-row">
          <button className="horario-nav-btn" onClick={handlePrevDay} title="Día anterior">◀</button>
          <div className="horario-days-container" ref={daysContainerRef}>
            {weekDays.map((d, index) => (
              <div 
                key={index}
                ref={(el) => (dayCardRefs.current[index] = el)}
                className={`horario-day-card ${isSelected(d) ? 'selected' : ''}`}
                onClick={() => setSelectedDate(d)}
              >
                {isToday(d) && <span className="horario-hoy-badge">HOY</span>}
                <span className="horario-day-name">{getDayName(d)}</span>
                <span className="horario-day-number">{d.getDate()}</span>
              </div>
            ))}
          </div>
          <button className="horario-nav-btn" onClick={handleNextDay} title="Día siguiente">▶</button>
        </div>
      </div>

      <div className="horario-counter">
        {bookedCount} cita{bookedCount !== 1 ? 's' : ''} agendada{bookedCount !== 1 ? 's' : ''} · {availableCount} hora{availableCount !== 1 ? 's' : ''} disponible{availableCount !== 1 ? 's' : ''}
      </div>

      {/* ── Estado de disponibilidad en tiempo real (refresco 30 s) ── */}
      <div className="st-worker-cards">
        {trabajadores.map((t) => {
          const estado = t.estado || "sin servicio";
          return (
            <div
              key={t.id}
              className={`st-worker-card st-worker-${estado.replace(" ", "-")}${selectedWorkerId === t.id.toString() ? " st-worker-selected" : ""}`}
              onClick={() => setSelectedWorkerId(t.id.toString())}
            >
              <span className="st-worker-dot"></span>
              <span className="st-worker-name">{t.nombre} {t.apellidos}</span>
              <span className="st-worker-label">
                {estado === "ocupado"
                  ? "Ocupado"
                  : estado === "activo"
                  ? "Activo"
                  : estado === "descanso"
                  ? "Descanso"
                  : estado === "apagado"
                  ? "Apagado"
                  : "Sin servicio"}
              </span>
              <span className="st-worker-ingreso">
                {t.hora_ingreso ? `🕒 ${t.hora_ingreso.slice(0, 5)}` : "⚪ Sin ingreso hoy"}
              </span>
            </div>
          );
        })}
      </div>

      {slots.length > 0 ? (
        <div className="horario-slots">
          {slots.map((slot) => {
            const isOpen = Boolean(expandedSlots[slot.time]);
            const info = slot.info;
            const parsedService = info ? parseServiceName(info.servicio?.nombre || "") : null;
            const past = info ? isCitaPasada(info.cita) : false;

            return (
              <div
                key={slot.time}
                className={`horario-slot ${slot.booked ? "booked" : "available"} ${past ? "past" : ""}`}
              >
                <button
                  type="button"
                  className="horario-slot-trigger"
                  onClick={() => setExpandedSlots((prev) => ({ ...prev, [slot.time]: !prev[slot.time] }))}
                  aria-expanded={isOpen}
                >
                  <span className={`horario-slot-hour ${slot.booked ? "booked" : "available"}`}>
                    {formatHora(slot.time)}
                  </span>
                  <span className={`horario-slot-state ${slot.booked ? "booked" : "available"}`}>
                    {slot.booked ? "Agendada" : "Disponible"}
                  </span>
                  <span className="horario-slot-icon" aria-hidden="true">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div className="horario-slot-body">
                    {slot.booked && info ? (
                      <>
                        <p className="horario-slot-title">Resumen del servicio</p>
                        <p className="horario-slot-line">
                          <strong>Servicio:</strong> {parsedService.subtitle || parsedService.category || info.servicio?.nombre}
                        </p>
                        <p className="horario-slot-line">
                          <strong>Cliente:</strong> {info.cita.nombre}
                        </p>
                        <p className="horario-slot-line">
                          <strong>Duración:</strong> {info.servicio?.duracion || 0} min
                        </p>
                        <p className="horario-slot-line">
                          <strong>Estado:</strong> {past ? "Pasada" : "Programada"}
                        </p>
                      </>
                    ) : (
                      <HorarioBookingForm
                        trabajadorId={selectedWorkerId}
                        fecha={selectedDateString}
                        hora={slot.time}
                        servicios={servicios}
                        onBooked={() => fetchCitas()}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="horario-empty">
          <span className="horario-empty-icon">📅</span>
          <span className="horario-empty-text">No hay horarios para este día.</span>
        </div>
      )}
    </div>
  );
}
