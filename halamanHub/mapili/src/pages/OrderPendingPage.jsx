import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopOrdersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Spinner, Badge, orderStatusBadge } from '../components/ui/UI';

const OrderPendingPage = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Poll every 5 seconds to check if payment went through
  useEffect(() => {
    if (!id || !token) { setLoading(false); return; }

    const check = async () => {
      try {
        const data = await shopOrdersApi.getOne(id, token);
        setOrder(data);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    check();
    const interval = setInterval(check, 5000); // check every 5s
    return () => clearInterval(interval);
  }, [id, token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  const isPaid = order?.payment === 'paid';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full text-center">

        {isPaid ? (
          // Payment confirmed
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
        ) : (
          // Still waiting
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
                <span className={`font-medium ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                  {isPaid ? '✅ Paid' : '⏳ Pending'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isPaid ? (
            <Link to="/account/orders">
              <Button variant="primary" icon="ti-package">Track your order</Button>
            </Link>
          ) : (
            <Link to="/account/orders">
              <Button variant="outline" icon="ti-package">View my orders</Button>
            </Link>
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