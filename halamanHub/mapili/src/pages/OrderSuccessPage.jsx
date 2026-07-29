import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopOrdersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Spinner, Badge, orderStatusBadge } from '../components/ui/UI';

const OrderSuccessPage = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!order) return;
    setDownloading(true);
    try {
      await shopOrdersApi.viewReceipt(order._id, token);
    } catch {
      // silently fail is fine here — button just stays clickable to retry
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!id || !token) { setLoading(false); return; }
    shopOrdersApi.getOne(id, token)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full text-center">
        {/* Success animation */}
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-fade-in">
          <i className="ti ti-circle-check text-5xl text-green-600" aria-hidden="true" />
        </div>

        <h1 className="font-display text-3xl font-bold text-gray-800 mb-2">Order placed!</h1>
        <p className="text-gray-500 mb-8">
          Thank you for your order. We've sent a confirmation email to <strong>{order?.customerEmail}</strong>.
          Your order is now being processed.
        </p>

        {order && (
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 text-left mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Order number</div>
                <div className="font-bold text-gray-800 text-lg">{order.orderNumber}</div>
              </div>
              <Badge variant={orderStatusBadge[order.status]?.variant || 'default'}>
                <i className={`ti ${orderStatusBadge[order.status]?.icon}`} />
                {orderStatusBadge[order.status]?.label || order.status}
              </Badge>
            </div>

            <div className="border-t border-gray-100 pt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Items</span><span>{order.product}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Fulfillment</span>
                <span className="capitalize">{order.fulfillmentType || 'delivery'}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 text-base mt-1">
                <span>Total paid</span><span>₱{order.amount?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Button variant="outline" icon="ti-download" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading…' : 'Download receipt'}
          </Button>
          <Link to="/account/orders">
            <Button variant="primary" icon="ti-package">Track your order</Button>
          </Link>
          <Link to="/shop">
            <Button variant="outline" icon="ti-shopping-bag">Continue shopping</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
