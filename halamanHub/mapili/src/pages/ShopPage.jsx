import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { productsApi } from '../api/client';
import { useCart } from '../context/CartContext';
import { Spinner, EmptyState } from '../components/ui/UI';

const stockBadge = (status) => {
  if (status === 'in-stock')  return <span className="badge-stock-in">In stock</span>;
  if (status === 'low-stock') return <span className="badge-stock-low">Low stock</span>;
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
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <Link to={`/shop/${product._id}`} className="product-card block bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden group">
      <div className="aspect-square bg-gradient-to-br from-brand-50 to-brand-100 relative">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="ti ti-plant text-5xl text-brand-300" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-3 left-3">{stockBadge(product.status)}</div>
      </div>
      <div className="p-4">
        <div className="text-xs text-brand-600 font-medium mb-0.5">{product.category}</div>
        <h3 className="font-semibold text-gray-800 group-hover:text-brand-700 transition-colors leading-snug">{product.name}</h3>
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-lg font-bold text-brand-800">₱{product.price}</span>
            <span className="text-xs text-gray-400 ml-1">/{product.unit}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={product.status === 'out-of-stock'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
              ${product.status === 'out-of-stock'
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : added ? 'bg-green-500 text-white scale-90' : 'bg-brand-700 text-white hover:bg-brand-800 active:scale-90'}`}
            aria-label={`Add ${product.name} to cart`}
          >
            <i className={`ti ${added ? 'ti-check' : 'ti-plus'} text-sm`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Link>
  );
};

const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [searchParams]          = useSearchParams();

  const catParam = searchParams.get('cat') || 'all';
  const [activeCategory, setActiveCategory] = useState(catParam);

  useEffect(() => {
    productsApi.getAll()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = ['all', ...new Set(products.map(p => p.category))];
    return cats;
  }, [products]);

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat    = activeCategory === 'all' || p.category === activeCategory;
    return matchSearch && matchCat;
  }), [products, search, activeCategory]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl font-bold text-gray-800 mb-1">Our products</h1>
          <p className="text-gray-500">Healthy plants, locally grown and harvested and delivered with care</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              className="input-base pl-11"
              aria-label="Search products"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize
                  ${activeCategory === cat ? 'bg-brand-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300 hover:text-brand-700'}`}
              >
                {cat === 'all' ? 'All products' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-gray-500 mb-5">
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}{search ? ` for "${search}"` : ''}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-24"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="ti-plant"
            title="No products found"
            description={search ? `No results for "${search}". Try a different search.` : 'No products in this category yet.'}
            action={<button onClick={() => { setSearch(''); setActiveCategory('all'); }} className="btn-outline text-sm px-6 py-2.5">Clear filters</button>}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopPage;
