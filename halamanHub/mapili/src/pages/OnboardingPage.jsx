import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, FormField, Input, Alert } from '../components/ui/UI';

// Shown only to a customer whose profileComplete is false — i.e. someone
// who just signed up via "Continue with Google" for the first time.
// Google gives us a name and email, but nothing else your app needs
// (notably a phone number, required for delivery). This page collects
// that missing piece before the user can reach anything else.
const OnboardingPage = () => {
  const { user, completeProfile } = useAuth();
  const navigate = useNavigate();


  // Auto-filled from the Google account (best-effort split on the first
  // space), but both stay fully editable — some people prefer a different
  // display name than what Google has, or the split guessed wrong.
const nameParts = (user?.name || '').trim().split(/\s+/);
  const [firstName, setFirstName] = useState(user?.firstName || nameParts[0] || '');
  const [lastName, setLastName] = useState(user?.lastName || nameParts.slice(1).join(' ') || '');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName || !lastName || !phone) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^09\d{9}$/.test(phone)) {
      setError('Phone number must look like 09171234567 — starts with 09, 11 digits total.');
      return;
    }

    setLoading(true);
    try {
      await completeProfile({ firstName, lastName, phone });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-lift border border-gray-100 p-8 sm:p-10">
          <h1 className="font-display text-2xl font-bold text-gray-800 mb-1 text-center">Almost there</h1>
          <p className="text-gray-500 text-sm mb-6 text-center">
            Just one more step — we need a phone number for delivery updates.
          </p>

          {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-5" />}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" id="firstName" required>
                <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" required />
              </FormField>
              <FormField label="Last name" id="lastName" required>
                <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" required />
              </FormField>
            </div>

            <FormField label="Phone number" id="phone" required>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[\s-]/g, ''))}
                placeholder="09171234567"
                maxLength={11}
                autoComplete="tel"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Format: 11 digits starting with 09, e.g. 09171234567.</p>
            </FormField>

            <Button variant="primary" type="submit" size="lg" disabled={loading} className="w-full mt-2">
              {loading ? 'Saving…' : 'Continue to Mapili'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;