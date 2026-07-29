import React, { useState, useEffect } from 'react';
import { addressesApi, ApiError } from '../api/client';
import { Button, FormField, Input, Alert, Badge } from './ui/UI';

const emptyForm = { label: 'Home', address: '', city: '' };

const AddressManager = ({ token }) => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [busyId, setBusyId]       = useState(null);

  const load = () => {
    setLoading(true);
    addressesApi.getAll(token)
      .then(res => setAddresses(res.addresses || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const startAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setMsg(null); };
  const startEdit = (addr) => {
    setForm({ label: addr.label, address: addr.address, city: addr.city });
    setEditingId(addr._id);
    setShowForm(true);
    setMsg(null);
  };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.address || !form.city) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = editingId
        ? await addressesApi.update(editingId, form, token)
        : await addressesApi.add(form, token);
      setAddresses(res.addresses);
      setMsg({ type: 'success', text: editingId ? 'Address updated.' : 'Address added.' });
      cancelForm();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof ApiError ? err.message : 'Failed to save address.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    setBusyId(id);
    try {
      const res = await addressesApi.remove(id, token);
      setAddresses(res.addresses);
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof ApiError ? err.message : 'Failed to delete address.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleSetPrimary = async (id) => {
    setBusyId(id);
    try {
      const res = await addressesApi.setPrimary(id, token);
      setAddresses(res.addresses);
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof ApiError ? err.message : 'Failed to set primary address.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-gray-800">Saved addresses</h2>
        {!showForm && (
          <Button variant="outline" size="sm" icon="ti-plus" onClick={startAdd}>Add address</Button>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-5">Manage your delivery addresses and choose your default.</p>

      {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}

      {loading && <p className="text-sm text-gray-400">Loading addresses…</p>}

      {!loading && addresses.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 mb-2">No saved addresses yet.</p>
      )}

      <div className="flex flex-col gap-3 mb-4">
        {addresses.map(addr => (
          <div key={addr._id} className="border border-gray-100 rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-800">{addr.label}</span>
                {addr.isPrimary && <Badge variant="success">Primary</Badge>}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{addr.address}, {addr.city}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {!addr.isPrimary && (
                <Button variant="outline" size="sm" onClick={() => handleSetPrimary(addr._id)} disabled={busyId === addr._id}>
                  Set primary
                </Button>
              )}
              <Button variant="outline" size="sm" icon="ti-pencil" onClick={() => startEdit(addr)} />
              <Button variant="danger" size="sm" icon="ti-trash" onClick={() => handleDelete(addr._id)} disabled={busyId === addr._id} />
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-4 flex flex-col gap-4">
          <FormField label="Label" id="addr-label">
            <Input id="addr-label" value={form.label} onChange={e => f('label', e.target.value)} placeholder="Home, Work, etc." />
          </FormField>
          <FormField label="Address" id="addr-address" required>
            <Input id="addr-address" value={form.address} onChange={e => f('address', e.target.value)} placeholder="House/Unit No., Street, Barangay" required />
          </FormField>
          <FormField label="City / Municipality" id="addr-city" required>
            <Input id="addr-city" value={form.city} onChange={e => f('city', e.target.value)} placeholder="e.g. Sta. Rosa, Laguna" required />
          </FormField>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add address'}
            </Button>
            <Button variant="outline" type="button" onClick={cancelForm}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AddressManager;