import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { shopOrdersApi, ApiError } from '../api/client';
import { useCart } from '../context/CartContext';
import { Button, Badge, Spinner, EmptyState, orderStatusBadge, Alert } from '../components/ui/UI';

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric',
});
const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', {
  hour: 'numeric', minute: '2-digit',
});

const OrderCard = ({ order, onReorder, reordering }) => {
  const [expanded, setExpanded] = useState(false);
  const sb = orderStatusBadge[order.status] || orderStatusBadge.pending;

  const paymentColor = {
    unpaid:   'text-red-600',
    paid:     'text-green-600',
    refunded: 'text-gray-500',
  }[order.payment] || 'text-gray-500';

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800">{order.orderNumber}</span>
            <Badge variant={sb.variant}>
              <i className={`ti ${sb.icon}`} /> {sb.label}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(order.orderDate)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-brand-800 text-lg">₱{order.amount?.toFixed(2)}</div>
          <div className={`text-xs font-medium capitalize ${paymentColor}`}>
            {order.payment}
          </div>
        </div>
      </div>

      {/* Product summary */}
      <div className="px-5 pb-4">
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{order.product}</p>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex items-center gap-2 flex-wrap border-t border-gray-50 pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-brand-700 hover:text-brand-800 font-medium flex items-center gap-1 transition-colors"
        >
          <i className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-xs`} />
          {expanded ? 'Hide details' : 'View details'}
        </button>
        <div className="ml-auto flex gap-2">
          {['pending', 'confirmed', 'processing', 'ready'].includes(order.status) && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <i className="ti ti-clock" /> In progress
            </span>
          )}
          {order.status === 'completed' && (
            <Button
              variant="primary"
              size="sm"
              icon="ti-refresh"
              onClick={() => onReorder(order._id)}
              disabled={reordering === order._id}
            >
              {reordering === order._id ? 'Adding…' : 'Reorder'}
            </Button>
          )}
          {order.status === 'cancelled' && (
            <Link to="/shop">
              <Button variant="outline" size="sm" icon="ti-shopping-bag">Shop again</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5">
          {/* Status history */}
          {order.statusHistory?.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Order timeline</div>
              <div className="flex flex-col gap-3">
                {order.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${i === order.statusHistory.length - 1 ? 'bg-brand-600' : 'bg-gray-300'}`} />
                    <div>
                      <div className="text-sm font-medium text-gray-700 capitalize">{h.status}</div>
                      {h.note && <div className="text-xs text-gray-500">{h.note}</div>}
                      <div className="text-xs text-gray-400">{formatDate(h.changedAt)} at {formatTime(h.changedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order details */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {order.note && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Note</div>
                <div className="text-gray-600">{order.note}</div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Fulfillment</div>
              <div className="text-gray-600 capitalize flex items-center gap-1.5">
                <i className={`ti ${order.fulfillmentType === 'pickup' ? 'ti-building-store' : 'ti-truck-delivery'} text-brand-500`} />
                {order.fulfillmentType === 'pickup' ? 'Farm pickup' : 'Home delivery'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Payment</div>
              <div className={`capitalize font-medium ${paymentColor}`}>{order.payment}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Order date</div>
              <div className="text-gray-600">{formatDate(order.orderDate)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const STATUS_TABS = [
  { key: 'all',        label: 'All orders' },
  { key: 'active',     label: 'In progress' },
  { key: 'completed',  label: 'Completed'   },
  { key: 'cancelled',  label: 'Cancelled'   },
];

const OrdersPage = () => {
  const { token }                     = useAuth();
  const { addItem }                   = useCart();
  const navigate                      = useNavigate();
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('all');
  const [reordering, setReordering]   = useState(null);
  const [reorderMsg, setReorderMsg]   = useState(null);

  useEffect(() => {
    shopOrdersApi.getAll(token)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(() => {
    if (activeTab === 'all')       return orders;
    if (activeTab === 'active')    return orders.filter(o => ['pending','confirmed','processing','ready'].includes(o.status));
    if (activeTab === 'completed') return orders.filter(o => o.status === 'completed');
    if (activeTab === 'cancelled') return orders.filter(o => o.status === 'cancelled');
    return orders;
  }, [orders, activeTab]);

  const handleReorder = async (orderId) => {
    setReordering(orderId);
    setReorderMsg(null);
    try {
      const data = await shopOrdersApi.reorder(orderId, token);
      // Add items back to cart
      (data.items || []).forEach(item => {
        addItem({
          _id:      item.productId,
          name:     item.name,
          price:    item.price,
          unit:     item.unit || '',
          category: item.category || '',
          imageUrl: item.imageUrl || '',
          status:   'in-stock',
        }, item.qty);
      });
      setReorderMsg({ type: 'success', text: 'Items added to your cart!' });
      setTimeout(() => navigate('/cart'), 1200);
    } catch (err) {
      setReorderMsg({ type: 'error', text: err instanceof ApiError ? err.message : 'Reorder failed. Please try again.' });
    } finally {
      setReordering(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-800">My orders</h1>
            <p className="text-gray-500 mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
          </div>
          <Link to="/shop">
            <Button variant="primary" icon="ti-shopping-bag" size="sm">Shop now</Button>
          </Link>
        </div>

        {reorderMsg && (
          <Alert type={reorderMsg.type} message={reorderMsg.text} onClose={() => setReorderMsg(null)} className="mb-5" />
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-soft border border-gray-100 mb-6 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === tab.key ? 'bg-brand-700 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="ti-package"
            title={activeTab === 'all' ? 'No orders yet' : `No ${activeTab} orders`}
            description={activeTab === 'all' ? 'Your order history will appear here once you place your first order.' : `You have no ${activeTab} orders.`}
            action={
              <div className="flex gap-3">
                <Link to="/shop"><Button variant="primary" icon="ti-shopping-bag">Start shopping</Button></Link>
                {activeTab !== 'all' && <button onClick={() => setActiveTab('all')} className="btn-outline text-sm px-5 py-2.5">View all orders</button>}
              </div>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(order => (
              <OrderCard key={order._id} order={order} onReorder={handleReorder} reordering={reordering} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
