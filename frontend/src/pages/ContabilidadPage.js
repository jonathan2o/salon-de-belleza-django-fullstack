import React, { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import VolverGestionButton from "../components/VolverGestionButton";
import "./ContabilidadPage.css";

const API_BASE = "/api";

/* ─── helpers ─── */
const fmt = (val) =>
  Number(val || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

// Nombre corto: primer nombre + inicial del apellido ("FLOR VELANDIA" → "FLOR V.")
const nombreCorto = (n) => {
  const partes = String(n || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`;
};

// Fecha de HOY en formato local (YYYY-MM-DD), independiente de la zona UTC
const fechaLocalHoy = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Hora local actual en formato HH:MM
const horaLocalAhora = () => {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, "0")}:${String(
    t.getMinutes()
  ).padStart(2, "0")}`;
};

// YYYY-MM-DD → "14 oct 2026"
const MESES_MIN = [
  "", "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const fechaCorta = (f) => {
  const partes = String(f || "").split("-");
  if (partes.length !== 3) return String(f || "—");
  return `${partes[2]} ${MESES_MIN[Number(partes[1])]} ${partes[0]}`;
};

export default function ContabilidadPage() {
  const { user, tokens } = useContext(AuthContext);
  const isAdmin = user?.is_staff;

  // ── estado formulario ──
  const [trabajadores, setTrabajadores] = useState([]);
  const [trabajadorId, setTrabajadorId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cliente, setCliente] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [hora, setHora] = useState(horaLocalAhora());
  const [precio, setPrecio] = useState("");
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [formMsg, setFormMsg] = useState({ text: "", ok: true });
  const [saving, setSaving] = useState(false);

  // ── secciones desplegables (ambas abiertas por defecto) ──
  const [seccionRegistroAbierta, setSeccionRegistroAbierta] = useState(false);
  const [seccionAdminAbierta, setSeccionAdminAbierta] = useState(false);

  // ── admin: resumen general (sin filtros) ──
  const [resumen, setResumen] = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);

  const authHeader = useCallback(() => {
    if (tokens?.access) return { Authorization: `Bearer ${tokens.access}` };
    return {};
  }, [tokens]);

  /* ── Carga trabajadores (con token) ── */
  useEffect(() => {
    fetch(`${API_BASE}/trabajadores/`, { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTrabajadores(Array.isArray(data) ? data : []);
        if (!isAdmin && user?.trabajador_id) {
          setTrabajadorId(String(user.trabajador_id));
        }
      })
      .catch(() => {});
  }, [authHeader, isAdmin, user]);

  /* ── Permiso vigente revalidado contra el servidor ──
     (si el admin retira el permiso con la sesión abierta, se refleja aquí) */
  const miTrabajador =
    !isAdmin && user?.trabajador_id
      ? trabajadores.find((t) => String(t.id) === String(user.trabajador_id))
      : null;
  const tienePermisoContabilidad =
    isAdmin || miTrabajador?.permiso_contabilidad || user?.permiso_contabilidad;

  /* ── Período quincenal (Q1: días 1–15, Q2: días 16–fin de mes) ── */
  const NOMBRES_MES = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const periodoInfo = (year, month, quincena) => {
    const ultimoDia = new Date(year, month, 0).getDate();
    const rango =
      quincena === 0
        ? `días 1–${ultimoDia} (mes completo)`
        : quincena === 1
        ? "días 1–15"
        : `días 16–${ultimoDia}`;
    const etiqueta =
      quincena === 0
        ? `Mes completo de ${NOMBRES_MES[month]} ${year}`
        : `${quincena === 1 ? "1ra" : "2da"} quincena de ${NOMBRES_MES[month]} ${year}`;
    return { year, month, quincena, rango, etiqueta };
  };
  const quincenaVigente = (() => {
    const hoy = new Date();
    return periodoInfo(
      hoy.getFullYear(),
      hoy.getMonth() + 1,
      hoy.getDate() <= 15 ? 1 : 2
    );
  })();

  // ── período seleccionado en el filtro (inicia en la vigente) ──
  const [periodoSel, setPeriodoSel] = useState(null);
  const pActiva = periodoSel || quincenaVigente;

  /* ── Carga resumen admin (período seleccionado) ── */
  const cargarResumen = useCallback(async (p) => {
    const sel = p || quincenaVigente;
    setLoadingResumen(true);
    try {
      const params = new URLSearchParams({
        year: sel.year,
        month: sel.month,
        quincena: sel.quincena,
      });
      const res = await fetch(
        `${API_BASE}/contabilidad/resumen/?${params.toString()}`,
        { headers: authHeader() }
      );
      if (res.ok) setResumen(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResumen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader]);

  useEffect(() => {
    if (isAdmin) cargarResumen(pActiva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, cargarResumen]);

  /* ── Años con historial + actual para el filtro ── */
  const añosFiltro = (() => {
    const set = new Set([quincenaVigente.year]);
    (resumen?.quincenas_disponibles || []).forEach((q) => set.add(q.year));
    return [...set].sort((a, b) => b - a);
  })();

  const elegirPeriodo = (year, month, quincena) => {
    const sel = periodoInfo(year, month, quincena);
    setPeriodoSel(sel);
    setFilasHistorialAbiertas({});
    cargarResumen(sel);
  };

  const volverHoy = () => {
    setPeriodoSel(null);
    setFilasHistorialAbiertas({});
    cargarResumen(quincenaVigente);
  };

  /* ── Historial por trabajador en la tabla Pagos ──
     Se despliega al hacer clic en la fila del trabajador y respeta
     el filtro de período (quincena) activo. */
  const [filasHistorialAbiertas, setFilasHistorialAbiertas] = useState({});
  const [historialPagos, setHistorialPagos] = useState({});
  const [cargandoHistorialPagos, setCargandoHistorialPagos] = useState({});
  const [itemsPagosAbiertos, setItemsPagosAbiertos] = useState({});

  const cargarHistorialPagos = async (trabajadorId) => {
    const key = `${trabajadorId}-${pActiva.year}-${pActiva.month}-${pActiva.quincena}`;
    setCargandoHistorialPagos((prev) => ({ ...prev, [key]: true }));
    try {
      const params = new URLSearchParams({
        trabajador: trabajadorId,
        year: pActiva.year,
        month: pActiva.month,
        quincena: pActiva.quincena,
      });
      const res = await fetch(
        `${API_BASE}/contabilidad/historial/?${params.toString()}`,
        { headers: authHeader() }
      );
      if (res.ok) {
        const data = await res.json();
        setHistorialPagos((prev) => ({
          ...prev,
          [key]: Array.isArray(data) ? data : [],
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoHistorialPagos((prev) => ({ ...prev, [key]: false }));
    }
  };

  const toggleHistorialPagos = async (row) => {
    const id = row.trabajador_id;
    setFilasHistorialAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));

    const key = `${id}-${pActiva.year}-${pActiva.month}-${pActiva.quincena}`;
    if (!historialPagos[key] && !cargandoHistorialPagos[key]) {
      await cargarHistorialPagos(id);
    }
  };

  const toggleItemPagos = (id) =>
    setItemsPagosAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));

  /* ── Editar / eliminar registro (admin) ── */
  const [pagosEditId, setPagosEditId] = useState(null);
  const [pagosEdit, setPagosEdit] = useState(null);
  const [pagosSaving, setPagosSaving] = useState(false);

  const abrirEdicionPagos = (r, trabajadorId) => {
    setPagosEditId(r.id);
    setPagosEdit({
      trabajadorId,
      descripcion: r.descripcion,
      cliente: r.cliente || "",
      cliente_telefono: r.cliente_telefono || "",
      fecha: r.fecha,
      hora: r.hora || "",
      precio: String(r.precio),
      porcentaje_comision: String(r.porcentaje_comision),
    });
  };

  const cancelarEdicionPagos = () => {
    setPagosEditId(null);
    setPagosEdit(null);
  };

  const guardarEdicionPagos = async () => {
    if (!pagosEditId || !pagosEdit) return;
    const campos = pagosEdit;
    if (!campos.descripcion.trim()) {
      window.alert("La descripción no puede quedar vacía.");
      return;
    }
    const numPrecio = Number(campos.precio);
    if (!campos.precio || isNaN(numPrecio) || numPrecio <= 0) {
      window.alert("El precio debe ser un número mayor a 0.");
      return;
    }
    const numPct = Number(campos.porcentaje_comision);
    if (isNaN(numPct) || numPct < 0 || numPct > 100) {
      window.alert("El porcentaje de comisión debe estar entre 0 y 100.");
      return;
    }
    setPagosSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/contabilidad/registros/${pagosEditId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({
            descripcion: campos.descripcion.trim(),
            cliente: campos.cliente.trim() || null,
            cliente_telefono: campos.cliente_telefono.trim() || null,
            hora: campos.hora || null,
            precio: numPrecio,
            porcentaje_comision: numPct,
            fecha: campos.fecha,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        cancelarEdicionPagos();
        await cargarHistorialPagos(campos.trabajadorId);
        if (isAdmin) cargarResumen(pActiva);
      } else {
        window.alert(data.error || "No se pudo guardar el cambio.");
      }
    } catch (err) {
      console.error(err);
      window.alert("❌ Error al conectar con el servidor.");
    } finally {
      setPagosSaving(false);
    }
  };

  const eliminarRegistroPagos = async (r, trabajadorId) => {
    if (
      !window.confirm(
        `🗑️ ¿Eliminar el servicio "${r.descripcion}" del ${fechaCorta(r.fecha)}?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/contabilidad/registros/${r.id}/`,
        { method: "DELETE", headers: authHeader() }
      );
      if (res.ok) {
        await cargarHistorialPagos(trabajadorId);
        if (isAdmin) cargarResumen(pActiva);
      } else {
        window.alert("No se pudo eliminar el registro.");
      }
    } catch (err) {
      console.error(err);
      window.alert("❌ Error al conectar con el servidor.");
    }
  };

  /* ── Crear registro ── */
  const crearRegistro = async (e) => {
    e.preventDefault();
    setFormMsg({ text: "", ok: true });
    if (!tienePermisoContabilidad) {
      setFormMsg({ text: "⛔ No tienes permiso de contabilidad.", ok: false });
      return;
    }
    if (!trabajadorId) {
      setFormMsg({ text: "Selecciona un trabajador.", ok: false });
      return;
    }
    if (!descripcion.trim()) {
      setFormMsg({ text: "Escribe una descripción.", ok: false });
      return;
    }
    if (!precio || isNaN(Number(precio)) || Number(precio) <= 0) {
      setFormMsg({ text: "El precio debe ser mayor a 0.", ok: false });
      return;
    }
    const pct = 50; // Comisión fija del 50 %
    setSaving(true);
    try {
      const body = {
        trabajador: Number(trabajadorId),
        descripcion: descripcion.trim(),
        cliente: cliente.trim() || null,
        cliente_telefono: clienteTelefono.trim() || null,
        hora: hora.trim() || null,
        precio: Number(precio),
        porcentaje_comision: pct,
        fecha,
      };
      const res = await fetch(`${API_BASE}/contabilidad/registros/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setFormMsg({ text: "✅ Servicio registrado correctamente.", ok: true });
        setDescripcion("");
        setCliente("");
        setClienteTelefono("");
        setPrecio("");
        setFecha(fechaLocalHoy());
        setHora(horaLocalAhora());
        if (isAdmin) {
          cargarResumen(pActiva);
        }
      } else {
        setFormMsg({
          text: data.error || JSON.stringify(data),
          ok: false,
        });
      }
    } catch (err) {
      setFormMsg({ text: "❌ Error al conectar con el servidor.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const comisionPreview =
    precio
      ? ((Number(precio) * 50) / 100).toLocaleString("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        })
      : null;

  const salonPreview =
    precio
      ? (Number(precio) - (Number(precio) * 50) / 100).toLocaleString("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        })
      : null;

  return (
    <div className="cb-page">
      <VolverGestionButton />
      {/* ════════════════════════════════════════
          CABECERA
      ════════════════════════════════════════ */}
      <div className="cb-hero">
        <div className="cb-hero-inner">
          <span className="cb-hero-icon">💰</span>
          <div>
              <h1 className="cb-hero-title">Contabilidad</h1>
            <p className="cb-hero-sub">
              {isAdmin
                ? "Panel administrativo de ingresos y comisiones"
                : "Registro de servicios realizados"}
            </p>
          </div>
        </div>
      </div>

      <div className="cb-body">
        {!tienePermisoContabilidad ? (
          <section className="cb-card">
            <h2 className="cb-section-title">
              <span className="cb-sec-icon">⛔</span> Sin acceso
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              No tienes permiso de contabilidad. Pídele al administrador que lo
              autorice e inicia sesión de nuevo.
            </p>
          </section>
        ) : (
          <>
        {/* ════════════════════════════════════════
            SECCIÓN 1: CONTABILIDAD ADMINISTRATIVA (desplegable)
        ════════════════════════════════════════ */}
        {isAdmin && (
        <div className="wizard-outer-container">
          <div
            className={`wizard-trigger-card ${seccionAdminAbierta ? "active" : ""}`}
            onClick={() => setSeccionAdminAbierta(!seccionAdminAbierta)}
            style={{ cursor: "pointer" }}
          >
            <div className="trigger-card-content" style={{ justifyContent: "flex-start", gap: "12px" }}>
              <span className="category-toggle-btn" style={{
                background: "transparent", border: "none", color: "var(--accent-orange)",
                fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {seccionAdminAbierta ? "▼" : "▶"}
              </span>
              <span className="trigger-title" style={{ fontSize: "18px", fontWeight: "600" }}>
                📊 Contabilidad Administrativa
              </span>
            </div>
          </div>

          <div className={`wizard-panel-collapsible ${seccionAdminAbierta ? "expanded" : "collapsed"}`}>
            {seccionAdminAbierta && (
          <section className="cb-card" style={{ marginTop: "16px" }}>

            {/* Filtro de período: Año / Mes / Quincena */}
            <div className="cb-periodo-bar">
              <div className="cb-periodo-actual">
                <span className="cb-periodo-icon">📅</span>
                <div>
                  <div className="cb-periodo-etiqueta">{pActiva.etiqueta}</div>
                  <div className="cb-periodo-rango">{pActiva.rango}</div>
                </div>
              </div>
              <div className="cb-periodo-controles">
                <select
                  className="cb-input cb-periodo-select"
                  aria-label="Año"
                  value={pActiva.year}
                  onChange={(e) =>
                    elegirPeriodo(Number(e.target.value), pActiva.month, pActiva.quincena)
                  }
                >
                  {añosFiltro.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  className="cb-input cb-periodo-select"
                  aria-label="Mes"
                  value={pActiva.month}
                  onChange={(e) =>
                    elegirPeriodo(pActiva.year, Number(e.target.value), pActiva.quincena)
                  }
                >
                  {NOMBRES_MES.slice(1).map((m, i) => (
                    <option key={i + 1} value={i + 1}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="cb-segmento" role="group" aria-label="Período">
                  {[1, 2].map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`cb-segmento-btn ${pActiva.quincena === q ? "active" : ""}`}
                      onClick={() => elegirPeriodo(pActiva.year, pActiva.month, q)}
                    >
                      Q{q}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`cb-segmento-btn cb-seg-mes ${pActiva.quincena === 0 ? "active" : ""}`}
                    onClick={() => elegirPeriodo(pActiva.year, pActiva.month, 0)}
                    title="Ver todo el mes completo"
                  >
                    📅 Mes
                  </button>
                </div>
                <button
                  type="button"
                  className="cb-btn-secondary cb-periodo-hoy"
                  onClick={volverHoy}
                >
                  Hoy
                </button>
              </div>
            </div>
            {loadingResumen ? (
              <div className="cb-loading">Cargando resumen...</div>
            ) : resumen && resumen.totales_globales.num_servicios === 0 ? (
              <div className="cb-empty">
                <span>📭</span>
                <p>No hay servicios registrados en este período.</p>
              </div>
            ) : resumen ? (
              <>
                <div className="cb-stats-grid">
                  <div className="cb-stat-card cb-stat-teal">
                    <span className="cb-stat-icon">🧾</span>
                    <div>
                      <div className="cb-stat-label">Cantidad de Servicios</div>
                      <div className="cb-stat-val">{resumen.totales_globales.num_servicios}</div>
                      <div className="cb-stat-count">en la quincena</div>
                    </div>
                  </div>
                  <div className="cb-stat-card cb-stat-green">
                    <span className="cb-stat-icon">💵</span>
                    <div>
                      <div className="cb-stat-label">Total Servicios</div>
                      <div className="cb-stat-val">{fmt(resumen.totales_globales.total_precio)}</div>
                      <div className="cb-stat-count">{resumen.totales_globales.num_servicios} servicios</div>
                    </div>
                  </div>
                  <div className="cb-stat-card cb-stat-blue">
                    <span className="cb-stat-icon">🏪</span>
                    <div>
                      <div className="cb-stat-label">Ingreso Salón</div>
                      <div className="cb-stat-val">{fmt(resumen.totales_globales.total_salon)}</div>
                    </div>
                  </div>
                </div>

                {/* Tabla de pagos por trabajador */}
                {resumen.por_trabajador.length > 0 && (
                  <div className="cb-table-wrapper">
                    <h3 className="cb-table-title">Pagos</h3>
                    <table className="cb-table cb-table-pagos">
                      <thead>
                        <tr>
                          <th>Trabajador</th>
                          <th>Servicios</th>
                          <th>Total Servicios</th>
                          <th className="cb-th-quincena">Quincena</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const montos = resumen.por_trabajador.map(
                            (r) => Number(r.total_precio) || 0
                          );
                          const maxTotal = Math.max(...montos);
                          const iniciales = (n) =>
                            String(n || "")
                              .trim()
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0].toUpperCase())
                              .join("");
                          return resumen.por_trabajador.map((row) => {
                            const esTop =
                              (Number(row.total_precio) || 0) === maxTotal;
                            const histAbierta = !!filasHistorialAbiertas[row.trabajador_id];
                            const keyHist = `${row.trabajador_id}-${pActiva.year}-${pActiva.month}-${pActiva.quincena}`;
                            const itemsHist = historialPagos[keyHist];
                            const cargaHist = !!cargandoHistorialPagos[keyHist];
                            return (
                              <React.Fragment key={row.trabajador_id}>
                                <tr
                                  className={`cb-fila-pagos ${histAbierta ? "abierta" : ""}`}
                                  onClick={() => toggleHistorialPagos(row)}
                                >
                                  <td className="cb-td-name" data-label="Trabajador">
                                    <span className="cb-worker">
                                      <span className="cb-avatar">
                                        {iniciales(row.trabajador_nombre)}
                                      </span>
                                      <span>
                                        {esTop ? "🥇 " : ""}
                                        {nombreCorto(row.trabajador_nombre)}
                                      </span>
                                      <span
                                        className={`ph-chev ${histAbierta ? "open" : ""}`}
                                      >
                                        ▼
                                      </span>
                                    </span>
                                  </td>
                                  <td className="cb-td-center" data-label="Servicios">
                                    {row.num_servicios}
                                  </td>
                                  <td className="cb-td-money cb-green" data-label="Total Servicios">
                                    {fmt(row.total_precio)}
                                  </td>
                                  <td className="cb-td-money cb-gold" data-label="Quincena">
                                    <span className="cb-quincena-total">
                                      {fmt(row.total_comisiones)}
                                    </span>
                                  </td>
                                </tr>

                                {histAbierta && (
                                  <tr className="ph-subfila">
                                    <td colSpan={4}>
                                      <div className="ph-panel">
                                        <div className="ph-panel-head">
                                          <span className="ph-panel-titulo">
                                            📜 Historial de servicios
                                          </span>
                                          <span className="ph-panel-rango">
                                            {pActiva.etiqueta}
                                          </span>
                                        </div>

                                        {cargaHist ? (
                                          <div className="ph-skeleton-box">
                                            <div className="ph-skeleton" />
                                            <div className="ph-skeleton" />
                                          </div>
                                        ) : !itemsHist ? (
                                          <div className="ph-vacio">
                                            No se pudo cargar el historial. Intenta de nuevo.
                                          </div>
                                        ) : itemsHist.length === 0 ? (
                                          <div className="ph-vacio">
                                            📭 Sin servicios de este trabajador en el período.
                                          </div>
                                        ) : (
                                          <>
                                            <div className="ph-timeline">
                                              {itemsHist.map((r) => {
                                                const itemAbierto =
                                                  !!itemsPagosAbiertos[r.id];
                                                return (
                                                  <div
                                                    key={r.id}
                                                    className={`ph-item ${itemAbierto ? "abierto" : ""}`}
                                                  >
                                                    <button
                                                      type="button"
                                                      className="ph-item-head"
                                                      onClick={() => toggleItemPagos(r.id)}
                                                      aria-expanded={itemAbierto}
                                                    >
                                                      <span className="ph-item-dot" />
                                                      <span className="ph-item-nombre">
                                                        {r.descripcion}
                                                      </span>
                                                      <span className="ph-item-fecha">
                                                        📅 {fechaCorta(r.fecha)}
                                                      </span>
                                                      {r.hora && (
                                                        <span className="ph-item-fecha ph-item-hora">
                                                          🕒 {r.hora.slice(0, 5)}
                                                        </span>
                                                      )}
                                                      {r.cliente && (
                                                        <span className="ph-item-cliente">
                                                          👤 {r.cliente}
                                                          {r.cliente_telefono
                                                            ? ` · ✆ ${r.cliente_telefono}`
                                                            : ""}
                                                        </span>
                                                      )}
                                                      <span
                                                        className={`ph-chev sm ${itemAbierto ? "open" : ""}`}
                                                      >
                                                        ▼
                                                      </span>
                                                    </button>

                                                    {itemAbierto && (
                                                      <div className="ph-item-detalles">
                                                        <span className="ph-detalle">
                                                          <span className="ph-detalle-label">👤 Cliente</span>
                                                          <span className="ph-detalle-val">
                                                            {r.cliente ? r.cliente : "—"}
                                                          </span>
                                                        </span>
                                                        <span className="ph-detalle">
                                                          <span className="ph-detalle-label">✆ Teléfono</span>
                                                          <span className="ph-detalle-val">
                                                            {r.cliente_telefono ? r.cliente_telefono : "—"}
                                                          </span>
                                                        </span>
                                                        <span className="ph-detalle">
                                                          <span className="ph-detalle-label">💵 Precio total</span>
                                                          <span className="ph-detalle-val">{fmt(r.precio)}</span>
                                                        </span>
                                                        <span className="ph-detalle">
                                                          <span className="ph-detalle-label">🧮 % Comisión</span>
                                                          <span className="ph-detalle-val">
                                                            {Number(r.porcentaje_comision)}%
                                                          </span>
                                                        </span>
                                                        <span className="ph-detalle ph-detalle-gold">
                                                          <span className="ph-detalle-label">💰 Ganancia</span>
                                                          <span className="ph-detalle-val">
                                                            {fmt(r.ganancia)}
                                                          </span>
                                                        </span>
                                                        <span className="ph-detalle">
                                                          <span className="ph-detalle-label">🕒 Fecha y hora</span>
                                                          <span className="ph-detalle-val">
                                                            {fechaCorta(r.fecha)}
                                                            {r.hora ? ` · ${r.hora.slice(0, 5)}` : ""}
                                                          </span>
                                                        </span>

                                                        {/* ── Acciones admin ── */}
                                                        {isAdmin && pagosEditId !== r.id && (
                                                          <div className="ph-item-acciones">
                                                            <button
                                                              type="button"
                                                              className="ph-btn ph-btn-edit"
                                                              onClick={() => abrirEdicionPagos(r, row.trabajador_id)}
                                                            >
                                                              ✏️ Editar
                                                            </button>
                                                            <button
                                                              type="button"
                                                              className="ph-btn ph-btn-del"
                                                              onClick={() => eliminarRegistroPagos(r, row.trabajador_id)}
                                                            >
                                                              🗑️ Eliminar
                                                            </button>
                                                          </div>
                                                        )}

                                                        {/* ── Edición inline ── */}
                                                        {pagosEditId === r.id && pagosEdit && (
                                                          <div className="ph-edit-form">
                                                            <div className="ph-edit-grid">
                                                              <label className="ph-edit-campo">
                                                                <span>Descripción</span>
                                                                <input
                                                                  className="ph-edit-input"
                                                                  type="text"
                                                                  value={pagosEdit.descripcion}
                                                                  maxLength={255}
                                                                  onChange={(e) =>
                                                                    setPagosEdit({ ...pagosEdit, descripcion: e.target.value })
                                                                  }
                                                                />
                                                              </label>
                                                              <label className="ph-edit-campo">
                                                                <span>Cliente</span>
                                                                <input
                                                                  className="ph-edit-input"
                                                                  type="text"
                                                                  value={pagosEdit.cliente}
                                                                  maxLength={100}
                                                                  onChange={(e) =>
                                                                    setPagosEdit({ ...pagosEdit, cliente: e.target.value })
                                                                  }
                                                                />
                                                              </label>
                                                              <label className="ph-edit-campo">
                                                                <span>Teléfono</span>
                                                                <input
                                                                  className="ph-edit-input"
                                                                  type="text"
                                                                  value={pagosEdit.cliente_telefono}
                                                                  maxLength={20}
                                                                  onChange={(e) =>
                                                                    setPagosEdit({
                                                                      ...pagosEdit,
                                                                      cliente_telefono: e.target.value,
                                                                    })
                                                                  }
                                                                />
                                                              </label>
                                                              <label className="ph-edit-campo">
                                                                <span>Fecha</span>
                                                                <input
                                                                  className="ph-edit-input"
                                                                  type="date"
                                                                  value={pagosEdit.fecha}
                                                                  onChange={(e) =>
                                                                    setPagosEdit({ ...pagosEdit, fecha: e.target.value })
                                                                  }
                                                                />
                                                              </label>
                                                              <label className="ph-edit-campo">
                                                                <span>Hora</span>
                                                                <input
                                                                  className="ph-edit-input"
                                                                  type="time"
                                                                  value={pagosEdit.hora}
                                                                  onChange={(e) =>
                                                                    setPagosEdit({ ...pagosEdit, hora: e.target.value })
                                                                  }
                                                                />
                                                              </label>
                                                              <label className="ph-edit-campo">
                                                                <span>Precio (COP)</span>
                                                                <input
                                                                  className="ph-edit-input"
                                                                  type="number"
                                                                  min="0.01"
                                                                  step="0.01"
                                                                  value={pagosEdit.precio}
                                                                  onChange={(e) =>
                                                                    setPagosEdit({ ...pagosEdit, precio: e.target.value })
                                                                  }
                                                                />
                                                              </label>
                                                              <label className="ph-edit-campo">
                                                                <span>% Comisión</span>
                                                                <input
                                                                  className="ph-edit-input"
                                                                  type="number"
                                                                  min="0"
                                                                  max="100"
                                                                  step="0.01"
                                                                  value={pagosEdit.porcentaje_comision}
                                                                  onChange={(e) =>
                                                                    setPagosEdit({
                                                                      ...pagosEdit,
                                                                      porcentaje_comision: e.target.value,
                                                                    })
                                                                  }
                                                                />
                                                              </label>
                                                            </div>
                                                            <div className="ph-item-acciones">
                                                              <button
                                                                type="button"
                                                                className="ph-btn ph-btn-save"
                                                                disabled={pagosSaving}
                                                                onClick={guardarEdicionPagos}
                                                              >
                                                                {pagosSaving ? "Guardando..." : "💾 Guardar"}
                                                              </button>
                                                              <button
                                                                type="button"
                                                                className="ph-btn ph-btn-cancel"
                                                                onClick={cancelarEdicionPagos}
                                                              >
                                                                ✖ Cancelar
                                                              </button>
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            <div className="ph-footer">
                                              Filtrado por: {pActiva.etiqueta} · {pActiva.rango}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </section>
            )}
          </div>
        </div>
        )}

        {/* ════════════════════════════════════════
            SECCIÓN 2: REGISTRAR SERVICIO (desplegable)
        ════════════════════════════════════════ */}
        <div className="wizard-outer-container" style={{ marginTop: 24 }}>
          <div
            className={`wizard-trigger-card ${seccionRegistroAbierta ? "active" : ""}`}
            onClick={() => setSeccionRegistroAbierta(!seccionRegistroAbierta)}
            style={{ cursor: "pointer" }}
          >
            <div className="trigger-card-content" style={{ justifyContent: "flex-start", gap: "12px" }}>
              <span className="category-toggle-btn" style={{
                background: "transparent", border: "none", color: "var(--accent-orange)",
                fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {seccionRegistroAbierta ? "▼" : "▶"}
              </span>
              <span className="trigger-title" style={{ fontSize: "18px", fontWeight: "600" }}>
                ✍️ Registrar Servicio
              </span>
            </div>
          </div>

          <div className={`wizard-panel-collapsible ${seccionRegistroAbierta ? "expanded" : "collapsed"}`}>
            {seccionRegistroAbierta && (
        <section className="cb-card cb-form-card" style={{ marginTop: "16px" }}>

          <form onSubmit={crearRegistro} className="cb-form">
            {/* Trabajador */}
            <div className="cb-field">
              <label className="cb-label">Trabajador que realizó el servicio</label>
              <select
                className="cb-input"
                value={trabajadorId}
                onChange={(e) => setTrabajadorId(e.target.value)}
                required
              >
                <option value="">— Seleccionar —</option>
                {trabajadores.map((t) => (
                  <option key={t.id} value={t.id}>
                    {nombreCorto(`${t.nombre} ${t.apellidos}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div className="cb-field">
              <label className="cb-label">Descripción del servicio</label>
              <input
                className="cb-input"
                type="text"
                placeholder="Ej. Corte de cabello, Tinte..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
              />
            </div>

            {/* Cliente (opcional) */}
            <div className="cb-field">
              <label className="cb-label">Cliente (opcional)</label>
              <input
                className="cb-input"
                type="text"
                placeholder="Ej. Laura Gómez"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Teléfono del cliente (opcional) */}
            <div className="cb-field">
              <label className="cb-label">Teléfono del cliente (opcional)</label>
              <input
                className="cb-input"
                type="text"
                placeholder="Ej. 313 434 6983"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                maxLength={20}
              />
            </div>

            {/* Precio */}
            <div className="cb-field">
              <label className="cb-label">Precio del servicio (COP)</label>
              <div className="cb-price-wrapper">
                <span className="cb-currency">$</span>
                <input
                  className="cb-input cb-input-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Preview comisión */}
            {comisionPreview && (
              <div className="cb-preview-bar">
                <div className="cb-preview-item">
                  <span className="cb-preview-label">Total servicio</span>
                  <span className="cb-preview-val cb-green">
                    {Number(precio).toLocaleString("es-CO", {
                      style: "currency",
                      currency: "COP",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="cb-preview-sep">→</div>
                <div className="cb-preview-item">
                  <span className="cb-preview-label">Comisión trabajador</span>
                  <span className="cb-preview-val cb-gold">{comisionPreview}</span>
                </div>
                <div className="cb-preview-sep">+</div>
                <div className="cb-preview-item">
                  <span className="cb-preview-label">Para el salón</span>
                  <span className="cb-preview-val cb-blue">{salonPreview}</span>
                </div>
              </div>
            )}

            {/* Fecha */}
            <div className="cb-field" style={{ maxWidth: 220 }}>
              <label className="cb-label">Fecha del servicio</label>
              <input
                className="cb-input"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>

            {/* Hora */}
            <div className="cb-field" style={{ maxWidth: 180 }}>
              <label className="cb-label">🕒 Hora del servicio</label>
              <input
                className="cb-input"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>

            {formMsg.text && (
              <div className={`cb-msg ${formMsg.ok ? "cb-msg-ok" : "cb-msg-err"}`}>
                {formMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="cb-btn-primary"
              disabled={saving}
            >
              {saving ? "Guardando..." : "💾 Guardar Servicio"}
            </button>
          </form>
        </section>
            )}
          </div>
        </div>


          </>
        )}
      </div>
    </div>
  );
}