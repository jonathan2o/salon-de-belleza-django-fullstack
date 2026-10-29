import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const API_BASE = "/api";

export default function Navbar() {
  const { isAuthenticated, user, logout, authFetch } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [ingresosHoy, setIngresosHoy] = useState(null);
  const [bellIngresa, setBellIngresa] = useState(null);

  // ── Campana admin: ingresos de hoy (polling cada 10 s) ──
  useEffect(() => {
    if (!isAuthenticated || !user?.is_staff) return;
    const flag = { cancelado: false };

    const cargarIngresos = async () => {
      try {
        const res = await authFetch(`${API_BASE}/trabajadores/ingresos/`);
        if (!res.ok) return;
        const data = await res.json();
        if (!flag.cancelado) {
          setIngresosHoy(data);
          setBellIngresa(data.length > 0 ? data[data.length - 1] : null);
        }
      } catch (error) {
        console.log(error);
      }
    };

    cargarIngresos();
    const id = setInterval(cargarIngresos, 10000);
    return () => { flag.cancelado = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const isAgendarCita = location.pathname === "/citas";

  return (
    <nav className="navbar">
      <div className="navbar-brand">Salón de Belleza</div>
      <div className="navbar-links">
        {isAuthenticated ? (
          <>
            {user?.is_staff && (
              <button
                type="button"
                className={`st-bell ${bellIngresa ? "st-bell-nueva" : ""}`}
                title={
                  ingresosHoy && ingresosHoy.length > 0
                    ? `Ingresos de hoy:\n${ingresosHoy.map((i) => `• ${i.nombre} — ${i.hora_ingreso}`).join("\n")}`
                    : "Sin ingresos registrados hoy"
                }
                onClick={() => navigate("/horario")}
              >
                <span className="st-bell-icon">🔔</span>
                {ingresosHoy && ingresosHoy.length > 0 && (
                  <span className="st-bell-badge">{ingresosHoy.length}</span>
                )}
              </button>
            )}
            <NavLink to="/perfil" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Mi Perfil
            </NavLink>
            <span className="nav-user">
              {user && user.nombre}
            </span>
            <button onClick={handleLogout} className="nav-logout-btn">
              Cerrar sesión
            </button>
          </>
        ) : (
          <>

          </>
        )}
      </div>
    </nav>
  );
}
