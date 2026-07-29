import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardBody, Button, SearchBar, Input, Badge, EmptyState } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { productsApi, ordersApi, ApiError } from '../api/client';
import WalkInReceipt from '../components/WalkInReceipt';

const POSPage = () => {
  const { token } = useAuth();
  const { data: products, loading, error, refetch } = useApiData(productsApi.getAll, [], 10000);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // [{ productId, name, price, unit, qty, stock }]
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const list = useMemo(() => products || [], [products]);
  const filtered = useMemo(
    () => list.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())),
    [list, search]
  );

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.productId === product._id);
      if (existing) {
        if (existing.qty >= product.stock) return prev; // don't exceed known stock
        return prev.map(i => i.productId === product._id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId: product._id, name: product.name, price: product.price, unit: product.unit, qty: 1, stock: product.stock }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart(prev => prev
      .map(i => i.productId === productId ? { ...i, qty: Math.min(Math.max(i.qty + delta, 1), i.stock) } : i)
    );
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId));
  const clearSale = () => { setCart([]); setCustomer(''); setNote(''); setSaleError(''); setReceipt(null); };

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const completeSale = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    setSaleError('');
    try {
      const order = await ordersApi.createPOSSale({
        customer: customer || 'Walk-in customer',
        items: cart.map(i => ({ productId: i.productId, qty: i.qty })),
        note,
      }, token);
      setReceipt(order);
      setCart([]);
      setCustomer('');
      setNote('');
      refetch(); // reflect updated stock immediately
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSaleError('Some items no longer have enough stock. Please adjust the cart.');
      } else {
        setSaleError(err instanceof ApiError ? err.message : 'Failed to complete sale.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Product picker */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader title="Products" subtitle={loading ? 'Loading…' : `${filtered.length} available`} />
          <CardBody>
            <div className="mb-3">
              <SearchBar value={search} onChange={setSearch} placeholder="Search products…" />
            </div>
            {error && (
              <div className="mb-3 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
                Failed to load products. <button className="underline" onClick={refetch}>Retry</button>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {filtered.map(p => (
                <button
                  key={p._id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className={`text-left border-[0.5px] border-border rounded-lg p-3 hover:bg-bg-secondary transition-colors ${p.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-text-secondary">₱{p.price}/{p.unit}</div>
                  <Badge variant={p.status === 'out-of-stock' ? 'error' : p.status === 'low-stock' ? 'warning' : 'ok'} className="mt-1.5">
                    {p.stock} in stock
                  </Badge>
                </button>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="col-span-full text-center text-text-secondary py-6 text-sm">No products found.</div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Cart / checkout */}
      <div>
        <Card>
          <CardHeader title="Current sale" subtitle={cart.length > 0 ? `${cart.length} item${cart.length !== 1 ? 's' : ''}` : 'Cart is empty'} />
          <CardBody>
            {cart.length === 0 && !receipt && (
              <EmptyState icon="ti-cash-register" title="No items yet" description="Tap a product to add it to this sale." />
            )}

            {cart.length > 0 && (
              <>
                <div className="space-y-2 mb-4">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-xs text-text-secondary">₱{item.price} × {item.qty} = ₱{(item.price * item.qty).toFixed(2)}</div>
                      </div>
                      <button onClick={() => changeQty(item.productId, -1)} className="w-6 h-6 rounded border-[0.5px] border-border text-sm" aria-label="Decrease">−</button>
                      <span className="w-5 text-center text-sm">{item.qty}</span>
                      <button onClick={() => changeQty(item.productId, 1)} disabled={item.qty >= item.stock} className="w-6 h-6 rounded border-[0.5px] border-border text-sm disabled:opacity-40" aria-label="Increase">+</button>
                      <button onClick={() => removeFromCart(item.productId)} className="text-red-600 ml-1" aria-label={`Remove ${item.name}`}>
                        <i className="ti ti-x" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t-[0.5px] border-border pt-3 mb-3 flex justify-between font-medium">
                  <span>Total</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>

                <div className="mb-3">
                  <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name (optional)" />
                </div>
                <div className="mb-3">
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" />
                </div>

                {saleError && <div className="mb-3 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">{saleError}</div>}

                <Button variant="primary" className="w-full justify-center" icon="ti-cash-register" onClick={completeSale} disabled={processing}>
                  {processing ? 'Processing…' : `Complete sale — ₱${total.toFixed(2)}`}
                </Button>
                <Button variant="default" className="w-full justify-center mt-2" onClick={clearSale} disabled={processing}>
                  Clear sale
                </Button>
              </>
            )}

            {receipt && cart.length === 0 && (
              <div className="text-center py-4">
                <i className="ti ti-circle-check text-4xl text-green-700" aria-hidden="true" />
                <div className="text-lg font-medium mt-2">Sale complete</div>
                <div className="text-sm text-text-secondary">{receipt.orderNumber} · ₱{receipt.amount}</div>
                <Button variant="default" className="mt-4" icon="ti-printer" onClick={() => window.print()}>
                  Print receipt
                </Button>
                <Button variant="primary" className="mt-2" onClick={clearSale}>Start new sale</Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <WalkInReceipt order={receipt} />
    </div>
  );
};

export default POSPage;