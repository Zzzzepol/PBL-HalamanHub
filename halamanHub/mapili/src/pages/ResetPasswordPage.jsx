import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { customerAuthApi } from '../api/client';
import { Button, FormField, Input, Alert } from '../components/ui/UI';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirm) {
      setError('Please fill in both fields.');
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await customerAuthApi.resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
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
          <h1 className="font-display text-2xl font-bold text-gray-800 mb-1">Reset password</h1>

          {!token ? (
            <>
              <p className="text-gray-500 text-sm mb-2">
                This link is missing its reset token — it may have been copied incorrectly.
              </p>
              <p className="text-center text-sm text-gray-500 mt-6">
                <Link to="/forgot-password" className="text-brand-700 font-medium hover:text-brand-800">Request a new link</Link>
              </p>
            </>
          ) : done ? (
            <Alert type="success" message="Password reset successfully. Redirecting you to login…" />
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-6">Choose a new password for your account.</p>

              {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-5" />}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FormField label="New password" id="new-password" required>
                  <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required />
                </FormField>
                <FormField label="Confirm new password" id="confirm-password" required>
                  <Input id="confirm-password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" required />
                </FormField>
                <Button variant="primary" type="submit" size="lg" disabled={loading} className="w-full">
                  {loading ? 'Resetting…' : 'Reset password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;