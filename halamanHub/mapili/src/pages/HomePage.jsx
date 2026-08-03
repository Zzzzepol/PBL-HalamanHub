import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../api/client';
import { useCart } from '../context/CartContext';
import { Button, Badge, Spinner } from '../components/ui/UI';

const stockBadge = (status) => {
  if (status === 'in-stock')    return <span className="badge-stock-in">In stock</span>;
  if (status === 'low-stock')   return <span className="badge-stock-low">Low stock</span>;
  return <span className="badge-stock-out">Out of stock</span>;
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
    <Link to={`/shop/${product._id}`} className="product-card block bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden group">
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
      <div className="p-4">
        <div className="text-xs text-brand-600 font-medium mb-0.5">{product.category}</div>
        <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-brand-700 transition-colors">{product.name}</h3>
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-lg font-bold text-brand-800">₱{product.price}</span>
            <span className="text-xs text-gray-400 ml-1">/{product.unit}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={product.status === 'out-of-stock'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-medium transition-all
              ${product.status === 'out-of-stock'
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : added
                  ? 'bg-green-500 text-white scale-90'
                  : 'bg-brand-700 text-white hover:bg-brand-800 active:scale-90'}`}
            aria-label={`Add ${product.name} to cart`}
          >
            <i className={`ti ${added ? 'ti-check' : 'ti-plus'}`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Link>
  );
};

const features = [
  { icon: 'ti-leaf',          title: 'Healthy plants',        desc: 'Carefully grown and nurtured for a beautiful, thriving garden.' },
  { icon: 'ti-truck-delivery',title: 'Delivery',              desc: 'Delivery service available within our service area.' },
  { icon: 'ti-building-store',title: 'Nursery pickup',        desc: 'Pick up directly from our nursery and explore our latest selections.' },
  { icon: 'ti-shield-check',  title: 'Secure payments',       desc: 'Pay securely via GCash, Maya, cards, or online banking.' },
];

const HomePage = () => {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productsApi.getAll()
      .then(data => setFeatured(data.filter(p => p.status !== 'out-of-stock').slice(0, 4)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="hero-gradient text-white py-24 md:py-36 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #4ade80 0, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0, transparent 40%)' }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6">
            Plants for your home garden<br />
            <span className="text-brand-300">and farm </span>
          </h1>
          <p className="text-brand-100 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Mapili Plant Nursery offers healthy plants, greenery, and gardening essentials grown with care.
            Order online for delivery or nursery pickup.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/shop">
              <Button variant="white" size="lg" icon="ti-shopping-bag">Shop now</Button>
            </Link>
            <Link to="/about">
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl hover:bg-brand-50 transition-colors group">
                <div className="w-14 h-14 bg-brand-100 group-hover:bg-brand-200 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                  <i className={`ti ${f.icon} text-2xl text-brand-700`} aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1.5 text-sm">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
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
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {featured.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-100 rounded-full mb-6">
            <i className="ti ti-truck-delivery text-3xl text-brand-700" aria-hidden="true" />
          </div>
          <h2 className="font-display text-3xl font-bold text-gray-800 mb-4">Ready to order?</h2>
          <p className="text-gray-500 mb-8 text-lg">Create a free account and get plants delivered or pick up directly from our nursery.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/register"><Button variant="primary" size="lg" icon="ti-user-plus">Create free account</Button></Link>
            <Link to="/shop"><Button variant="outline" size="lg" icon="ti-shopping-bag">Browse products</Button></Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
