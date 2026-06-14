import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, Button, SearchBar, Select, Avatar, FormField, Input } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { usersApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const roleBadge = {
  admin: { variant: 'blue',   label: 'Admin' },
  staff: { variant: 'purple', label: 'Staff' },
};

const sectionBlock = 'mt-3.5 pt-3.5 border-t-[0.5px] border-border';
const emptyForm = { name: '', email: '', password: '', role: 'staff' };

const formatDate = (iso) => {
  if (!iso) return '—';
  const diffH = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (diffH < 1)  return 'Just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return 'Yesterday';
  return `${Math.floor(diffH / 24)} days ago`;
};

const UsersPage = () => {
  const { token, user: currentUser } = useAuth();
  const { data: users, loading, error, refetch, setData: setUsers } = useApiData(usersApi.getAll);

  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [modalUser, setModalUser]   = useState(null);
  const [resetInfo, setResetInfo]   = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [saveError, setSaveError]   = useState('');
  const [saving, setSaving]         = useState(false);

  const list = useMemo(() => users || [], [users]);

  const filtered = useMemo(() => list.filter(u => {
    const matchSearch = `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'All roles' || roleBadge[u.role]?.label === roleFilter;
    return matchSearch && matchRole;
  }), [list, search, roleFilter]);

  const openEdit = (u) => { setModalUser(u); setResetInfo(null); };

  const changeRole = async (newRole) => {
    try {
      const updated = await usersApi.setRole(modalUser._id, newRole, token);
      setUsers(list.map(u => u._id === modalUser._id ? updated : u));
      setModalUser(updated);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update role.');
    }
  };

  const toggleStatus = async () => {
    const newStatus = modalUser.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await usersApi.setStatus(modalUser._id, newStatus, token);
      setUsers(list.map(u => u._id === modalUser._id ? updated : u));
      setModalUser(updated);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update status.');
    }
  };

  const sendReset = async () => {
    try {
      const result = await usersApi.resetPassword(modalUser._id, token);
      setResetInfo(result);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to reset password.');
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Permanently delete ${u.name}'s account? This cannot be undone.`)) return;
    try {
      await usersApi.delete(u._id, token);
      setUsers(list.filter(x => x._id !== u._id));
      setModalUser(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete user.');
    }
  };

  const openAdd = () => { setForm(emptyForm); setSaveError(''); setAddModalOpen(true); };

  const saveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const created = await usersApi.create(form, token);
      setUsers([...list, created]);
      setAddModalOpen(false);
      setForm(emptyForm);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Filters + Add */}
      <div className={ps.filterBar}>
        <div className={ps.filterSearch}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />
        </div>
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          {['All roles', 'Admin', 'Staff'].map(r => <option key={r}>{r}</option>)}
        </Select>
        <Button variant="primary" icon="ti-user-plus" onClick={openAdd}>Add user</Button>
      </div>

      {error && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load users. <button className="underline" onClick={refetch}>Retry</button>
        </div>
      )}

      {/* Table */}
      <Card className={ps.lastCard}>
        <CardHeader
          title="System users"
          subtitle={loading ? 'Loading…' : `${filtered.length} of ${list.length} accounts`}
        />
        <Table headers={['User', 'Email', 'Role', 'Last active', 'Status', 'Actions']}>
          {filtered.map(u => {
            const rb = roleBadge[u.role] || roleBadge.staff;
            const isSelf = currentUser?.id === u._id || currentUser?.username === u.username;
            return (
              <tr key={u._id}>
                <td>
                  <div className={ps.cellWithAvatar}>
                    <Avatar initials={u.initials} color={u.color} size={28} />
                    <span>{u.name}{isSelf && <span className="ml-1.5 text-xs text-text-tertiary">(you)</span>}</span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td><Badge variant={rb.variant}>{rb.label}</Badge></td>
                <td>{formatDate(u.lastActiveAt)}</td>
                <td><Badge variant={u.status === 'active' ? 'ok' : 'default'}>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                <td>
                  <div className={ps.actionBtns}>
                    <Button size="sm" icon="ti-edit" onClick={() => openEdit(u)}>Manage</Button>
                    {!isSelf && (
                      <Button size="sm" icon="ti-trash" onClick={() => deleteUser(u)} aria-label="Delete user" />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={6} className="text-center text-text-secondary py-6">No users found.</td></tr>
          )}
        </Table>
      </Card>

      {/* Manage user modal */}
      {modalUser && (
        <div className={ps.modalOverlay} onClick={() => setModalUser(null)}>
          <div className={ps.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
            <div className={ps.modalHeader}>
              <span className={ps.modalTitle} id="user-modal-title">Manage user</span>
              <button className={ps.modalClose} onClick={() => setModalUser(null)} aria-label="Close"><i className="ti ti-x" /></button>
            </div>
            <div className={ps.modalBody}>
              {/* User info */}
              <div className="flex items-center gap-3 mb-[18px]">
                <Avatar initials={modalUser.initials} color={modalUser.color} size={48} />
                <div>
                  <div className="font-medium text-md">{modalUser.name}</div>
                  <div className="text-sm text-text-secondary">{modalUser.email}</div>
                </div>
              </div>

              {/* Role */}
              <FormField label="Assign role" id="role-select">
                <Select id="role-select" value={modalUser.role} onChange={e => changeRole(e.target.value)}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormField>

              {/* Status */}
              <div className={sectionBlock}>
                <div className={`${ps.toggleRowTitle} mb-2`}>Account status</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <Badge variant={modalUser.status === 'active' ? 'ok' : 'default'}>
                    {modalUser.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button size="sm" onClick={toggleStatus}>
                    {modalUser.status === 'active' ? 'Deactivate account' : 'Activate account'}
                  </Button>
                </div>
              </div>

              {/* Password reset */}
              <div className={sectionBlock}>
                <div className={`${ps.toggleRowTitle} mb-2`}>Password</div>
                <Button size="sm" icon="ti-key" onClick={sendReset}>Generate temporary password</Button>
                {resetInfo && (
                  <div className="mt-2 flex flex-col gap-1">
                    <span className="text-sm text-green-800"><i className="ti ti-check" /> {resetInfo.message}</span>
                    <span className="font-mono bg-bg-secondary text-text-primary px-2 py-1 rounded-sm text-sm inline-block w-fit tracking-wider">
                      {resetInfo.tempPassword}
                    </span>
                    <span className="text-xs text-text-secondary">Share this with the user and ask them to change it immediately.</span>
                  </div>
                )}
              </div>

              {/* Activity */}
              <div className={sectionBlock}>
                <div className={`${ps.toggleRowTitle} mb-1`}>Activity</div>
                <div className="text-sm text-text-secondary">Last active: {formatDate(modalUser.lastActiveAt)}</div>
                <div className="text-sm text-text-secondary">Account ID: {modalUser._id}</div>
              </div>
            </div>
            <div className={ps.modalFooter}>
              {currentUser?.id !== modalUser._id && currentUser?.username !== modalUser.username && (
                <Button variant="danger" icon="ti-trash" onClick={() => deleteUser(modalUser)}>Delete account</Button>
              )}
              <Button variant="default" onClick={() => setModalUser(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add user modal */}
      {addModalOpen && (
        <div className={ps.modalOverlay} onClick={() => setAddModalOpen(false)}>
          <div className={ps.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="add-user-title">
            <div className={ps.modalHeader}>
              <span className={ps.modalTitle} id="add-user-title">Add user</span>
              <button className={ps.modalClose} onClick={() => setAddModalOpen(false)} aria-label="Close"><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={saveUser}>
              <div className={ps.modalBody}>
                <div className={ps.grid.formRow}>
                  <FormField label="Full name" id="u-name">
                    <Input id="u-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" required />
                  </FormField>
                  <FormField label="Role" id="u-role">
                    <Select id="u-role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </FormField>
                </div>
                <div className="mb-3">
                  <FormField label="Email" id="u-email">
                    <Input id="u-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" required />
                  </FormField>
                </div>
                <FormField label="Temporary password" id="u-password">
                  <Input id="u-password" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required />
                </FormField>
                <p className="text-xs text-text-secondary mt-1.5">
                  The user can log in with this password and should change it on first login.
                </p>
                {saveError && (
                  <div className="mt-3 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">{saveError}</div>
                )}
              </div>
              <div className={ps.modalFooter}>
                <Button variant="default" type="button" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Add user'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
