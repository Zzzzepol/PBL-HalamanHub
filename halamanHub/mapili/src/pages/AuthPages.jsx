import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, FormField, Input, Alert } from '../components/ui/UI';

// ── Brand logo in auth pages
const AuthLogo = () => (
  <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
    <img src="/logo.jpg" alt="Mapili Plant Nursery logo" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
    <div className="flex flex-col leading-none">
      <span className="font-display font-bold text-brand-800 text-lg">Mapili</span>
      <span className="text-xs text-brand-600 font-medium">Plant Nursery</span>
    </div>
  </Link>
);

const getPasswordStrength = (password = '') => {
  if (!password) {
    return { score: 0, label: 'No password', barClass: 'bg-gray-300', textClass: 'text-gray-500' };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { score: 1, label: 'Weak', barClass: 'bg-red-500', textClass: 'text-red-600' };
  }
  if (score <= 4) {
    return { score: 2, label: 'Medium', barClass: 'bg-amber-500', textClass: 'text-amber-600' };
  }
  return { score: 3, label: 'Strong', barClass: 'bg-green-500', textClass: 'text-green-600' };
};

// ── LOGIN PAGE
export const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const from = location.state?.from?.pathname || '/';

  if (isAuthenticated) return <Navigate to={from} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <AuthLogo />

        <div className="bg-white rounded-3xl shadow-lift border border-gray-100 p-8">
          <h1 className="font-display text-2xl font-bold text-gray-800 mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-6">Sign in to your Mapili account</p>

          {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-5" />}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Email address" id="email" required>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" autoComplete="email" required />
            </FormField>

            <FormField label="Password" id="password" required>
              <div className="relative">
                <Input id="password" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required className="pr-11" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" aria-label={showPwd ? 'Hide' : 'Show'}>
                  <i className={`ti ${showPwd ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </FormField>

            <Button variant="primary" type="submit" size="lg" disabled={loading} className="w-full mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-700 font-medium hover:text-brand-800">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

// ── REGISTER PAGE
export const RegisterPage = () => {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]         = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const passwordStrength = getPasswordStrength(form.password);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password)) {
      setError('Password is too weak. Use at least 8 characters with uppercase, lowercase, a number, and a special character.');
      return;
    }
    if (form.phone && !/^09\d{9}$/.test(form.phone)) {
      setError('Phone number must look like 09171234567 — starts with 09, 11 digits total.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <AuthLogo />

        <div className="bg-white rounded-3xl shadow-lift border border-gray-100 p-8">
          <h1 className="font-display text-2xl font-bold text-gray-800 mb-1">Create account</h1>
          <p className="text-gray-500 text-sm mb-6">Join Mapili and order fresh produce</p>

          {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-5" />}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Full name" id="name" required>
              <Input id="name" value={form.name} onChange={e => f('name', e.target.value)} autoComplete="name" required />
            </FormField>

            <FormField label="Email address" id="email" required>
              <Input id="email" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="example@email.com" autoComplete="email" required />
            </FormField>

            <FormField label="Phone number" id="phone">
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={e => f('phone', e.target.value.replace(/[\s-]/g, ''))}
                placeholder="09171234567"
                maxLength={11}
                autoComplete="tel"
              />
              <p className="text-xs text-gray-400 mt-1">Format: 11 digits starting with 09, e.g. 09171234567.</p>
            </FormField>

            <FormField label="Password" id="password" required>
              <div className="relative">
                <Input id="password" type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => f('password', e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required className="pr-11" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" aria-label={showPwd ? 'Hide' : 'Show'}>
                  <i className={`ti ${showPwd ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              </div>
              {form.password && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Password strength</span>
                    <span className={`font-medium ${passwordStrength.textClass}`}>{passwordStrength.label}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${passwordStrength.barClass}`}
                      style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </FormField>

            <FormField label="Confirm password" id="confirmPassword" required>
              <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={e => f('confirmPassword', e.target.value)} placeholder="Re-enter password" autoComplete="new-password" required />
            </FormField>

            <Button variant="primary" type="submit" size="lg" disabled={loading} className="w-full mt-2">
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            By creating an account you agree to our terms of service.
          </p>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-700 font-medium hover:text-brand-800">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
