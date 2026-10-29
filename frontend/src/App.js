import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import React, { useContext, useState, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import RegistrarTrabajadorPage from "./pages/RegistrarTrabajadorPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import CitasPage from "./pages/CitasPage";
import ProfilePage from "./pages/ProfilePage";
import HorarioPage from "./pages/HorarioPage";
import QRPage from "./pages/QRPage";
import GestionPage from "./pages/GestionPage";
import ContabilidadPage from "./pages/ContabilidadPage";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import AddServiceWizard from "./components/AddServiceWizard";
import "./styles/AdminPanelModern.css";
import ServiceBackgroundCard from "./components/ServiceBackgroundCard";
import DrawerMenu from "./components/DrawerMenu";
import VolverGestionButton from "./components/VolverGestionButton";
import PermisoContabilidadPanel from "./components/PermisoContabilidadPanel";
import "./App.css";

const API_BASE = "/api";

function HomePage() {
  const [loginCorreo, setLoginCorreo] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMensaje, setLoginMensaje] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useContext(AuthContext);

  // Si ya está autenticado, redirigir al perfil
  if (isAuthenticated) {
    navigate("/perfil", { replace: true });
  }

  const iniciarSesion = async () => {
    setLoginMensaje("");
    setLoginError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          correo: loginCorreo,
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Guardar usuario y tokens en el contexto
        const userData = {
          id: data.user_id,
          trabajador_id: data.trabajador_id,
          correo: data.correo,
          nombre: data.nombre || data.correo.split("@")[0],
          apellidos: data.apellidos || "",
          telefono: data.telefono || "",
          is_staff: data.is_staff || false,
          permiso_contabilidad: data.permiso_contabilidad || false,
        };

        const tokenData = {
          access: data.tokens.access,
          refresh: data.tokens.refresh,
        };

        login(userData, tokenData);
        setLoginMensaje("✅ Iniciando sesión...");
        setLoginCorreo("");
        setLoginPassword("");

        // Redirigir al perfil después de 1 segundo
        setTimeout(() => {
          navigate("/perfil", { replace: true });
        }, 1000);
      } else {
        setLoginError(data.error || "❌ Datos incorrectos");
      }
    } catch (error) {
      setLoginError("❌ No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <VolverGestionButton />
      <h2 className="page-title">Inicio de Sesión</h2>
      {loginMensaje && <div className="success-message">{loginMensaje}</div>}
      {loginError && <div className="error-mensaje">{loginError}</div>}

      <label>Correo:</label>
      <input
        type="email"
        value={loginCorreo}
        onChange={(e) => setLoginCorreo(e.target.value)}
        placeholder="Correo"
        className="login-input"
        disabled={loading}
      />

      <label>Contraseña:</label>
      <input
        type="password"
        value={loginPassword}
        onChange={(e) => setLoginPassword(e.target.value)}
        placeholder="Contraseña"
        className="login-input"
        disabled={loading}
      />

      <button
        onClick={iniciarSesion}
        className="btn-agendar"
        disabled={loading}
      >
        {loading ? "Iniciando sesión..." : "Iniciar sesión"}
      </button>


    </div>
  );
}

const GEMSTONES = [
  { id: "dorado", label: "Dorado", emoji: "💎", className: "gem-dorado" },
  { id: "plateado", label: "Plateado", emoji: "💎", className: "gem-plateado" },
  { id: "zafiro", label: "Zafiro", emoji: "💎", className: "gem-zafiro" },
  { id: "brown", label: "Brown", emoji: "💎", className: "gem-brown" },
  { id: "green", label: "Green", emoji: "💎", className: "gem-green" },
  { id: "esmeralda", label: "Esmeralda", emoji: "💎", className: "gem-esmeralda" },
];

