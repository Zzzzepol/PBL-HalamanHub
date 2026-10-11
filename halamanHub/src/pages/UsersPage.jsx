import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, Button, SearchBar, Select, Avatar, FormField, Input, ConfirmDialog, ErrorState, EmptyState } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { usersApi } from '../api/client';
import * as ps from './pageStyles';
import { timeAgo } from '../utils/timeAgo';

const roleBadge = {
  admin: { variant: 'blue',   label: 'Admin' },
  staff: { variant: 'purple', label: 'Staff' },
};

const sectionBlock = 'mt-3.5 pt-3.5 border-t border-border';
const emptyForm = { name: '', email: '', password: '', role: 'staff' };

const UsersPage = () => {
  const { token, user: currentUser } = useAuth();
  const { data: users, loading, error, refetch, setData: setUsers } = useApiData(usersApi.getAll, [], 20000);

const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [modalUser, setModalUser]   = useState(null);
  const [resetInfo, setResetInfo]   = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [saveError, setSaveError]   = useState('');
  const [saving, setSaving]         = useState(false);

  // "Change my own password" form — only used when the modal is open on your own account
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError]     = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const list = useMemo(() => users || [], [users]);

  const filtered = useMemo(() => list.filter(u => {
    const matchSearch = `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'All roles' || roleBadge[u.role]?.label === roleFilter;
    return matchSearch && matchRole;
  }), [list, search, roleFilter]);

const openEdit = (u) => {
    setModalUser(u);
    setResetInfo(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
    setPwSuccess('');
  };

  const changeRole = async (newRole) => {
    try {
      const updated = await usersApi.setRole(modalUser._id, newRole, token);
      setUsers(list.map(u => u._id === modalUser._id ? updated : u));
      setModalUser(updated);
    } catch {
      alert('We could not change this user’s role. Please try again.');
    }
  };

  const toggleStatus = async () => {
    const newStatus = modalUser.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await usersApi.setStatus(modalUser._id, newStatus, token);
      setUsers(list.map(u => u._id === modalUser._id ? updated : u));
      setModalUser(updated);
    } catch {
      alert('We could not update this account. Please try again.');
    }
  };

  const sendReset = async () => {
    try {
      const result = await usersApi.resetPassword(modalUser._id, token);
      setResetInfo(result);
    } catch {
      alert('We could not create a temporary password. Please try again.');
    }
  };

 const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }

    setChangingPw(true);
    try {
      const result = await usersApi.changePassword(currentPassword, newPassword, token);
      setPwSuccess(result.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwError('We could not change your password. Check the current password and try again.');
    } finally {
      setChangingPw(false);
    }
  };

  const deleteUser = async () => {
    if (!confirmDeleteUser) return;
    try {
      await usersApi.delete(confirmDeleteUser._id, token);
      setUsers(list.filter(x => x._id !== confirmDeleteUser._id));
      setModalUser(null);
      setConfirmDeleteUser(null);
    } catch {
      alert('We could not delete this account. Please try again.');
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
    } catch {
      setSaveError('We could not create this account. Check the details and try again.');
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

      {error && <div className="mb-4"><ErrorState title="User accounts are not loading" description="Check your connection, then try again." onRetry={refetch} /></div>}

      {/* Table */}
      <Card className={ps.lastCard}>
        <CardHeader
          title="System users"
          subtitle={loading ? 'Loading…' : `${filtered.length} of ${list.length} accounts`}
        />
        <div className="hidden xl:block"><Table headers={['User', 'Email', 'Role', 'Last active', 'Status', 'Actions']}>
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
                <td>{timeAgo(u.lastActiveAt)}</td>
                <td><Badge variant={u.status === 'active' ? 'ok' : 'default'}><i className={`ti ${u.status === 'active' ? 'ti-circle-check' : 'ti-pause'}`} aria-hidden="true" />{u.status === 'active' ? 'Active' : 'Not active'}</Badge></td>
                <td>
                  <div className={ps.actionBtns}>
                    <Button size="sm" icon="ti-edit" onClick={() => openEdit(u)}>Manage</Button>
                    {!isSelf && (
                      <Button size="sm" icon="ti-trash" onClick={() => setConfirmDeleteUser(u)} aria-label={`Delete ${u.name}`} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={6} className="text-center text-text-secondary py-6">No users found.</td></tr>
          )}
        </Table></div>
        <div className="grid gap-3 p-3 xl:hidden">
          {filtered.map(u => {
            const rb = roleBadge[u.role] || roleBadge.staff;
            const isSelf = currentUser?.id === u._id || currentUser?.username === u.username;
            return <article key={u._id} className="rounded-xl border border-border p-4">
              <div className="flex items-start gap-3"><Avatar initials={u.initials} color={u.color} size={40} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-text-primary">{u.name}{isSelf ? ' (you)' : ''}</h3><p className="break-all text-sm text-text-secondary">{u.email}</p></div><Badge variant={u.status === 'active' ? 'ok' : 'default'}><i className={`ti ${u.status === 'active' ? 'ti-circle-check' : 'ti-pause'}`} aria-hidden="true" />{u.status === 'active' ? 'Active' : 'Not active'}</Badge></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Badge variant={rb.variant}>{rb.label}</Badge><span className="text-sm text-text-secondary">Last active {timeAgo(u.lastActiveAt)}</span></div>
              <div className="mt-3 flex gap-2"><Button variant="default" icon="ti-edit" onClick={() => openEdit(u)}>Manage account</Button>{!isSelf && <Button variant="danger" icon="ti-trash" onClick={() => setConfirmDeleteUser(u)}>Delete</Button>}</div>
            </article>;
          })}
          {!loading && filtered.length === 0 && <EmptyState icon="ti-users" title="No users found" description="Try another name or email." />}
        </div>
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
                    <i className={`ti ${modalUser.status === 'active' ? 'ti-circle-check' : 'ti-pause'}`} aria-hidden="true" />{modalUser.status === 'active' ? 'Active' : 'Not active'}
                  </Badge>
                  <Button size="sm" onClick={toggleStatus}>
                    {modalUser.status === 'active' ? 'Pause account' : 'Reactivate account'}
                  </Button>
                </div>
              </div>

{/* Password — self-service change on your own account, reset-for-others everywhere else */}
              <div className={sectionBlock}>
                <div className={`${ps.toggleRowTitle} mb-2`}>Password</div>
                {(currentUser?.id === modalUser._id || currentUser?.username === modalUser.username) ? (
                  <form onSubmit={changePassword}>
                    <div className="flex flex-col gap-2.5">
                      <FormField label="Current password" id="mu-current-password">
                        <Input
                          id="mu-current-password"
                          type="password"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          required
                        />
                      </FormField>
                      <FormField label="New password" id="mu-new-password">
                        <Input
                          id="mu-new-password"
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                          required
                        />
                      </FormField>
                      <FormField label="Confirm new password" id="mu-confirm-password">
                        <Input
                          id="mu-confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </FormField>
                    </div>

                    {pwError && (
                      <div className="mt-2 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">{pwError}</div>
                    )}

                    <div className="mt-2.5">
                      <Button size="sm" variant="primary" type="submit" icon="ti-key" disabled={changingPw}>
                        {changingPw ? 'Updating…' : 'Update my password'}
                      </Button>
                      {pwSuccess && (
                        <span className="ml-2 text-sm text-green-800">
                          <i className="ti ti-check" /> {pwSuccess}
                        </span>
                      )}
                    </div>
                  </form>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* Activity */}
              <div className={sectionBlock}>
                <div className={`${ps.toggleRowTitle} mb-1`}>Activity</div>
                <div className="text-sm text-text-secondary">Last active: {timeAgo(modalUser.lastActiveAt)}</div>
                <div className="text-sm text-text-secondary">Account ID: {modalUser._id}</div>
              </div>
            </div>
            <div className={ps.modalFooter}>
              {currentUser?.id !== modalUser._id && currentUser?.username !== modalUser.username && (
                <Button variant="danger" icon="ti-trash" onClick={() => setConfirmDeleteUser(modalUser)}>Delete account</Button>
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
      <ConfirmDialog open={Boolean(confirmDeleteUser)} title={`Delete ${confirmDeleteUser?.name || 'this account'}?`} message="This permanently removes the account and cannot be undone." confirmLabel="Delete account" onConfirm={deleteUser} onCancel={() => setConfirmDeleteUser(null)} />
    </div>
  );
};

export default UsersPage;
