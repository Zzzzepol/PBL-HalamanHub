import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { shopOrdersApi, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button, Spinner, Badge, orderStatusBadge } from '../components/ui/UI';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const OrderPendingPage = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const expireCheckedRef = useRef(false);
  const orderRef = useRef(null); // always holds the latest order, for use in cleanup/unload handlers

  // Poll every 5 seconds to check if payment went through
  useEffect(() => {
    if (!id || !token) { setLoading(false); return; }

    const check = async () => {
      try {
        const data = await shopOrdersApi.getOne(id, token);
        setOrder(data);
        orderRef.current = data;
        setLoading(false);

        // If still unpaid and past its payment window, ask the server
        // to mark it failed (PayMongo doesn't send a webhook for this case).
        const isExpired = data.payment === 'unpaid'
          && data.paymentExpiresAt
          && new Date() > new Date(data.paymentExpiresAt);

        if (isExpired && !expireCheckedRef.current) {
          expireCheckedRef.current = true;
          try {
            const updated = await shopOrdersApi.expire(id, token);
            setOrder(updated);
            orderRef.current = updated;
          } catch {
            expireCheckedRef.current = false;
          }
        }
      } catch {
        setLoading(false);
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [id, token]);

  // Detect the customer leaving before paying — refresh, tab close, or
  // navigating elsewhere in the app — and cancel the order immediately.
  useEffect(() => {
    if (!id || !token) return;

    const abandonUrl = `${API_BASE}/shop/orders/${id}/abandon`;

    // Fires on actual browser refresh / tab close. `keepalive: true` lets
    // the request finish even as the page unloads (unlike a normal fetch).
    const handleBeforeUnload = () => {
      if (orderRef.current?.payment === 'unpaid') {
        fetch(abandonUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Fires when the customer navigates to another page inside the app
      // (back button, clicking a link) without paying.
      if (orderRef.current?.payment === 'unpaid') {
        shopOrdersApi.abandon(id, token).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setCancelling(true);
    try {
      const updated = await shopOrdersApi.abandon(id, token);
      setOrder(updated);
      orderRef.current = updated;
    } catch {
      // ignore — order stays as-is, they can try again
    } finally {
      setCancelling(false);
    }
  };

  const handleReorder = async () => {
    setReordering(true);
    setReorderError('');
    try {
      const data = await shopOrdersApi.reorder(id, token);
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
      navigate('/checkout');
    } catch (err) {
      setReorderError(err instanceof ApiError ? err.message : 'Could not reorder. Please try again.');
      setReordering(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  const isPaid   = order?.payment === 'paid';
  const isFailed = order?.payment === 'failed';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full text-center">

        {isPaid ? (
          <>
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-fade-in">
              <i className="ti ti-circle-check text-5xl text-green-600" />
            </div>
            <h1 className="font-display text-3xl font-bold text-gray-800 mb-2">Payment confirmed!</h1>
            <p className="text-gray-500 mb-8">
              Your order <strong>{order?.orderNumber}</strong> has been paid and is now being processed.
              A confirmation email has been sent to <strong>{order?.customerEmail}</strong>.
            </p>
          </>
        ) : isFailed ? (
          <>
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ti ti-alert-circle text-5xl text-red-500" />
            </div>
            <h1 className="font-display text-3xl font-bold text-gray-800 mb-2">Payment failed</h1>
            <p className="text-gray-500 mb-4">
              We couldn't confirm payment for <strong>{order?.orderNumber}</strong> in time, so this order
              has been cancelled. No charges were made. You can reorder the same items below.
            </p>
            {reorderError && (
              <p className="text-sm text-red-600 mb-4">{reorderError}</p>
            )}
          </>
        ) : (
          <>
            <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ti ti-clock text-5xl text-amber-500" />
            </div>
            <h1 className="font-display text-3xl font-bold text-gray-800 mb-2">Waiting for payment</h1>
            <p className="text-gray-500 mb-4">
              Your order <strong>{order?.orderNumber}</strong> has been created.
              Complete your payment in the PayMongo tab that was opened.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600 mb-8">
              <Spinner size="sm" />
              Checking payment status automatically…
            </div>
          </>
        )}

        {order && (
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 text-left mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-gray-800">{order.orderNumber}</span>
              <Badge variant={orderStatusBadge[order.status]?.variant}>
                {orderStatusBadge[order.status]?.label}
              </Badge>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Items</span>
                <span className="text-gray-700">{order.product}</span>
              </div>
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-bold text-brand-800">₱{order.amount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className={`font-medium ${isPaid ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-amber-600'}`}>
                  {isPaid ? '✅ Paid' : isFailed ? '❌ Failed' : '⏳ Pending'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isFailed ? (
            <Button variant="primary" icon="ti-refresh" onClick={handleReorder} disabled={reordering}>
              {reordering ? 'Adding items…' : 'Reorder these items'}
            </Button>
          ) : isPaid ? (
            <Link to="/account/orders">
              <Button variant="primary" icon="ti-package">Track your order</Button>
            </Link>
          ) : (
            <>
              <Link to="/account/orders">
                <Button variant="outline" icon="ti-package">View my orders</Button>
              </Link>
              <Button variant="danger" icon="ti-x" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </Button>
            </>
          )}
          <Link to="/shop">
            <Button variant="outline" icon="ti-shopping-bag">Continue shopping</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderPendingPage;