import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const isSubmitting = React.useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (form.remember) {
        localStorage.setItem('et_remember', form.email);
      } else {
        localStorage.removeItem('et_remember');
      }
      toast.success('Welcome back!');
      const role = user?.role;
      navigate(role === 'lead' || role === 'tl' ? '/lead' : '/member');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
      if (!clientId || clientId === 'your_google_client_id_here') {
        toast.error('Google login not configured. Set REACT_APP_GOOGLE_CLIENT_ID in .env');
        return;
      }
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${window.location.origin}/auth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch (err) {
      toast.error('Google login failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-input">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-12"
        style={{ background: '#111111', borderRight: '1px solid #1e2a38' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden p-1">
            <img src="/logo.png" alt="Gitora Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-primary font-bold text-xl">Gitora</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-primary leading-tight mb-4">
            Smarter Issue<br /><span className="text-blue-400">Management.</span>
          </h1>
          <p className="text-blue-200/70 text-sm leading-relaxed">
            Streamline your engineering workflow with intelligent issue tracking, team collaboration, and real-time GitHub sync.
          </p>
        </div>
        <p className="text-blue-900/60 text-xs">© 2025 Gitora</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-input p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Gitora Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-primary text-lg">Gitora</span>
          </div>

          <div className="mb-6">
            <span className="inline-block text-[11px] font-bold text-[#4da6ff] uppercase tracking-wider mb-2">
              Welcome back
            </span>
            <h2 className="text-2xl font-bold text-primary mb-1">Sign in to Gitora</h2>
            <p className="text-secondary text-sm">Enter your credentials to access your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Email address</label>
              <input type="email" className="w-full px-4 py-2.5 bg-card border border-subtle rounded-xl text-primary placeholder-[#7a8a9a] text-sm focus:outline-none focus:border-[#4da6ff] focus:ring-2 focus:ring-[#4da6ff]/20 transition-all"
                placeholder="you@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-secondary">Password</label>
                <button type="button" className="text-xs text-[#4da6ff] hover:text-[#3b8fe8] font-medium transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 pr-11 bg-card border border-subtle rounded-xl text-primary placeholder-[#7a8a9a] text-sm focus:outline-none focus:border-[#4da6ff] focus:ring-2 focus:ring-[#4da6ff]/20 transition-all"
                  placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[#4da6ff]">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2 pt-1 pb-2">
              <input
                id="remember"
                type="checkbox"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                className="w-4 h-4 rounded border-subtle text-[#4da6ff] focus:ring-[#4da6ff]/20 bg-card"
              />
              <label htmlFor="remember" className="text-sm text-secondary cursor-pointer select-none">
                Remember me for 7 days
              </label>
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#4da6ff] hover:bg-[#3b8fe8] text-primary font-semibold rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* OR divider */}
          <div className="flex items-center w-full my-6">
            <div className="flex-1 h-px bg-subtle" />
            <span className="text-xs text-muted px-4 uppercase tracking-wider font-medium">or continue with</span>
            <div className="flex-1 h-px bg-subtle" />
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-card border border-subtle hover:border-subtle/80 hover:bg-input rounded-xl text-primary text-sm font-semibold transition-all disabled:opacity-50 shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting...' : 'Google'}
          </button>

          {/* Register link */}
          <p className="text-center text-sm text-secondary mt-8">
            Don't have an account?{' '}
            <Link to="/register/lead" className="text-[#4da6ff] hover:text-[#3b8fe8] font-semibold transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
