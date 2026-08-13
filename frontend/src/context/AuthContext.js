import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

// Django DRF Simple JWT returns { access, refresh }
// Store access token as 'token' for the axios interceptor
function saveTokens(data) {
  const token = data.access || data.token;
  if (token) localStorage.setItem('token', token);
  if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    api.get('/auth/me')
      .then((res) => {
        const u = res.data.user || res.data;
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveTokens(data);
    const u = data.user || data;
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return u;
  };

  const registerLead = async (payload) => {
    const { data } = await api.post('/auth/register/lead', payload);
    saveTokens(data);
    const u = data.user || data;
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return data;
  };

  const registerMember = async (payload) => {
    const { data } = await api.post('/auth/register/member', payload);
    saveTokens(data);
    const u = data.user || data;
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (u) => {
    const updated = { ...user, ...u };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  const isLead = user?.role === 'lead' || user?.role === 'tl';
  const isMember = user?.role === 'member';

  return (
    <AuthContext.Provider value={{ user, loading, login, registerLead, registerMember, logout, updateUser, isLead, isMember }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
