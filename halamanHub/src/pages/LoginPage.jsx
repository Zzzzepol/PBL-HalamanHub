import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';
import { Button, Input, FormField } from '../components/ui/UI';

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach the server. Make sure the backend is running on port 4000.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-700">
      {/* Background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.06) 0, transparent 35%),' +
            'radial-gradient(circle at 85% 80%, rgba(255,255,255,0.05) 0, transparent 40%),' +
            'radial-gradient(circle at 75% 15%, rgba(255,255,255,0.04) 0, transparent 30%)',
        }}
        aria-hidden="true"
      />

      <div className="relative bg-bg-primary rounded-xl shadow-lg p-8 w-full max-w-[380px] animate-fade-in-up max-[400px]:p-6">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-[42px] h-[42px] rounded-md bg-green-800 text-white flex items-center justify-center text-[22px] flex-shrink-0">
            <i className="ti ti-leaf" aria-hidden="true" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold text-text-primary">HalamanHub</span>
            <span className="text-xs text-text-secondary">Smart Agriculture Admin</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Username" id="username">
            <Input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
            />
          </FormField>

          <FormField label="Password" id="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                className="pr-[38px]"
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-transparent border-none text-text-secondary cursor-pointer w-[30px] h-[30px] flex items-center justify-center text-base rounded-sm hover:bg-bg-secondary hover:text-text-primary"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
              </button>
            </div>
          </FormField>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-800 rounded-md px-3 py-2.5 text-sm leading-snug" role="alert">
              <i className="ti ti-alert-circle text-base flex-shrink-0 mt-px" aria-hidden="true" />
              {error}
            </div>
          )}

          <Button variant="primary" type="submit" disabled={loading} className="w-full justify-center py-2.5 text-md">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>

      <p className="relative mt-6 text-xs text-white/70 text-center">
        © 2026 HalamanHub · Smart Agriculture System for Mapili Plant Nursery
      </p>
    </div>
  );
};

export default LoginPage;