function AdminWelcomePage() {
  const { tokens } = useContext(AuthContext);
  const [mensajeServicio, setMensajeServicio] = useState("");
  const [loadingServicio, setLoadingServicio] = useState(false);
  const [servicios, setServicios] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);

  const fetchServicios = async () => {
    try {
      const res = await fetch(`${API_BASE}/servicios/`);
      const data = await res.json();
      if (res.ok) setServicios(data);
    } catch (e) {
      // ignore fetch errors for list
    }
  };
  const fetchTrabajadores = async () => {
    try {
      const res = await fetch(`${API_BASE}/trabajadores/`);
      const data = await res.json();
      if (res.ok) {
        setTrabajadores(data);
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    fetchServicios();
    fetchTrabajadores();
  }, []);

  const eliminarTrabajador = async (id) => {
    const confirmar = window.confirm(
      "¿Seguro que deseas eliminar este trabajador?",
    );

    if (!confirmar) return;

    try {
      const res = await fetch(`${API_BASE}/trabajadores/${id}/eliminar/`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setMensajeServicio("✅ Trabajador eliminado.");

        fetchTrabajadores();
      } else {
        setMensajeServicio(`❌ ${data.error || "No se pudo eliminar"}`);
      }
    } catch (error) {
      setMensajeServicio("❌ Error al conectar con el servidor");
    }
  };



  const [selectedItem, setSelectedItem] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState(15);
  const [editPrice, setEditPrice] = useState(0);
  const [errorModal, setErrorModal] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});

  // States for changing background (fondo/gema visual del servicio)
  const [fondoModalOpen, setFondoModalOpen] = useState(false);
  const [fondoSeleccionado, setFondoSeleccionado] = useState("zafiro");
  const [fondoError, setFondoError] = useState("");

  // States for adding subtitle
  const [addSubtitleModalOpen, setAddSubtitleModalOpen] = useState(false);
  const [newSubNombre, setNewSubNombre] = useState("");
  const [newSubBloques, setNewSubBloques] = useState(2);
  const [newSubPrecio, setNewSubPrecio] = useState("");
  const [newSubColor, setNewSubColor] = useState("zafiro");
  const [loadingNewSub, setLoadingNewSub] = useState(false);
  const [newSubError, setNewSubError] = useState("");

  const [expandedWorkers, setExpandedWorkers] = useState({});
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [serviciosGlobalDesplegado, setServiciosGlobalDesplegado] = useState(false);
  const [trabajadoresGlobalDesplegado, setTrabajadoresGlobalDesplegado] = useState(false);

  const toggleCategoryExpand = (categoryName, e) => {
    e.stopPropagation();
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  const parseServiceName = (nombre) => {
    const parts = nombre.split(" - ");
    if (parts.length > 1) {
      const category = parts[0].trim();
      const rest = parts.slice(1).join(" - ").trim();
      
      const fondoMatch = rest.match(/\|fondo:([^|]+)\|/);
      let fondo = fondoMatch ? fondoMatch[1] : "";
      let subtitle = fondoMatch ? rest.replace(/\|fondo:[^|]+\|/, "").trim() : rest;
      
      // Fallback for old gem format
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

  const abrirModalFondo = () => {
    if (!selectedItem || selectedItem.type !== "service") return;
    const parsed = parseServiceName(selectedItem.rawName);
    const actual = (parsed.fondo || "zafiro").toLowerCase();
    setFondoSeleccionado(
      GEMSTONES.some((g) => g.id === actual) ? actual : "zafiro"
    );
    setFondoError("");
    setFondoModalOpen(true);
  };

  const guardarFondo = async () => {
    if (!selectedItem || selectedItem.type !== "service") return;
    const gemaObj = GEMSTONES.find((g) => g.id === fondoSeleccionado);
    const gemaLabel = gemaObj ? gemaObj.label : "Zafiro";
    const parsed = parseServiceName(selectedItem.rawName);
    // Conservar categoría/subtítulo y cambiar solo el marcador de fondo
    const base = parsed.subtitle
      ? `${parsed.category} - ${parsed.subtitle}`
      : selectedItem.name.replace(/\s*\([^)]+\)$/, "").trim();
    const newNombre = `${base} (${gemaLabel})`;

    setMensajeServicio("");
    setLoadingServicio(true);
    try {
      const res = await fetch(`${API_BASE}/servicios/${selectedItem.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newNombre,
          duracion: Number(selectedItem.duration),
          precio: Number(selectedItem.price),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Guardar color de gema localmente
        const localColors = JSON.parse(localStorage.getItem("servicio_colors") || "{}");
        localColors[newNombre] = fondoSeleccionado;
        localStorage.setItem("servicio_colors", JSON.stringify(localColors));

        setMensajeServicio("✅ Fondo cambiado correctamente.");
        setSelectedItem(null);
        setFondoModalOpen(false);
        fetchServicios();
      } else {
        setFondoError(data.error || "Error al cambiar el fondo");
      }
    } catch (e) {
      setFondoError("Error al conectar con el servidor.");
    } finally {
      setLoadingServicio(false);
    }
  };

  const abrirModalModificar = () => {    if (!selectedItem) return;
    setErrorModal("");
    if (selectedItem.type === "category") {
      setEditName(selectedItem.name);
    } else {
      const parsed = parseServiceName(selectedItem.rawName);
      setEditName(parsed.subtitle || selectedItem.name);
      setEditDuration(selectedItem.duration);
      setEditPrice(selectedItem.price);
    }
    setEditModalOpen(true);
  };

  const guardarModificacion = async () => {
    if (!editName.trim()) {
      setErrorModal("El nombre no puede estar vacío");
      return;
    }
    setMensajeServicio("");
    setLoadingServicio(true);
    try {
      if (selectedItem.type === "category") {
        const res = await fetch(`${API_BASE}/categorias/modificar/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            old_name: selectedItem.name,
            new_name: editName.trim(),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setMensajeServicio("✅ Categoría modificada correctamente.");
          setSelectedItem(null);
          setEditModalOpen(false);
          fetchServicios();
        } else {
          setErrorModal(data.error || "Error al modificar la categoría");
        }
      } else {
        const parsed = parseServiceName(selectedItem.rawName);
        const newNombre = parsed.subtitle 
          ? `${parsed.category} - ${editName.trim()}${parsed.gem ? ` (${parsed.gem})` : ""}` 
          : editName.trim();

        const res = await fetch(`${API_BASE}/servicios/${selectedItem.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: newNombre,
            duracion: Number(editDuration),
            precio: Number(editPrice),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setMensajeServicio("✅ Servicio modificado correctamente.");
          setSelectedItem(null);
          setEditModalOpen(false);
          fetchServicios();
        } else {
          setErrorModal(data.error || "Error al modificar el servicio");
        }
      }
    } catch (e) {
      setErrorModal("Error al conectar con el servidor.");
    } finally {
      setLoadingServicio(false);
    }
  };

  const guardarNuevoSubtitulo = async () => {
    setNewSubError("");
    if (!newSubNombre.trim()) {
      setNewSubError("❌ Por favor escribe el nombre del subtítulo.");
      return;
    }
    if (newSubPrecio === "" || isNaN(newSubPrecio) || Number(newSubPrecio) < 0) {
      setNewSubError("❌ Por favor escribe un precio válido.");
      return;
    }

    setLoadingNewSub(true);
    try {
      const gemaObj = GEMSTONES.find((g) => g.id === newSubColor);
      const gemaLabel = gemaObj ? gemaObj.label : "Zafiro";
      const nombreCompleto = `${selectedItem.name.trim()} - ${newSubNombre.trim()} (${gemaLabel})`;

      const res = await fetch(`${API_BASE}/servicios/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreCompleto,
          bloques: Number(newSubBloques),
          precio: Number(newSubPrecio),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Guardar color de gema localmente
        const localColors = JSON.parse(localStorage.getItem("servicio_colors") || "{}");
        localColors[nombreCompleto] = newSubColor;
        localStorage.setItem("servicio_colors", JSON.stringify(localColors));

        setMensajeServicio("✅ Subtítulo añadido correctamente.");
        setAddSubtitleModalOpen(false);
        setNewSubNombre("");
        setNewSubBloques(2);
        setNewSubPrecio("");
        setNewSubColor("zafiro");

        // Mantener la categoría expandida
        setExpandedCategories((prev) => ({
          ...prev,
          [selectedItem.name]: true,
        }));

        fetchServicios();
      } else {
        setNewSubError(data.error || "Error al guardar el subtítulo");
      }
    } catch (error) {
      console.error(error);
      setNewSubError("Error al conectar con el servidor.");
    } finally {
      setLoadingNewSub(false);
    }
  };

  const eliminarTrabajadoresSeleccionados = async () => {
    const confirmar = window.confirm(
      selectedWorkers.length === 1
        ? "¿Deseas eliminar el trabajador seleccionado?"
        : "¿Deseas eliminar los trabajadores seleccionados?"
    );

    if (!confirmar) return;

    setMensajeServicio("");
    setLoadingServicio(true);
    try {
      const res = await fetch(`${API_BASE}/trabajadores/eliminar-masivo/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedWorkers }),
      });

      const data = await res.json();
      if (res.ok) {
        setMensajeServicio(`✅ ${data.message || "Trabajadores eliminados correctamente."}`);
        setSelectedWorkers([]); // Limpiar selección
        fetchTrabajadores();
      } else {
        setMensajeServicio(`❌ ${data.error || "No se pudieron eliminar los trabajadores."}`);
      }
    } catch (error) {
      console.error(error);
      setMensajeServicio("❌ Error al conectar con el servidor.");
    } finally {
      setLoadingServicio(false);
    }
  };

  const toggleSelectWorker = (id) => {
    setSelectedWorkers((prev) =>
      prev.includes(id) ? prev.filter((wid) => wid !== id) : [...prev, id]
    );
  };

  const toggleWorkerExpand = (id) => {
    setExpandedWorkers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const eliminarSeleccionado = async () => {
    if (!selectedItem) return;
    setMensajeServicio("");
    
    if (selectedItem.type === "category") {
      const confirmar = window.confirm(
        `¿Seguro que deseas eliminar la categoría "${selectedItem.name}" y todos sus servicios relacionados?`
      );
      if (!confirmar) return;
      
      setLoadingServicio(true);
      try {
        const res = await fetch(`${API_BASE}/categorias/eliminar/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: selectedItem.name }),
        });
        const data = await res.json();
        if (res.ok) {
          setMensajeServicio("✅ Categoría y servicios eliminados correctamente.");
          setSelectedItem(null);
          fetchServicios();
        } else {
          setMensajeServicio(`❌ ${data.error || "No se pudo eliminar"}`);
        }
      } catch (e) {
        setMensajeServicio("❌ Error al conectar con el servidor.");
      } finally {
        setLoadingServicio(false);
      }
    } else {
      const confirmar = window.confirm(
        `¿Seguro que deseas eliminar el servicio "${selectedItem.name}"?`
      );
      if (!confirmar) return;

      setLoadingServicio(true);
      try {
        const res = await fetch(`${API_BASE}/servicios/${selectedItem.id}/`, {
          method: "DELETE",
        });
        if (res.ok) {
          setMensajeServicio("✅ Servicio eliminado correctamente.");
          setSelectedItem(null);
          fetchServicios();
        } else {
          const data = await res.json();
          setMensajeServicio(`❌ ${data.error || "No se pudo eliminar el servicio"}`);
        }
      } catch (e) {
        setMensajeServicio("❌ Error al conectar con el servidor.");
      } finally {
        setLoadingServicio(false);
      }
    }
  };

  const navigate = useNavigate();

  return (
    <div className="page-container">
      <VolverGestionButton />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
        <h2 className="page-title" style={{ margin: 0 }}>Panel de Administrador</h2>
      </div>
      <div className="profile-card">
        <div className="profile-info">
          <h3>Panel Administrativo</h3>
          <p className="profile-text">
            Gestiona servicios, trabajadores y contabilidad del salón.
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate("/contabilidad")}
        className="btn-contabilidad-admin"
        style={{ width: "100%", justifyContent: "center", marginTop: "16px", marginBottom: "4px" }}
      >
        💰 Contabilidad Admin
      </button>

      <div style={{ marginTop: 20 }}>
        {mensajeServicio && (
          <div
            className={
              mensajeServicio.includes("✅")
                ? "success-message"
                : "error-mensaje"
            }
            style={{ marginBottom: "20px" }}
          >
            {mensajeServicio}
          </div>
        )}

        <AddServiceWizard 
          fetchServicios={fetchServicios} 
          setParentMensaje={setMensajeServicio} 
        />

        <section className="ad-card ad-mt">
          <button
            type="button"
            className="ad-header ad-header-violet"
            onClick={() => setServiciosGlobalDesplegado(!serviciosGlobalDesplegado)}
            aria-expanded={serviciosGlobalDesplegado}
          >
            <span className="ad-icon">✂️</span>
            <span className="ad-titles">
              <span className="ad-title">Servicios Guardados</span>
              <span className="ad-subtitle">Categorías y servicios activos del catálogo</span>
            </span>
            <span className="ad-badge">
              <span className="ad-badge-dot" />
              {(servicios || []).reduce((acc, s) => { const k = (s.nombre || "").split(" - ")[0].trim(); if (k && !acc.has(k)) acc.add(k); return acc; }, new Set()).size}{" "}
              categorías
            </span>
            <span className={`ad-chevron ${serviciosGlobalDesplegado ? "open" : ""}`}>▼</span>
          </button>

          {serviciosGlobalDesplegado && (
            <div className="ad-panel">
            {(() => {
              // renderNombreServicio no longer needed, using parseServiceName directly


              const groupedServicios = {};
              servicios.forEach((s) => {
                const sNombre = s.nombre || "";
                const parts = sNombre.split(" - ");
                const title = parts[0].trim();
                const subtitle = parts.length > 1 ? parts.slice(1).join(" - ").trim() : "";
                if (!groupedServicios[title]) {
                  groupedServicios[title] = [];
                }
                groupedServicios[title].push({ ...s, subtitle });
              });

              const keys = Object.keys(groupedServicios);
              if (keys.length === 0) {
                return (
                  <div className="ad-empty">
                    <span className="ad-empty-icon">📦</span>
                    <p>No hay servicios guardados</p>
                    <span>Crea tu primera categoría con "✨ Añadir Servicios".</span>
                  </div>
                );
              }

              return keys.map((title) => {
                const items = groupedServicios[title];
                const hasSubservices = items.some(item => item.subtitle !== "");
                const isExpanded = !!expandedCategories[title];
                const isCatSelected = selectedItem && selectedItem.type === "category" && selectedItem.name === title;

                return (
                  <div key={title} className={`ad-cat ${isCatSelected ? "seleccionada" : ""}`}>
                    <div
                      className="ad-cat-header"
                      onClick={(e) => {
                        if (isCatSelected) {
                          setSelectedItem(null);
                        } else {
                          setSelectedItem({
                            type: "category",
                            name: title
                          });
                          if (hasSubservices && !isExpanded) {
                            setExpandedCategories((prev) => ({
                              ...prev,
                              [title]: true,
                            }));
                          }
                          const target = e.currentTarget;
                          setTimeout(() => {
                            if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 50);
                        }
                      }}
                    >
                      {hasSubservices && (
                        <button
                          type="button"
                          className="ad-chev-btn"
                          onClick={(e) => toggleCategoryExpand(title, e)}
                          title={isExpanded ? "Contraer" : "Expandir"}
                        >
                          <span className={`ad-chevron-sub ${isExpanded ? "open" : ""}`}>▼</span>
                        </button>
                      )}
                      {!hasSubservices && <div className="ad-chev-spacer" />}

                      <input
                        type="radio"
                        name="selected-service-item"
                        checked={!!isCatSelected}
                        onChange={() => {}}
                        className="ad-radio"
                      />
                      <span className="ad-cat-title">{title}</span>
                      {isCatSelected && (
                        <span className="ad-pill-selected">✓ Seleccionada</span>
                      )}
                      {hasSubservices && (
                        <span className="ad-cat-count">
                          {items.length} {items.length === 1 ? "opción" : "opciones"}
                        </span>
                      )}
                    </div>

                    {hasSubservices && isExpanded && (
                      <div className="ad-servs">
                        {items.map((s) => {
                          const isServiceSelected = selectedItem && selectedItem.type === "service" && selectedItem.id === s.id;
                          const parsed = parseServiceName(s.nombre);

                          return (
                            <div
                              key={s.id}
                              className={`ad-serv-item ${isServiceSelected ? "selected" : ""}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ServiceBackgroundCard
                                nombre={parsed.subtitle || parsed.category}
                                tiempo={s.duracion}
                                background_id={parsed.fondo}
                                isSelected={isServiceSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isServiceSelected) {
                                    setSelectedItem(null);
                                  } else {
                                    setSelectedItem({
                                      type: "service",
                                      id: s.id,
                                      name: parsed.subtitle || parsed.category,
                                      rawName: s.nombre,
                                      duration: s.duracion,
                                      price: s.precio
                                    });
                                  }
                                }}
                              />

                              {isServiceSelected && (
                                <div className="ad-item-actions">
                                  <button
                                    type="button"
                                    className="ad-act-btn ad-act-edit"
                                    disabled={loadingServicio}
                                    onClick={() => abrirModalModificar()}
                                  >
                                    ✏️ Editar Información
                                  </button>
                                  <button
                                    type="button"
                                    className="ad-act-btn ad-act-theme"
                                    disabled={loadingServicio}
                                    onClick={() => abrirModalFondo()}
                                  >
                                    ✨ Cambiar Fondo
                                  </button>
                                  <button
                                    type="button"
                                    className="ad-act-btn ad-act-del"
                                    disabled={loadingServicio}
                                    onClick={() => eliminarSeleccionado()}
                                  >
                                    🗑️ Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isCatSelected && (
                      <div className="ad-cat-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="ad-act-btn ad-act-edit"
                          disabled={loadingServicio}
                          onClick={() => abrirModalModificar()}
                        >
                          ✏️ Editar Información
                        </button>
                        <button
                          type="button"
                          className="ad-act-btn ad-act-add"
                          disabled={loadingServicio}
                          onClick={() => {
                            setNewSubError("");
                            setNewSubNombre("");
                            setNewSubBloques(2);
                            setNewSubPrecio("");
                            setNewSubColor("zafiro");
                            setAddSubtitleModalOpen(true);
                          }}
                        >
                          ➕ Añadir Subtítulo
                        </button>
                        <button
                          type="button"
                          className="ad-act-btn ad-act-del"
                          disabled={loadingServicio}
                          onClick={() => eliminarSeleccionado()}
                        >
                          🗑️ Eliminar Categoría
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            </div>
          )}
        </section>

        <section className="ad-card ad-mt">
          <button
            type="button"
            className="ad-header ad-header-teal"
            onClick={() => setTrabajadoresGlobalDesplegado(!trabajadoresGlobalDesplegado)}
            aria-expanded={trabajadoresGlobalDesplegado}
          >
            <span className="ad-icon">👥</span>
            <span className="ad-titles">
              <span className="ad-title">Trabajadores Registrados</span>
              <span className="ad-subtitle">Gestiona tu equipo</span>
            </span>
            <span className="ad-badge">
              <span className="ad-badge-dot" />
              {trabajadores.length} {trabajadores.length === 1 ? "trabajador" : "trabajadores"}
            </span>
            <span className={`ad-chevron ${trabajadoresGlobalDesplegado ? "open" : ""}`}>▼</span>
          </button>

          {trabajadoresGlobalDesplegado && (
            <div className="ad-panel">
            {trabajadores.length === 0 ? (
              <div className="ad-empty">
                <span className="ad-empty-icon">👥</span>
                <p>No hay trabajadores registrados</p>
                <span>Los trabajadores registrados aparecerán aquí.</span>
              </div>
            ) : (
              trabajadores.map((t) => {
                const isSelected = selectedWorkers.includes(t.id);
                const isExpanded = !!expandedWorkers[t.id];

                const categoriasUnicas = new Set();
                t.servicios?.forEach((s) => {
                  const parts = s.nombre.split(" - ");
                  if (parts.length > 0) categoriasUnicas.add(parts[0].trim());
                });
                const especialidad = categoriasUnicas.size > 0
                  ? Array.from(categoriasUnicas).join(", ")
                  : "Estilista Profesional";

                const iniciales = `${(t.nombre || "").charAt(0)}${(t.apellidos || "").charAt(0)}`.toUpperCase().trim() || "?";

                return (
                  <div
                    key={t.id}
                    className={`ad-worker ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleSelectWorker(t.id)}
                  >
                    <div className="ad-worker-head">
                      <button
                        type="button"
                        className="ad-chev-btn"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWorkerExpand(t.id); }}
                        title={isExpanded ? "Contraer" : "Ver detalles"}
                      >
                        <span className={`ad-chevron-sub ${isExpanded ? "open" : ""}`}>▼</span>
                      </button>
                      <span className="ad-worker-avatar">{iniciales}</span>
                      <div className="ad-worker-info">
                        <span className="ad-worker-name">{t.nombre} {t.apellidos}</span>
                        <span className="ad-worker-esp">{especialidad}</span>
                      </div>
                      {isSelected && (
                        <span className="ad-worker-check">✓</span>
                      )}
                    </div>

                    {isExpanded && (
                      <div
                        className="ad-worker-details animated-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="ad-detail-row">
                          <span className="ad-detail-label">📧 Correo</span>
                          <a href={`mailto:${t.correo}`} className="ad-detail-value ad-email">{t.correo}</a>
                        </div>
                        <div className="ad-detail-row">
                          <span className="ad-detail-label">✆ Teléfono</span>
                          <span className="ad-detail-value">{t.telefono}</span>
                        </div>
                        <div className="ad-detail-row">
                          <span className="ad-detail-label">🧰 Especialidad</span>
                          <span className="ad-detail-value">{especialidad}</span>
                        </div>
                        <div className="ad-detail-row">
                          <span className="ad-detail-label">● Estado</span>
                          <span className="ad-detail-value">
                            <span className="ad-pill-ok">
                              <span className="ad-pill-ok-dot" />
                              Activo
                            </span>
                          </span>
                        </div>
                        <div className="ad-detail-row">
                          <span className="ad-detail-label">📅 Fecha de registro</span>
                          <span className="ad-detail-value">01/06/2026</span>
                        </div>
                        <div className="ad-detail-row">
                          <span className="ad-detail-label">💰 Contabilidad</span>
                          <span className={`ad-detail-value ${t.permiso_contabilidad ? "ad-pill-ok" : "ad-pill-no"}`}>
                            {t.permiso_contabilidad ? "✅ Autorizado" : "⛔ Sin permiso"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {/* Panel de permisos de contabilidad */}
            <PermisoContabilidadPanel
              trabajadores={trabajadores}
              tokens={tokens}
              onUpdate={fetchTrabajadores}
            />
            </div>
          )}
        </section>

        {selectedWorkers.length > 0 && createPortal(
          <div className="selection-action-bar worker-action-bar">
            <div className="action-bar-info">
              <span className="action-bar-value">
                {selectedWorkers.length} {selectedWorkers.length === 1 ? "trabajador seleccionado" : "trabajadores seleccionados"}
              </span>
            </div>
            <div className="action-bar-buttons">
              <button
                onClick={eliminarTrabajadoresSeleccionados}
                className="btn-action-delete"
                disabled={loadingServicio}
                style={{ width: "100%", justifyContent: "center" }}
              >
                Eliminar Selección
              </button>
            </div>
          </div>,
          document.body
        )}


      {editModalOpen && selectedItem && (
        <div className="glass-modal-overlay">
          <div className="glass-modal">
            <div className="glass-modal-header">
              <span className="glass-modal-title">
                {selectedItem.type === "category" ? "Modificar Categoría" : "Modificar Servicio"}
              </span>
              <button 
                onClick={() => setEditModalOpen(false)} 
                className="glass-modal-close"
              >
                ✕
              </button>
            </div>
            
            <div className="glass-modal-body">
              {errorModal && (
                <div className="error-mensaje" style={{ marginBottom: "10px", padding: "10px" }}>
                  {errorModal}
                </div>
              )}
              
              <div className="glass-modal-field">
                <label style={{ marginTop: 0 }}>Nombre:</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  placeholder={selectedItem.type === "category" ? "Nombre de categoría" : "Nombre del servicio"}
                />
              </div>

              {selectedItem.type === "service" && (
                <>
                  <div className="glass-modal-field">
                    <label>Duración (minutos):</label>
                    <input 
                      type="number" 
                      value={editDuration} 
                      onChange={(e) => setEditDuration(e.target.value)} 
                      min="1"
                    />
                  </div>
                  <div className="glass-modal-field">
                    <label>Precio ($):</label>
                    <input 
                      type="number" 
                      value={editPrice} 
                      onChange={(e) => setEditPrice(e.target.value)} 
                      min="0"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="glass-modal-footer">
              <button 
                onClick={() => setEditModalOpen(false)} 
                className="btn-secondary"
                style={{ width: "auto", margin: 0 }}
                disabled={loadingServicio}
              >
                Cancel
              </button>
              <button 
                onClick={guardarModificacion} 
                className="btn-guardar"
                style={{ width: "auto", margin: 0, padding: "10px 20px" }}
                disabled={loadingServicio}
              >
                {loadingServicio ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fondoModalOpen && selectedItem && selectedItem.type === "service" && (
        <div className="glass-modal-overlay">
          <div className="glass-modal">
            <div className="glass-modal-header">
              <span className="glass-modal-title">
                ✨ Cambiar Fondo: {selectedItem.name}
              </span>
              <button 
                onClick={() => setFondoModalOpen(false)} 
                className="glass-modal-close"
              >
                ✕
              </button>
            </div>
            
            <div className="glass-modal-body">
              {fondoError && (
                <div className="error-mensaje" style={{ marginBottom: "10px", padding: "10px" }}>
                  {fondoError}
                </div>
              )}
              
              <div className="gemstone-selector-area">
                <label className="gem-selector-label">Elige el fondo visual:</label>
                <div className="gem-options-flex">
                  {GEMSTONES.map((gem) => (
                    <button
                      key={gem.id}
                      type="button"
                      onClick={() => setFondoSeleccionado(gem.id)}
                      className={`gem-mini-btn ${gem.id} ${fondoSeleccionado === gem.id ? "active" : ""}`}
                      title={`${gem.label} brillante`}
                      disabled={loadingServicio}
                    >
                      <span className="gem-emoji">{gem.emoji}</span>
                      <span className="gem-name">{gem.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-modal-footer">
              <button 
                onClick={() => setFondoModalOpen(false)} 
                className="btn-secondary"
                style={{ width: "auto", margin: 0 }}
                disabled={loadingServicio}
              >
                Cancel
              </button>
              <button 
                onClick={guardarFondo} 
                className="btn-guardar"
                style={{ width: "auto", margin: 0, padding: "10px 20px" }}
                disabled={loadingServicio}
              >
                {loadingServicio ? "Guardando..." : "Guardar Fondo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addSubtitleModalOpen && selectedItem && (        <div className="glass-modal-overlay">
          <div className="glass-modal" style={{ maxWidth: "500px", padding: "0", background: "transparent", border: "none" }}>
            <div className={`subtitle-config-card gem-${newSubColor} animated-fade-in-scale`} style={{ margin: "0" }}>
              <div className="sub-card-header">
                <span className="sub-card-title-text">
                  Añadir Subtítulo a {selectedItem.name}
                </span>
                <button
                  type="button"
                  onClick={() => setAddSubtitleModalOpen(false)}
                  className="sub-card-delete-btn"
                  title="Cerrar"
                  disabled={loadingNewSub}
                >
                  ✕
                </button>
              </div>

              <div className="sub-card-fields-stacked" style={{ marginTop: "16px" }}>
                <div className="sub-card-field-group">
                  <label style={{ color: "rgba(255, 255, 255, 0.8)", fontWeight: "bold" }}>Nombre del subtítulo:</label>
                  <input
                    type="text"
                    value={newSubNombre}
                    onChange={(e) => setNewSubNombre(e.target.value)}
                    placeholder="Ej. Corte Premium, Corte Clásico..."
                    className="sub-card-input-text"
                    disabled={loadingNewSub}
                  />
                </div>

                <div className="sub-card-fields-grid">
                  <div className="sub-card-field-group">
                    <label style={{ color: "rgba(255, 255, 255, 0.8)", fontWeight: "bold" }}>Cantidad de bloques (1 bloque = 15 minutos):</label>
                    <select
                      value={newSubBloques}
                      onChange={(e) => setNewSubBloques(Number(e.target.value))}
                      disabled={loadingNewSub}
                      className="sub-card-select"
                    >
                      {Array.from({ length: 30 }, (_, i) => i + 1).map((b) => (
                        <option key={b} value={b}>
                          {b} {b === 1 ? "bloque" : "bloques"} ({b * 15} minutos)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sub-card-field-group">
                    <label style={{ color: "rgba(255, 255, 255, 0.8)", fontWeight: "bold" }}>Precio:</label>
                    <div className="price-input-wrapper">
                      <span className="price-currency-symbol">$</span>
                      <input
                        type="number"
                        value={newSubPrecio}
                        onChange={(e) => setNewSubPrecio(e.target.value)}
                        placeholder="Ej. 25000"
                        className="sub-card-input-price"
                        disabled={loadingNewSub}
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="gemstone-selector-area">
                  <label className="gem-selector-label" style={{ color: "rgba(255, 255, 255, 0.8)", fontWeight: "bold" }}>Color visual de gema brillante:</label>
                  <div className="gem-options-flex">
                    {GEMSTONES.map((gem) => (
                      <button
                        key={gem.id}
                        type="button"
                        onClick={() => setNewSubColor(gem.id)}
                        className={`gem-mini-btn ${gem.id} ${newSubColor === gem.id ? "active" : ""}`}
                        title={`${gem.label} brillante`}
                        disabled={loadingNewSub}
                      >
                        <span className="gem-emoji">{gem.emoji}</span>
                        <span className="gem-name">{gem.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {newSubError && (
                  <div className="error-mensaje" style={{ marginTop: "10px", padding: "10px", borderRadius: "8px" }}>
                    {newSubError}
                  </div>
                )}

                <div className="wizard-actions-bottom-row" style={{ marginTop: "20px" }}>
                  <button
                    type="button"
                    onClick={() => setAddSubtitleModalOpen(false)}
                    className="wizard-action-btn btn-add"
                    disabled={loadingNewSub}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardarNuevoSubtitulo}
                    className="wizard-action-btn btn-save"
                    disabled={loadingNewSub}
                  >
                    {loadingNewSub ? "Guardando..." : "💎 GUARDAR SUBTÍTULO"}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function AppContent() {
  return (
    <>
      <Navbar />
      <DrawerMenu />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/perfil"
            element={<ProtectedRoute element={<ProfilePage />} />}
          />
          <Route path="/citas" element={<CitasPage />} />
          <Route path="/horario" element={<HorarioPage />} />
          <Route path="/qr" element={<QRPage />} />
          <Route
            path="/registrar-trabajador"
            element={<RegistrarTrabajadorPage />}
          />
          <Route
            path="/admin-welcome"
            element={<ProtectedRoute element={<AdminWelcomePage />} requireStaff />}
          />
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route path="/gestion" element={<GestionPage />} />
          <Route
            path="/contabilidad"
            element={<ProtectedRoute element={<ContabilidadPage />} requireContabilidad />}
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
