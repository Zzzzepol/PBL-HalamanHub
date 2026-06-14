import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, StatCard, SearchBar, Select, Button, FormField, Input } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { ordersApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

// Status flow + labels
const STATUS_FLOW = {
  pending:    { label: 'Pending',    variant: 'warning', next: 'confirmed',  nextLabel: 'Confirm order',   icon: 'ti-clock' },
  confirmed:  { label: 'Confirmed',  variant: 'blue',    next: 'processing', nextLabel: 'Start processing', icon: 'ti-circle-check' },
  processing: { label: 'Processing', variant: 'purple',  next: 'ready',      nextLabel: 'Mark as ready',   icon: 'ti-loader' },
  ready:      { label: 'Ready',      variant: 'amber',   next: 'completed',  nextLabel: 'Complete order',  icon: 'ti-package' },
  completed:  { label: 'Completed',  variant: 'ok',      next: null,         nextLabel: null,              icon: 'ti-check' },
  cancelled:  { label: 'Cancelled',  variant: 'error',   next: null,         nextLabel: null,              icon: 'ti-x' },
};

const PAYMENT_BADGE = {
  unpaid:   { variant: 'error',   label: 'Unpaid' },
  paid:     { variant: 'ok',      label: 'Paid' },
  refunded: { variant: 'default', label: 'Refunded' },
};

const PAGE_SIZE = 6;
const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const emptyForm = { customer: '', customerEmail: '', customerPhone: '', product: '', quantity: 1, amount: '', note: '', payment: 'unpaid' };

const OrdersPage = () => {
  const { token } = useAuth();
  const { data: orders, loading, error, refetch, setData: setOrders } = useApiData(ordersApi.getAll);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage]               = useState(1);
  const [detailOrder, setDetailOrder] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [saveError, setSaveError]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [actionNote, setActionNote]   = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const list = useMemo(() => orders || [], [orders]);

  const counts = useMemo(() => ({
    pending:    list.filter(o => o.status === 'pending').length,
    confirmed:  list.filter(o => o.status === 'confirmed').length,
    processing: list.filter(o => o.status === 'processing').length,
    ready:      list.filter(o => o.status === 'ready').length,
    completed:  list.filter(o => o.status === 'completed').length,
    cancelled:  list.filter(o => o.status === 'cancelled').length,
  }), [list]);

  const filtered = useMemo(() => list.filter(o => {
    const matchSearch = `${o.orderNumber} ${o.customer} ${o.product}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  }), [list, search, statusFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Advance order status
  const advanceStatus = async (order, nextStatus) => {
    setActionLoading(true);
    try {
      const updated = await ordersApi.updateStatus(order._id, nextStatus, actionNote, token);
      setOrders(list.map(o => o._id === updated._id ? updated : o));
      if (detailOrder?._id === updated._id) setDetailOrder(updated);
      setActionNote('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel order
  const cancelOrder = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return;
    setActionLoading(true);
    try {
      const updated = await ordersApi.updateStatus(order._id, 'cancelled', 'Cancelled by admin', token);
      setOrders(list.map(o => o._id === updated._id ? updated : o));
      if (detailOrder?._id === updated._id) setDetailOrder(updated);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to cancel order.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle payment
  const togglePayment = async (order) => {
    const next = order.payment === 'unpaid' ? 'paid' : order.payment === 'paid' ? 'refunded' : 'unpaid';
    try {
      const updated = await ordersApi.updatePayment(order._id, next, token);
      setOrders(list.map(o => o._id === updated._id ? updated : o));
      if (detailOrder?._id === updated._id) setDetailOrder(updated);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update payment.');
    }
  };

  // Delete cancelled order
  const deleteOrder = async (order) => {
    if (!window.confirm(`Permanently delete order ${order.orderNumber}?`)) return;
    try {
      await ordersApi.delete(order._id, token);
      setOrders(list.filter(o => o._id !== order._id));
      setDetailOrder(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete order.');
    }
  };

  // Create order
  const createOrder = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const created = await ordersApi.create({ ...form, amount: Number(form.amount), quantity: Number(form.quantity) }, token);
      setOrders([created, ...list]);
      setAddModalOpen(false);
      setForm(emptyForm);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to create order.');
    } finally {
      setSaving(false);
    }
  };

  const statusFilters = ['All', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'];

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard icon="ti-clock"         iconVariant="amber"  value={counts.pending}    label="Pending" />
        <StatCard icon="ti-circle-check"  iconVariant="blue"   value={counts.confirmed}  label="Confirmed" />
        <StatCard icon="ti-loader"        iconVariant="teal"   value={counts.processing} label="Processing" />
        <StatCard icon="ti-package"       iconVariant="amber"  value={counts.ready}      label="Ready" />
        <StatCard icon="ti-check"         iconVariant="green"  value={counts.completed}  label="Completed" />
        <StatCard icon="ti-x"             iconVariant="red"    value={counts.cancelled}  label="Cancelled" />
      </div>

      {error && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load orders. <button className="underline" onClick={refetch}>Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className={ps.filterBar}>
        <div className={ps.filterSearch}>
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by order ID, customer, or product…" />
        </div>
        <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          {statusFilters.map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All statuses' : STATUS_FLOW[s]?.label || s}</option>
          ))}
        </Select>
        <Button variant="primary" icon="ti-plus" onClick={() => { setForm(emptyForm); setSaveError(''); setAddModalOpen(true); }}>
          New order
        </Button>
      </div>

      {/* Table */}
      <Card className={ps.lastCard}>
        <CardHeader title="All orders" subtitle={loading ? 'Loading…' : `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`} />
        <Table headers={['Order ID', 'Customer', 'Product', 'Amount', 'Status', 'Payment', 'Date', 'Actions']}>
          {paged.map(o => {
            const st = STATUS_FLOW[o.status];
            const pm = PAYMENT_BADGE[o.payment];
            return (
              <tr key={o._id}>
                <td><button className="text-green-800 font-medium hover:underline" onClick={() => setDetailOrder(o)}>{o.orderNumber}</button></td>
                <td>{o.customer}</td>
                <td className="max-w-[180px] truncate">{o.product}</td>
                <td>₱{o.amount}</td>
                <td><Badge variant={st?.variant}>{st?.label}</Badge></td>
                <td><Badge variant={pm?.variant}>{pm?.label}</Badge></td>
                <td>{formatDate(o.orderDate)}</td>
                <td>
                  <div className={ps.actionBtns}>
                    <Button size="sm" icon="ti-eye" onClick={() => setDetailOrder(o)} aria-label="View" />
                    {st?.next && (
                      <Button size="sm" variant="primary" icon="ti-arrow-right" onClick={() => advanceStatus(o, st.next)} disabled={actionLoading}>
                        {st.nextLabel}
                      </Button>
                    )}
                    {!['completed', 'cancelled'].includes(o.status) && (
                      <Button size="sm" variant="danger" icon="ti-x" onClick={() => cancelOrder(o)} disabled={actionLoading} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {!loading && paged.length === 0 && (
            <tr><td colSpan={8} className="text-center text-text-secondary py-6">No orders match your filters.</td></tr>
          )}
        </Table>

        {/* Pagination */}
        <div className={ps.pagination}>
          <span className={ps.pageInfo}>
            Showing {paged.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{(currentPage - 1) * PAGE_SIZE + paged.length} of {filtered.length}
          </span>
          <div className={ps.pageBtns}>
            <button className={ps.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="Previous">
              <i className="ti ti-chevron-left" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} className={`${ps.pageBtn} ${n === currentPage ? ps.pageBtnActive : ''}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className={ps.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} aria-label="Next">
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
      </Card>

      {/* Order detail modal */}
      {detailOrder && (
        <div className={ps.modalOverlay} onClick={() => setDetailOrder(null)}>
          <div className={`${ps.modal} max-w-[560px]`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={ps.modalHeader}>
              <div>
                <span className={ps.modalTitle}>{detailOrder.orderNumber}</span>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={STATUS_FLOW[detailOrder.status]?.variant}>{STATUS_FLOW[detailOrder.status]?.label}</Badge>
                  <Badge variant={PAYMENT_BADGE[detailOrder.payment]?.variant}>{PAYMENT_BADGE[detailOrder.payment]?.label}</Badge>
                </div>
              </div>
              <button className={ps.modalClose} onClick={() => setDetailOrder(null)}><i className="ti ti-x" /></button>
            </div>
            <div className={ps.modalBody}>
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-xs text-text-secondary mb-0.5">Customer</div>
                  <div className="text-base font-medium">{detailOrder.customer}</div>
                  {detailOrder.customerEmail && <div className="text-sm text-text-secondary">{detailOrder.customerEmail}</div>}
                  {detailOrder.customerPhone && <div className="text-sm text-text-secondary">{detailOrder.customerPhone}</div>}
                </div>
                <div>
                  <div className="text-xs text-text-secondary mb-0.5">Order date</div>
                  <div className="text-base">{formatDate(detailOrder.orderDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary mb-0.5">Product</div>
                  <div className="text-base">{detailOrder.product}</div>
                  <div className="text-sm text-text-secondary">Qty: {detailOrder.quantity}</div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary mb-0.5">Amount</div>
                  <div className="text-xl font-medium text-green-800">₱{detailOrder.amount}</div>
                </div>
              </div>
              {detailOrder.note && (
                <div className="mb-4 p-3 bg-bg-secondary rounded-md text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">Note: </span>{detailOrder.note}
                </div>
              )}

              {/* Status actions */}
              {!['completed', 'cancelled'].includes(detailOrder.status) && (
                <div className="mb-4 p-3 border-[0.5px] border-border rounded-md">
                  <div className="text-sm font-medium mb-2">Order actions</div>
                  <FormField label="Note (optional)" id="action-note">
                    <Input id="action-note" value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="Add a note for this status change…" />
                  </FormField>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {STATUS_FLOW[detailOrder.status]?.next && (
                      <Button variant="primary" icon="ti-arrow-right" onClick={() => advanceStatus(detailOrder, STATUS_FLOW[detailOrder.status].next)} disabled={actionLoading}>
                        {STATUS_FLOW[detailOrder.status].nextLabel}
                      </Button>
                    )}
                    <Button variant="danger" icon="ti-x" onClick={() => cancelOrder(detailOrder)} disabled={actionLoading}>
                      Cancel order
                    </Button>
                    <Button icon="ti-credit-card" onClick={() => togglePayment(detailOrder)} disabled={actionLoading}>
                      {detailOrder.payment === 'unpaid' ? 'Mark as paid' : detailOrder.payment === 'paid' ? 'Mark as refunded' : 'Mark as unpaid'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Completed — payment toggle only */}
              {detailOrder.status === 'completed' && detailOrder.payment !== 'paid' && (
                <div className="mb-4">
                  <Button icon="ti-credit-card" onClick={() => togglePayment(detailOrder)}>
                    {detailOrder.payment === 'unpaid' ? 'Mark as paid' : 'Mark as refunded'}
                  </Button>
                </div>
              )}

              {/* Status history */}
              <div>
                <div className="text-sm font-medium mb-2">Status history</div>
                <div className="space-y-2">
                  {(detailOrder.statusHistory || []).map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium capitalize">{h.status}</span>
                        {h.note && <span className="text-text-secondary"> — {h.note}</span>}
                        <div className="text-xs text-text-tertiary">{formatDate(h.changedAt)} {formatTime(h.changedAt)} · {h.changedBy}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={ps.modalFooter}>
              {detailOrder.status === 'cancelled' && (
                <Button variant="danger" icon="ti-trash" onClick={() => deleteOrder(detailOrder)}>Delete order</Button>
              )}
              <Button variant="default" onClick={() => setDetailOrder(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Create order modal */}
      {addModalOpen && (
        <div className={ps.modalOverlay} onClick={() => setAddModalOpen(false)}>
          <div className={ps.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={ps.modalHeader}>
              <span className={ps.modalTitle}>New order</span>
              <button className={ps.modalClose} onClick={() => setAddModalOpen(false)}><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={createOrder}>
              <div className={ps.modalBody}>
                <div className={ps.grid.formRow}>
                  <FormField label="Customer name" id="o-customer">
                    <Input id="o-customer" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="Full name" required />
                  </FormField>
                  <FormField label="Customer email" id="o-email">
                    <Input id="o-email" type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} placeholder="email@example.com" />
                  </FormField>
                </div>
                <div className={ps.grid.formRow}>
                  <FormField label="Customer phone" id="o-phone">
                    <Input id="o-phone" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="+63 9XX XXX XXXX" />
                  </FormField>
                  <FormField label="Payment status" id="o-payment">
                    <Select id="o-payment" value={form.payment} onChange={e => setForm({ ...form, payment: e.target.value })}>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </Select>
                  </FormField>
                </div>
                <div className="mb-3">
                  <FormField label="Product" id="o-product">
                    <Input id="o-product" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="e.g. Organic Tomatoes (2 kg)" required />
                  </FormField>
                </div>
                <div className={ps.grid.formRow}>
                  <FormField label="Quantity" id="o-qty">
                    <Input id="o-qty" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                  </FormField>
                  <FormField label="Amount (₱)" id="o-amount">
                    <Input id="o-amount" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required />
                  </FormField>
                </div>
                <FormField label="Note" id="o-note">
                  <Input id="o-note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Delivery instructions or special requests…" />
                </FormField>
                {saveError && <div className="mt-3 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">{saveError}</div>}
              </div>
              <div className={ps.modalFooter}>
                <Button variant="default" type="button" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create order'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
