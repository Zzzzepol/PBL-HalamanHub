import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { customerAuthApi } from '../api/client';
import { Alert, Spinner } from '../components/ui/UI';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its verification token.');
      return;
    }
    customerAuthApi.verifyEmail(token)
      .then((data) => {
        setStatus('success');
        setMessage(data.message || 'Email verified successfully.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'This verification link is invalid or has expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-lift border border-gray-100 p-8 text-center">
          {status === 'verifying' && (
            <>
              <div className="flex justify-center mb-4">
                <Spinner size="lg" />
              </div>
              <p className="text-gray-500 text-sm">Verifying your email…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="font-display text-2xl font-bold text-gray-800 mb-3">Email verified</h1>
              <Alert type="success" message={message} />
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="font-display text-2xl font-bold text-gray-800 mb-3">Verification failed</h1>
              <Alert type="error" message={message} />
            </>
          )}

          <p className="text-sm text-gray-500 mt-6">
            <Link to="/" className="text-brand-700 font-medium hover:text-brand-800">Go to Mapili</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage; 