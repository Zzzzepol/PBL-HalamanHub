import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { customerAuthApi } from '../api/client';
import { Button, FormField, Input, Alert } from '../components/ui/UI';
import AddressManager from '../components/AddressManager';

const PH_PHONE_REGEX = /^09\d{9}$/;

const AccountPage = () => {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name:  user?.name  || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [profileMsg, setProfileMsg] = useState(null);
  const [pwdMsg, setPwdMsg]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [savingPwd, setSavingPwd]   = useState(false);

  const f   = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const fp  = (k, v) => setPwdForm(prev => ({ ...prev, [k]: v }));

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg(null);

    if (form.phone && !PH_PHONE_REGEX.test(form.phone)) {
      setProfileMsg({ type: 'error', text: 'Phone number must look like 09171234567 — starts with 09, followed by 9 more digits, 11 digits total.' });
      return;
    }

    setSaving(true);
    try {
      const updated = await customerAuthApi.update({ name: form.name, phone: form.phone }, token);
      updateUser(updated.user);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    if (pwdForm.newPwd !== pwdForm.confirm) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (pwdForm.newPwd.length < 8) {
      setPwdMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setSavingPwd(true);
    try {
      await customerAuthApi.changePassword({ currentPassword: pwdForm.current, newPassword: pwdForm.newPwd }, token);
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwdForm({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-800">My account</h1>
            <p className="text-gray-500 mt-1">Manage your profile and security settings</p>
          </div>
          <Link to="/account/orders">
            <Button variant="outline" icon="ti-package" size="sm">My orders</Button>
          </Link>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-5">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-brand-700 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-lg">{user?.name}</h2>
              <p className="text-gray-500 text-sm">{user?.email}</p>
            </div>
          </div>

          {profileMsg && (
            <Alert type={profileMsg.type} message={profileMsg.text} onClose={() => setProfileMsg(null)} className="mb-5" />
          )}

          <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
            <FormField label="Full name" id="name" required>
              <Input id="name" value={form.name} onChange={e => f('name', e.target.value)} required />
            </FormField>
            <FormField label="Email address" id="email">
              <Input id="email" type="email" value={form.email} disabled className="bg-gray-50 text-gray-400 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
            </FormField>
           <FormField label="Phone number" id="phone">
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={e => f('phone', e.target.value.replace(/[\s-]/g, ''))}
                placeholder="09171234567"
                maxLength={11}
              />
              <p className="text-xs text-gray-400 mt-1">Format: 11 digits starting with 09, e.g. 09171234567.</p>
            </FormField>
            <Button variant="primary" type="submit" disabled={saving} className="self-start">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </div>

        {/* Saved addresses */}
        <AddressManager token={token} />

        {/* Password card */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-5">
          <h2 className="font-semibold text-gray-800 mb-1">Change password</h2>
          <p className="text-gray-500 text-sm mb-5">Use a strong password that you don't use elsewhere.</p>

          {pwdMsg && (
            <Alert type={pwdMsg.type} message={pwdMsg.text} onClose={() => setPwdMsg(null)} className="mb-5" />
          )}

          <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
            <FormField label="Current password" id="current-pwd" required>
              <Input id="current-pwd" type="password" value={pwdForm.current} onChange={e => fp('current', e.target.value)} placeholder="••••••••" required />
            </FormField>
            <FormField label="New password" id="new-pwd" required>
              <Input id="new-pwd" type="password" value={pwdForm.newPwd} onChange={e => fp('newPwd', e.target.value)} placeholder="At least 8 characters" required />
            </FormField>
            <FormField label="Confirm new password" id="confirm-pwd" required>
              <Input id="confirm-pwd" type="password" value={pwdForm.confirm} onChange={e => fp('confirm', e.target.value)} placeholder="Re-enter new password" required />
            </FormField>
            <Button variant="primary" type="submit" disabled={savingPwd} className="self-start">
              {savingPwd ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </div>

        {/* Sign out */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Sign out</h2>
          <p className="text-gray-500 text-sm mb-4">Sign out from your Mapili account on this device.</p>
          <Button variant="danger" icon="ti-logout" onClick={handleLogout}>Sign out</Button>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
