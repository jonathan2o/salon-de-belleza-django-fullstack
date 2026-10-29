import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ element, requireStaff = false, requireContabilidad = false }) => {
  const { isAuthenticated, loading, user } = useContext(AuthContext);

  if (loading) {
    return <div className="page-container"><p>Cargando...</p></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Solo personal administrativo (staff)
  if (requireStaff && !user?.is_staff) {
    return <Navigate to="/" replace />;
  }

  // Módulo de contabilidad: admin o trabajador con permiso vigente
  if (requireContabilidad && !(user?.is_staff || user?.permiso_contabilidad)) {
    return <Navigate to="/" replace />;
  }

  return element;
};

export default ProtectedRoute;
