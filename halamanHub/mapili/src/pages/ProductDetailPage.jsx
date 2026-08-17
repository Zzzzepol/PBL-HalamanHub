import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { productsApi } from '../api/client';
import { useCart } from '../context/CartContext';
import { Button, Spinner } from '../components/ui/UI';

const ProductDetailPage = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { addItem, items } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty]         = useState(1);
  const [added, setAdded]     = useState(false);

  useEffect(() => {
    productsApi.getOne(id)
      .then(setProduct)
      .catch(() => navigate('/shop', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const inCart = items.find(i => i._id === id);

const handleAdd = () => {
    if (!product || product.status === 'out-of-stock') return;
    const safeQty = qty === '' || qty < 1 ? 1 : qty;
    addItem(product, safeQty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  if (!product) return null;

  const statusColor = {
    'in-stock':     'text-green-700 bg-green-50',
    'low-stock':    'text-amber-700 bg-amber-50',
    'out-of-stock': 'text-red-700 bg-red-50',
  }[product.status];

  const statusLabel = {
    'in-stock':     'In stock',
    'low-stock':    `Low stock — only ${product.stock} left`,
    'out-of-stock': 'Out of stock',
  }[product.status];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/" className="hover:text-brand-700">Home</Link>
          <i className="ti ti-chevron-right text-xs" />
          <Link to="/shop" className="hover:text-brand-700">Shop</Link>
          <i className="ti ti-chevron-right text-xs" />
          <span className="text-gray-700">{product.name}</span>
        </nav>

        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Image */}
            <div className="aspect-square bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center relative">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <i className="ti ti-plant text-8xl text-brand-200" aria-hidden="true" />
              )}
            </div>

            {/* Details */}
            <div className="p-8 md:p-10 flex flex-col">
              <div className="text-sm font-medium text-brand-600 mb-1">{product.category}</div>
              <h1 className="font-display text-3xl font-bold text-gray-800 mb-3">{product.name}</h1>

              {/* Status */}
              <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full w-fit mb-6 ${statusColor}`}>
                <i className={`ti ${product.status === 'out-of-stock' ? 'ti-x' : 'ti-check'} text-xs`} />
                {statusLabel}
              </div>

              {/* Price */}
              <div className="mb-8">
                <span className="text-4xl font-bold text-brand-800">₱{product.price}</span>
                <span className="text-gray-400 ml-2">per {product.unit}</span>
              </div>

              {/* Quantity */}
              {product.status !== 'out-of-stock' && (
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <i className="ti ti-minus text-sm" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={qty}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') { setQty(''); return; }
                        const n = parseInt(val, 10);
                        if (!Number.isNaN(n)) setQty(Math.max(1, n));
                      }}
                      onBlur={() => { if (qty === '' || qty < 1) setQty(1); }}
                      className="text-lg font-semibold w-16 text-center border border-gray-200 rounded-xl py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-300"
                      aria-label="Quantity"
                    />
                    <button
                      onClick={() => setQty(q => q + 1)}
                      className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <i className="ti ti-plus text-sm" />
                    </button>
                    <span className="text-sm text-gray-400 ml-2">
                      Total: <strong className="text-gray-700">₱{(product.price * (qty || 0)).toFixed(2)}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-auto">
                <Button
                  variant="primary"
                  size="lg"
                  icon={added ? 'ti-check' : 'ti-shopping-cart'}
                  onClick={handleAdd}
                  disabled={product.status === 'out-of-stock'}
                  className="flex-1"
                >
                  {added ? 'Added!' : product.status === 'out-of-stock' ? 'Out of stock' : 'Add to cart'}
                </Button>
                {inCart && (
                  <Link to="/cart">
                    <Button variant="outline" size="lg">View cart</Button>
                  </Link>
                )}
              </div>

              {inCart && (
                <p className="text-sm text-brand-600 mt-3 flex items-center gap-1.5">
                  <i className="ti ti-circle-check" /> {inCart.qty} {inCart.qty === 1 ? 'item' : 'items'} in your cart
                </p>
              )}

              {/* Info */}
              <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                {[
                  { icon: 'ti-leaf',          label: 'Organically grown' },
                  { icon: 'ti-truck-delivery',label: 'Delivery available' },
                  { icon: 'ti-building-store',label: 'Farm pickup option' },
                  { icon: 'ti-refresh',       label: 'Easy reordering' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                    <i className={`ti ${item.icon} text-brand-500`} aria-hidden="true" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
