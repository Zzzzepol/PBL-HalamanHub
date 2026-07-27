import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Button, EmptyState } from '../components/ui/UI';
import { shopOrdersApi } from '../api/client';

const CartPage = () => {
  const { items, removeItem, updateQty, total, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [insufficient, setInsufficient] = useState({}); // productId -> { available, requested }

  const checkStock = async () => {
    if (items.length === 0) { setInsufficient({}); return; }
    try {
      const result = await shopOrdersApi.validateStock(
        items.map(i => ({ productId: i._id, name: i.name, qty: i.qty }))
      );
      const map = {};
      (result.insufficient || []).forEach(i => { map[i.productId] = i; });
      setInsufficient(map);
    } catch {
      // silent — worst case the warning just doesn't show until the next check,
      // checkout's own server-side validation still catches it regardless
    }
  };

  useEffect(() => {
    checkStock();
    const id = setInterval(checkStock, 15000); // catch changes while sitting on this page
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, items.map(i => `${i._id}:${i.qty}`).join(',')]);

  const hasBlockingIssue = Object.keys(insufficient).length > 0;

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
    } else {
      navigate('/checkout');
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <EmptyState
          icon="ti-shopping-cart"
          title="Your cart is empty"
          description="Add some fresh products to get started."
          action={<Link to="/shop"><Button variant="primary" icon="ti-shopping-bag">Browse products</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-gray-800 mb-8">Your cart</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {items.map(item => {
              const issue = insufficient[item._id];
              return (
                <div key={item._id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 flex gap-4">
                  {/* Image */}
                  <div className="w-20 h-20 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <i className="ti ti-plant text-3xl text-brand-300" aria-hidden="true" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-brand-600 font-medium">{item.category}</div>
                    <h3 className="font-semibold text-gray-800 truncate">{item.name}</h3>
                    <div className="text-sm text-gray-500">₱{item.price}/{item.unit}</div>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQty(item._id, item.qty - 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-sm"
                        aria-label="Decrease"
                      >
                        <i className="ti ti-minus text-xs" />
                      </button>
                      <span className="w-6 text-center font-medium text-sm">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item._id, item.qty + 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-sm"
                        aria-label="Increase"
                      >
                        <i className="ti ti-plus text-xs" />
                      </button>
                    </div>
                    {issue && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-md px-2 py-1 inline-flex items-center gap-1">
                        <i className="ti ti-alert-triangle" aria-hidden="true" />
                        Only {issue.available} left — reduce quantity to continue
                      </div>
                    )}
                  </div>
                  {/* Price + remove */}
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeItem(item._id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${item.name}`}
                    >
                      <i className="ti ti-trash text-base" />
                    </button>
                    <span className="font-bold text-gray-800">₱{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}

            <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700 self-start flex items-center gap-1.5 transition-colors mt-1">
              <i className="ti ti-trash" /> Clear cart
            </button>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6 sticky top-24">
              <h2 className="font-semibold text-gray-800 text-lg mb-5">Order summary</h2>
              <div className="flex flex-col gap-3 mb-5">
                {items.map(item => (
                  <div key={item._id} className="flex justify-between text-sm text-gray-600">
                    <span className="truncate mr-2">{item.name} ×{item.qty}</span>
                    <span className="flex-shrink-0">₱{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 flex justify-between font-bold text-gray-800 text-lg mb-6">
                <span>Subtotal</span>
                <span>₱{total.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400 mb-5 text-center">Delivery fee calculated at checkout</p>
              {hasBlockingIssue && (
                <div className="mb-3 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 text-center">
                  Update the quantities marked above before checking out.
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                icon="ti-arrow-right"
                onClick={handleCheckout}
                disabled={hasBlockingIssue}
              >
                {isAuthenticated ? 'Proceed to checkout' : 'Sign in to checkout'}
              </Button>
              <Link to="/shop" className="block text-center mt-3 text-sm text-brand-600 hover:text-brand-800">
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;