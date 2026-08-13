import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CircleDot, Github, Users, Bell,
  Settings, LogOut, Search, Menu, X, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/issues', icon: CircleDot, label: 'Issues' },
  { to: '/github-sync', icon: Github, label: 'GitHub Sync' },
  { to: '/team', icon: Users, label: 'Team', tlOnly: true },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    const item = navItems.find(n => path.startsWith(n.to) && n.to !== '/');
    return item ? item.label : 'Gitora';
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-subtle">
        <div className="flex items-center justify-center flex-shrink-0" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
          <img src="/logo.png" alt="Gitora Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <span className="font-medium text-primary" style={{ fontSize: '15px' }}>Gitora</span>
      </div>

      {/* Nav */}
      <nav className="px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, tlOnly }) => {
          if (tlOnly && user?.role !== 'tl') return null;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 transition-colors ${
                  isActive
                    ? 'font-medium'
                    : 'text-secondary hover:bg-input hover:text-[#4da6ff]'
                }`
              }
              style={({ isActive }) => ({
                padding: '9px 16px',
                fontSize: '13px',
                backgroundColor: isActive ? 'var(--bg-input)' : 'transparent',
                color: isActive ? '#4da6ff' : undefined,
                borderLeft: isActive ? '3px solid #4da6ff' : '3px solid transparent',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="mt-auto px-4 py-4 border-t border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-primary font-medium text-sm" style={{ backgroundColor: '#4da6ff' }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary truncate" style={{ fontSize: '13px' }}>{user?.name || 'User'}</p>
            <p className="text-secondary capitalize truncate" style={{ fontSize: '12px' }}>{user?.role || 'Member'}</p>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors ml-auto">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col flex-shrink-0" style={{ width: '220px', borderRight: '1px solid var(--border-subtle)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative bg-card flex flex-col z-10" style={{ width: '220px' }}>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-input"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-subtle">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-input text-primary">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Gitora Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-medium text-sm text-primary">Gitora</span>
          </div>
          <div className="w-8" /> {/* Spacer for centering */}
        </header>

        {/* Top bar (desktop) */}
        <header className="hidden lg:flex items-center justify-between bg-card border-b border-subtle" style={{ padding: '14px 24px' }}>
          <h1 className="font-medium text-primary" style={{ fontSize: '15px' }}>{getPageTitle()}</h1>
          <div className="flex items-center gap-4">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-transparent border border-subtle rounded-md text-secondary text-sm p-1 outline-none focus:border-[#4da6ff]"
            >
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
              <option value="system">System Mode</option>
            </select>
            <button className="text-secondary hover:text-primary">
              <Search size={18} />
            </button>
            <button className="text-secondary hover:text-primary relative">
              <Bell size={18} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-card"></span>
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-primary font-medium text-sm ml-2" style={{ backgroundColor: '#4da6ff' }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
