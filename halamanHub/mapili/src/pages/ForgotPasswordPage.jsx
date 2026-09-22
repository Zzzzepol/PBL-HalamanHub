import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { customerAuthApi } from '../api/client';
import { Button, FormField, Input, Alert } from '../components/ui/UI';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      // Backend always returns the same generic message whether or not
      // the account exists — intentional, so this page can't be used to
      // probe which emails are registered.
      await customerAuthApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-lift border border-gray-100 p-8">
          <h1 className="font-display text-2xl font-bold text-gray-800 mb-1">Forgot password</h1>
          <p className="text-gray-500 text-sm mb-6">
            {sent
              ? "We've sent a reset link if that email is registered — check your inbox."
              : "Enter your email and we'll send you a link to reset your password."}
          </p>

          {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-5" />}

          {!sent ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormField label="Email address" id="email" required>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" autoComplete="email" required />
              </FormField>
              <Button variant="primary" type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          ) : (
            <Alert type="success" message="Check your email — the link expires in 30 minutes." />
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link to="/login" className="text-brand-700 font-medium hover:text-brand-800">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;