import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Cargar tokens y usuario desde localStorage al iniciar
  useEffect(() => {
    const storedTokens = localStorage.getItem('tokens');
    const storedUser = localStorage.getItem('user');

    if (storedTokens && storedUser) {
      try {
        const parsedTokens = JSON.parse(storedTokens);
        const parsedUser = JSON.parse(storedUser);
        setTokens(parsedTokens);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error al cargar datos del localStorage:', error);
        localStorage.removeItem('tokens');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, tokenData) => {
    setUser(userData);
    setTokens(tokenData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('tokens', JSON.stringify(tokenData));
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    setIsAuthenticated(false);
    localStorage.removeItem('tokens');
    localStorage.removeItem('user');
    // Limpieza de claves heredadas (versiones anteriores guardaban tokens sueltos)
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
  };

  const getAuthHeader = () => {
    if (tokens && tokens.access) {
      return {
        Authorization: `Bearer ${tokens.access}`,
      };
    }
    return {};
  };

  const refreshAccessToken = async () => {
    if (!tokens || !tokens.refresh) {
      logout();
      return null;
    }

    try {
      const res = await fetch("/api/token/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });

      if (!res.ok) {
        logout();
        return null;
      }

      const data = await res.json();
      const newTokens = { ...tokens, access: data.access };
      setTokens(newTokens);
      localStorage.setItem("tokens", JSON.stringify(newTokens));
      return data.access;
    } catch (error) {
      logout();
      return null;
    }
  };

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}), ...getAuthHeader() };
    let response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        const retryHeaders = {
          ...(options.headers || {}),
          Authorization: `Bearer ${newAccess}`,
        };
        response = await fetch(url, { ...options, headers: retryHeaders });
      }
    }

    return response;
  };

  const value = {
    user,
    tokens,
    isAuthenticated,
    loading,
    login,
    logout,
    getAuthHeader,
    refreshAccessToken,
    authFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
