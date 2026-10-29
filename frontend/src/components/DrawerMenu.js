import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './DrawerMenu.css';

export default function DrawerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation(); // Para saber qué opción está activa
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleNavigation = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault();
    }
    closeMenu();
  };

  return (
    <>
      {/* Botón Flotante para abrir el menú */}
      <button className="drawer-toggle-btn" onClick={toggleMenu} aria-label="Abrir menú">
        ☰
      </button>

      {/* Overlay desenfocado para el fondo */}
      <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={closeMenu}></div>

      {/* Panel Lateral */}
      <div className={`drawer-container ${isOpen ? 'open' : ''}`}>
        
        {/* Encabezado */}
        <div className="drawer-header">
          <span className="drawer-brand">✂ BARBER PRO</span>
          <span className="drawer-subbrand">Sistema de Gestión</span>
          
          <button 
            className="drawer-discreet-btn" 
            onClick={(e) => {
              handleNavigation(e, '/gestion');
              navigate('/gestion');
            }}
            title="Panel de Gestión" 
            aria-label="Abrir panel privado de gestión"
          >
            <svg 
              className="drawer-discreet-svg" 
              width="15" 
              height="15" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          <div className="drawer-header-line"></div>
        </div>

        {/* Opciones del menú (Vista Pública) */}
        <div className="drawer-nav">
          
          <Link 
            to="/citas" 
            className={`drawer-item ${location.pathname === '/citas' ? 'active' : ''}`}
            onClick={(e) => handleNavigation(e, '/citas')}
          >
            <div className="drawer-item-content">
              <span className="drawer-item-icon">📅</span>
              <span>Agendar Cita</span>
            </div>
          </Link>

          <Link 
            to="/horario" 
            className={`drawer-item ${location.pathname === '/horario' ? 'active' : ''}`}
            onClick={(e) => handleNavigation(e, '/horario')}
          >
            <div className="drawer-item-content">
              <span className="drawer-item-icon">🕒</span>
              <span>Horario</span>
            </div>
          </Link>

          <Link 
            to="/qr" 
            className={`drawer-item ${location.pathname === '/qr' ? 'active' : ''}`}
            onClick={(e) => handleNavigation(e, '/qr')}
          >
            <div className="drawer-item-content">
              <span className="drawer-item-icon">📷</span>
              <span>QR</span>
            </div>
          </Link>

        </div>

        {/* Pie del menú */}
        <div className="drawer-footer">
          <span>Versión 1.0</span>
          <span>© 2026</span>
        </div>

      </div>
    </>
  );
}
