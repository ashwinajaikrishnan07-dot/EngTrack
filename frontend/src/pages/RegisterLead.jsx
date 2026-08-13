import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Zap, Crown, Users, Check, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PhoneInput from '../components/PhoneInput';
import toast from 'react-hot-toast';

const ROLE_TAGS = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'devops', label: 'DevOps' },
  { value: 'fullstack', label: 'Full Stack' },
];

// Password strength checker
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500' };
  if (score <= 5) return { score, label: 'Good', color: 'bg-blue-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

export default function RegisterLead() {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') === 'member' ? 'member' : 'lead';

  const [selectedRole, setSelectedRole] = useState(defaultRole);
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    githubRepo: '', whatsappNumber: '',
    roleTag: 'fullstack',
    inviteCode: searchParams.get('invite') || searchParams.get('code') || '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { registerLead, registerMember } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  
  const isSubmitting = React.useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    if (selectedRole === 'member' && !form.inviteCode.trim()) {
      toast.error('Invite code is required to join as a Team Member');
      return;
    }
    isSubmitting.current = true;
    setLoading(true);
    try {
      if (selectedRole === 'lead') {
        await registerLead({
          name: form.name,
          email: form.email,
          password: form.password,
          whatsappNumber: form.whatsappNumber,
        });
        toast.success('Account created! Please connect your GitHub repos.');
        navigate('/onboarding');
      } else {
        const payload = {
          name: form.name,
          email: form.email,
          password: form.password,
          whatsappNumber: form.whatsappNumber,
          roleTag: form.roleTag,
          inviteCode: form.inviteCode.trim().toUpperCase(),
        };
        console.log('Submitting member registration:', payload);
        await registerMember(payload);
        toast.success('Joined team successfully!');
        navigate('/member');
      }
    } catch (err) {
      let errorMsg = err.response?.data?.message || err.response?.data?.detail || 'Registration failed';
      if (typeof errorMsg === 'object') {
        // Flatten serializer errors into a single string
        errorMsg = Object.values(errorMsg).flat().join(', ');
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const roleCards = [
    { value: 'lead', icon: Crown, label: 'Team Leader', desc: 'Create and manage your team' },
    { value: 'member', icon: Users, label: 'Team Member', desc: 'Join with an invite code' },
  ];

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
            Join the<br /><span className="text-blue-400">Engineering Hub</span>
          </h1>
          <p className="text-blue-200/70 text-sm leading-relaxed">
            Create your team or join an existing one. Start tracking issues with AI-powered insights today.
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

          <h2 className="text-2xl font-bold text-primary mb-1">Create account</h2>
          <p className="text-secondary text-sm mb-6">Choose your role to get started</p>

          {/* Role cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {roleCards.map(({ value, icon: Icon, label, desc }) => {
              const active = selectedRole === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    active
                      ? 'border-[#4da6ff] bg-card'
                      : 'border-subtle bg-input hover:border-[#4da6ff]'
                  }`}
                >
                  {active && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-[#4da6ff] rounded-full flex items-center justify-center">
                      <Check size={11} className="text-primary" strokeWidth={3} />
                    </div>
                  )}
                  <Icon size={20} className={`mb-2 ${active ? 'text-[#4da6ff]' : 'text-muted'}`} />
                  <p className={`text-sm font-semibold ${active ? 'text-primary' : 'text-secondary'}`}>{label}</p>
                  <p className={`text-xs mt-0.5 ${active ? 'text-[#4da6ff]' : 'text-muted'}`}>{desc}</p>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Full Name</label>
              <input className="w-full px-4 py-2.5 bg-card border border-subtle rounded-xl text-primary placeholder-[#7a8a9a] text-sm focus:outline-none focus:border-[#4da6ff] focus:ring-2 focus:ring-[#4da6ff]/20 transition-all"
                placeholder="John Doe" value={form.name} onChange={set('name')} required minLength={2} />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Email</label>
              <input type="email" className="w-full px-4 py-2.5 bg-card border border-subtle rounded-xl text-primary placeholder-[#7a8a9a] text-sm focus:outline-none focus:border-[#4da6ff] focus:ring-2 focus:ring-[#4da6ff]/20 transition-all"
                placeholder="you@company.com" value={form.email} onChange={set('email')} required autoComplete="email" />
            </div>

            {/* Password + strength meter */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 pr-11 bg-card border border-subtle rounded-xl text-primary placeholder-[#7a8a9a] text-sm focus:outline-none focus:border-[#4da6ff] focus:ring-2 focus:ring-[#4da6ff]/20 transition-all"
                  placeholder="Min 8 chars, uppercase, number" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[#4da6ff]">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength bar */}
              {form.password && (() => {
                const strength = getPasswordStrength(form.password);
                return (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5,6].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength.score ? strength.color : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strength.score <= 2 ? 'text-red-500' : strength.score <= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {strength.label} password
                      {strength.score < 4 && ' — add uppercase, numbers or symbols'}
                    </p>
                  </div>
                );
              })()}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {[
                  { ok: form.password.length >= 8, label: '8+ chars' },
                  { ok: /[A-Z]/.test(form.password), label: 'Uppercase' },
                  { ok: /[a-z]/.test(form.password), label: 'Lowercase' },
                  { ok: /\d/.test(form.password), label: 'Number' },
                ].map(({ ok, label }) => (
                  <span key={label} className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                    {ok ? '✓' : '○'} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* WhatsApp with country code */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">
                WhatsApp Number <span className="text-muted font-normal">(optional — for issue alerts)</span>
              </label>
              <PhoneInput
                value={form.whatsappNumber}
                onChange={(v) => setForm({ ...form, whatsappNumber: v })}
                placeholder="9876543210"
              />
              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                <Shield size={10} /> Select your country code, then enter your number
              </p>
            </div>

            {/* Team Lead fields */}
            {selectedRole === 'lead' && (
              <div className="hidden">
                {/* Space reserved for future lead-specific fields if needed */}
              </div>
            )}

            {/* Team Member fields */}
            {selectedRole === 'member' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1.5">Role Tag</label>
                  <select className="w-full px-4 py-2.5 bg-card border border-subtle rounded-xl text-primary text-sm focus:outline-none focus:border-[#4da6ff] focus:ring-2 focus:ring-[#4da6ff]/20 transition-all"
                    value={form.roleTag} onChange={set('roleTag')}>
                    {ROLE_TAGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <p className="text-xs text-muted mt-1">Issues will be routed to you based on this</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1.5">Invite Code</label>
                  <input
                    className="w-full px-4 py-2.5 bg-card border border-subtle rounded-xl text-primary placeholder-[#7a8a9a] text-sm font-mono tracking-widest uppercase focus:outline-none focus:border-[#4da6ff] focus:ring-2 focus:ring-[#4da6ff]/20 transition-all"
                    placeholder="e.g. A3F9C2"
                    value={form.inviteCode}
                    onChange={(e) => setForm({ ...form, inviteCode: e.target.value.toUpperCase() })}
                    maxLength={8}
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#4da6ff] hover:bg-[#3b8fe8] text-primary font-semibold rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm mt-2"
            >
              {loading
                ? 'Creating account...'
                : selectedRole === 'lead' ? 'Create Team & Register' : 'Join Team'}
            </button>
          </form>

          <p className="text-center text-sm text-secondary mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-[#4da6ff] hover:text-[#3b8fe8] font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
