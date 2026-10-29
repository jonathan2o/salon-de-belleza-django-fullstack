import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import VolverGestionButton from "../components/VolverGestionButton";

const API_BASE = "/api";

export default function AdminLoginPage() {

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const iniciarSesion = async () => {

    setMensaje("");
    setLoading(true);

    try {

      const response = await fetch(`${API_BASE}/login/admin/`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          username: correo,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {

        // Guardar sesión en el contexto (igual que el login de trabajador)
        const userData = {
          id: data.user_id,
          trabajador_id: data.trabajador_id,
          correo: data.correo,
          nombre: data.nombre || (data.correo || "").split("@")[0],
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

        setMensaje("✅ Login administrador exitoso");

        setTimeout(() => {
          navigate("/admin-welcome");
        }, 1000);

      } else {

        setMensaje(`❌ ${data.error || "Credenciales incorrectas"}`);

      }

    } catch (error) {

      setMensaje("❌ Error del servidor");

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="page-container">
      <VolverGestionButton />

      <h2 className="page-title">
        Inicio de Sesión Administrador
      </h2>

      {mensaje && (
        <div className="success-message">
          {mensaje}
        </div>
      )}

      <label>Correo:</label>

      <input
        type="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder="Ingrese correo"
      />

      <label>Contraseña:</label>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Ingrese contraseña"
      />

      <button
        onClick={iniciarSesion}
        className="btn-agendar"
        disabled={loading}
      >
        {loading ? "Ingresando..." : "Iniciar Sesión"}
      </button>

    </div>
  );
}