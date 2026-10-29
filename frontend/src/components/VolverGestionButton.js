import { useNavigate, useLocation } from "react-router-dom";

/**
 * Botón flotante común "← Regresar al Panel de Gestión".
 * Navega a /gestion (Panel de Gestión principal).
 * Si ya estamos en /gestion no hace nada visible.
 */
export default function VolverGestionButton() {
  const navigate = useNavigate();
  const location = useLocation();

  const volver = () => {
    if (location.pathname !== "/gestion") {
      navigate("/gestion");
    }
  };

  return (
    <button
      type="button"
      className="btn-volver-gestion"
      onClick={volver}
      aria-label="Regresar al Panel de Gestión"
      title="Regresar al Panel de Gestión"
    >
      <span aria-hidden="true">←</span> Panel de Gestión
    </button>
  );
}
