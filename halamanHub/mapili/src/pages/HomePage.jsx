import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../api/client';
import { useCart } from '../context/CartContext';
import { Button, EmptyState, ErrorState, Spinner } from '../components/ui/UI';

const stockBadge = (status) => {
  if (status === 'in-stock')    return <span className="badge-stock-in"><i className="ti ti-circle-check" aria-hidden="true" />In stock</span>;
  if (status === 'low-stock')   return <span className="badge-stock-low"><i className="ti ti-alert-triangle" aria-hidden="true" />Low stock</span>;
  return <span className="badge-stock-out"><i className="ti ti-circle-x" aria-hidden="true" />Out of stock</span>;
};

const ProductCard = ({ product }) => {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    if (product.status === 'out-of-stock') return;
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <article className="product-card bg-white rounded-2xl shadow-soft border border-gray-200 overflow-hidden group">
      <Link to={`/shop/${product._id}`} className="block">
      {/* Product image placeholder */}
      <div className="aspect-square bg-gradient-to-br from-brand-50 to-brand-100 relative overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <i className="ti ti-plant text-5xl text-brand-300" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-3 left-3">{stockBadge(product.status)}</div>
      </div>
      <div className="p-4 pb-1">
        <div className="text-xs text-brand-600 font-medium mb-0.5">{product.category}</div>
        <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-brand-700 transition-colors">{product.name}</h3>
      </div>
      </Link>
      <div className="flex items-center justify-between px-4 pb-4">
        <div>
          <span className="text-lg font-bold text-brand-800">₱{product.price}</span>
          <span className="text-xs text-gray-600 ml-1">/{product.unit}</span>
        </div>
        <button
            onClick={handleAdd}
            disabled={product.status === 'out-of-stock'}
            className={`min-h-11 min-w-11 rounded-xl flex items-center justify-center text-sm font-medium transition-all
              ${product.status === 'out-of-stock'
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : added
                  ? 'bg-green-500 text-white scale-90'
                  : 'bg-brand-700 text-white hover:bg-brand-800 active:scale-90'}`}
            aria-label={added ? `${product.name} added to cart` : `Add ${product.name} to cart`}
          >
            <i className={`ti ${added ? 'ti-check' : 'ti-plus'}`} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};

const features = [
  { icon: 'ti-leaf', title: 'Plants grown with care', desc: 'Choose healthy plants for your home, garden, or farm.' },
  { icon: 'ti-truck-delivery', title: 'Home delivery', desc: 'Choose delivery when you place your order.' },
  { icon: 'ti-building-store', title: 'Pick up at the nursery', desc: 'Choose a pickup date that works for you.' },
  { icon: 'ti-shield-check', title: 'Easy online payment', desc: 'Pay by QRPH using GCash, Maya, cards, or online banking.' },
];

const HomePage = () => {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadFeatured = useCallback(() => {
    setLoading(true);
    setError(false);
    productsApi.getAll()
      .then(data => setFeatured(data.filter(p => p.status !== 'out-of-stock').slice(0, 4)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadFeatured(); }, [loadFeatured]);

  return (
    <div>
      {/* Hero */}
      <section className="hero-gradient text-white py-24 md:py-36 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #4ade80 0, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0, transparent 40%)' }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6">
            Find plants for your home, garden, or farm
          </h1>
          <p className="text-brand-100 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Browse our plants, order online, then choose home delivery or pickup at our nursery.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/shop">
              <Button variant="white" size="lg" icon="ti-shopping-bag">Shop now</Button>
            </Link>
            <Link to="/about">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">About the nursery</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto mb-8 text-center"><h2 className="font-display text-3xl font-bold text-gray-900">How ordering works</h2><p className="mt-2 text-base text-gray-700">Pick your plants, choose delivery or nursery pickup, then pay online.</p></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl hover:bg-brand-50 transition-colors group">
                <div className="w-14 h-14 bg-brand-100 group-hover:bg-brand-200 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                  <i className={`ti ${f.icon} text-2xl text-brand-700`} aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5 text-base">{f.title}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-brand-600 text-sm font-medium mb-1">Fresh picks</div>
              <h2 className="font-display text-3xl font-bold text-gray-800">Featured products</h2>
            </div>
            <Link to="/shop" className="text-brand-700 text-sm font-medium hover:text-brand-800 flex items-center gap-1">
              View all <i className="ti ti-arrow-right" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : error ? (
            <ErrorState title="Plants are not loading right now" description="Please check your connection and try again." onRetry={loadFeatured} />
          ) : featured.length === 0 ? (
            <EmptyState icon="ti-plant" title="New plants are coming soon" description="Visit the shop to see everything currently available." action={<Link to="/shop"><Button>Browse the shop</Button></Link>} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {featured.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          )}
        </div>
      </section>

    </div>
  );
};

export default HomePage;
