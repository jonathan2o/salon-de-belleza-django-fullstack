import React from 'react';
import { useNavigate } from 'react-router-dom';
import VolverGestionButton from '../components/VolverGestionButton';
import './GestionPage.css';

export default function GestionPage() {
  const navigate = useNavigate();

  const handlePlanesClick = () => {
    alert('Próximamente');
  };

  return (
    <div className="page-container gestion-page">
      <VolverGestionButton />
      <div className="gestion-header">
        <button 
          className="btn-volver-publico" 
          onClick={() => navigate('/citas')}
          aria-label="Volver a la vista pública de citas"
        >
          ← Volver a Citas
        </button>
        <h2 className="page-title" style={{ marginBottom: '8px' }}>
          Panel de Gestión
        </h2>
        <p className="gestion-subtitle">
          Acceso privado a las herramientas administrativas y de equipo
        </p>
      </div>

      <div className="gestion-grid">
        {/* Opción 1: Iniciar Sesión */}
        <div 
          className="gestion-card" 
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/'); }}
          title="Iniciar sesión para trabajadores"
        >
          <div className="gestion-card-icon-wrapper">
            <span className="gestion-card-icon">👤</span>
          </div>
          <div className="gestion-card-body">
            <h3 className="gestion-card-title">Iniciar Sesión</h3>
            <p className="gestion-card-desc">
              Acceso para colaboradores y trabajadores del salón
            </p>
          </div>
          <div className="gestion-card-arrow">→</div>
        </div>

        {/* Opción 2: Administrador */}
        <div 
          className="gestion-card" 
          onClick={() => navigate('/admin-login')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/admin-login'); }}
          title="Acceso administrativo"
        >
          <div className="gestion-card-icon-wrapper">
            <span className="gestion-card-icon">🛠</span>
          </div>
          <div className="gestion-card-body">
            <h3 className="gestion-card-title">Administrador</h3>
            <p className="gestion-card-desc">
              Gestión global de servicios, equipo y configuración
            </p>
          </div>
          <div className="gestion-card-arrow">→</div>
        </div>

        {/* Opción 3: Registrar Trabajador */}
        <div 
          className="gestion-card" 
          onClick={() => navigate('/registrar-trabajador')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/registrar-trabajador'); }}
          title="Registrar nuevo trabajador"
        >
          <div className="gestion-card-icon-wrapper">
            <span className="gestion-card-icon">👨‍💼</span>
          </div>
          <div className="gestion-card-body">
            <h3 className="gestion-card-title">Registrar Trabajador</h3>
            <p className="gestion-card-desc">
              Dar de alta a nuevos barberos o estilistas en el sistema
            </p>
          </div>
          <div className="gestion-card-arrow">→</div>
        </div>

        {/* Opción 4: Planes */}
        <div 
          className="gestion-card gestion-card-disabled" 
          onClick={handlePlanesClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePlanesClick(); }}
          title="Planes de suscripción"
        >
          <div className="gestion-card-icon-wrapper">
            <span className="gestion-card-icon">💎</span>
          </div>
          <div className="gestion-card-body">
            <div className="gestion-card-title-row">
              <h3 className="gestion-card-title">Planes</h3>
              <span className="gestion-badge">◉ Próximamente</span>
            </div>
            <p className="gestion-card-desc">
              Planes de suscripción y funciones premium
            </p>
          </div>
          <div className="gestion-card-arrow">ℹ</div>
        </div>
      </div>
    </div>
  );
}
