import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, FormField, Input, Alert } from '../components/ui/UI';

// ── Brand logo in auth pages
const AuthLogo = () => (
  <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
    <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
      <i className="ti ti-plant text-white text-xl" aria-hidden="true" />
    </div>
    <div className="flex flex-col leading-none">
      <span className="font-display font-bold text-brand-800 text-lg">Mapili</span>
      <span className="text-xs text-brand-600 font-medium">Plant Nursery</span>
    </div>
  </Link>
);

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
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" autoComplete="email" required />
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

  if (isAuthenticated) return <Navigate to="/" replace />;

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password });
      navigate('/');
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
              <Input id="name" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Juan dela Cruz" autoComplete="name" required />
            </FormField>

            <FormField label="Email address" id="email" required>
              <Input id="email" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="juan@email.com" autoComplete="email" required />
            </FormField>

            <FormField label="Phone number" id="phone">
              <Input id="phone" type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+63 9XX XXX XXXX" autoComplete="tel" />
            </FormField>

            <FormField label="Password" id="password" required>
              <div className="relative">
                <Input id="password" type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => f('password', e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required className="pr-11" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" aria-label={showPwd ? 'Hide' : 'Show'}>
                  <i className={`ti ${showPwd ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              </div>
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
