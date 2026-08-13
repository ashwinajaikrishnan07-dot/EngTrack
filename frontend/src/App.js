import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import Login from './pages/Login';
import RegisterLead from './pages/RegisterLead';
import RegisterMember from './pages/RegisterMember';
import LeadDashboard from './pages/LeadDashboard';
import MemberDashboard from './pages/MemberDashboard';
import IssueDetail from './pages/IssueDetail';
import LandingPage from './pages/LandingPage';

import ConnectRepos from './pages/ConnectRepos';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  return user ? children : <Navigate to="/login" replace />;
}

function LeadRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'lead' && user.role !== 'tl') return <Navigate to="/member" replace />;
  
  // Only redirect to onboarding if user has no team at all
  if (!user.teamId && !user.team) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return children;
}

function MemberRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'lead' || user.role === 'tl') return <Navigate to="/lead" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <LandingPage />;
  return <Navigate to={user.role === 'lead' || user.role === 'tl' ? '/lead' : '/member'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register/lead" element={<RegisterLead />} />
      <Route path="/register/member" element={<RegisterMember />} />
      <Route path="/onboarding" element={<PrivateRoute><ConnectRepos /></PrivateRoute>} />
      <Route path="/lead" element={<LeadRoute><LeadDashboard /></LeadRoute>} />
      <Route path="/member" element={<MemberRoute><MemberDashboard /></MemberRoute>} />
      <Route path="/issues/:id" element={<PrivateRoute><IssueDetail /></PrivateRoute>} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                borderRadius: '10px',
                fontSize: '14px',
                border: '1px solid #374151',
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}