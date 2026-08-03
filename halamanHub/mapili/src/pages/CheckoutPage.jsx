import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { shopOrdersApi, paymongoApi, addressesApi } from '../api/client';
import { Button, FormField, Input, Alert, StepIndicator } from '../components/ui/UI';

const DELIVERY_FEE = 0;
const PICKUP_FEE   = 0;

const FARM_ADDRESS = 'Brgy. Caloocan, 24, Talisay, 4220 Batangas';
const FARM_PHONE    = '0910 725 1811';
const FARM_MAP_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(FARM_ADDRESS)}&output=embed`;

const getMinPickupDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split('T')[0];
};

const CheckoutPage = () => {
  const { items, total, clearCart } = useCart();
  const { user, token }             = useAuth();
  const navigate                    = useNavigate();

  const [step, setStep]       = useState(0); // 0=details, 1=payment, 2=confirm
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [showCustomAddress, setShowCustomAddress] = useState(false);
  const [saveAddressPermanently, setSaveAddressPermanently] = useState(false);

  // Form state
  const [fulfillment, setFulfillment] = useState('delivery'); // delivery | pickup
  const [form, setForm] = useState({
    name:    user?.name  || '',
    email:   user?.email || '',
    phone:   user?.phone || '',
    address: '',
    city:    '',
    note:    '',
    pickupDate: '',
  });


  const [payMethod, setPayMethod] = useState('gcash'); // gcash | card | paymaya | bank_transfer

  const shippingFee = fulfillment === 'delivery' ? DELIVERY_FEE : PICKUP_FEE;
  const grandTotal  = total + shippingFee;

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!token || !user || fulfillment !== 'delivery') {
      setSavedAddresses([]);
      setSelectedSavedAddressId('');
      setShowCustomAddress(false);
      return;
    }

    addressesApi.getAll(token)
      .then((res) => {
        const addresses = res.addresses || [];
        setSavedAddresses(addresses);

        if (addresses.length === 0) {
          setSelectedSavedAddressId('');
          setShowCustomAddress(true);
          return;
        }

        const primary = addresses.find(addr => addr.isPrimary) || addresses[0];
        setSelectedSavedAddressId(primary._id);
        setShowCustomAddress(false);
        setForm(prev => ({ ...prev, address: primary.address, city: primary.city }));
      })
      .catch(() => {
        setSavedAddresses([]);
        setSelectedSavedAddressId('');
        setShowCustomAddress(true);
      });
  }, [token, user, fulfillment]);

  const canProceedStep0 = form.name && form.email && form.phone &&
    (fulfillment === 'pickup' ? form.pickupDate : (form.address && form.city));

  const handleSavedAddressSelect = (addressId) => {
    setSelectedSavedAddressId(addressId);

    if (!addressId) {
      setShowCustomAddress(true);
      setSaveAddressPermanently(false);
      setForm(prev => ({ ...prev, address: '', city: '' }));
      return;
    }

    const chosen = savedAddresses.find(addr => addr._id === addressId);
    if (chosen) {
      setShowCustomAddress(false);
      setForm(prev => ({ ...prev, address: chosen.address, city: chosen.city }));
      setSaveAddressPermanently(false);
    }
  };

  // Step 0 → 1
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (fulfillment === 'delivery' && showCustomAddress && form.address && form.city && token && saveAddressPermanently) {
      try {
        await addressesApi.add({ label: 'Delivery', address: form.address, city: form.city }, token);
      } catch (err) {
        setError(err.message || 'Unable to save the address permanently.');
        return;
      }
    }

    setStep(1);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cartItems = items.map(i => ({ productId: i._id, name: i.name, qty: i.qty }));
      const stockCheck = await shopOrdersApi.validateStock(cartItems, token);

      if (!stockCheck.valid) {
        const names = stockCheck.insufficient.map(
          i => `${i.name} (only ${i.available} left, ${i.requested} requested)`
        ).join(', ');
        setError(`Some items in your cart are no longer available: ${names}. Please update your cart and try again.`);
        setLoading(false);
        return;
      }

      // Build line items description
      const itemsDesc = items.map(i => `${i.name} x${i.qty}`).join(', ');

      // Create PayMongo Payment Link (sandbox)
      const paymentData = await paymongoApi.createLink({
        amount:      Math.round(grandTotal * 100), // centavos
        description: `Mapili Plant Nursery — ${itemsDesc}`,
        remarks:     `Order for ${form.name}`,
        payMethod,
      }, token);

      // Create the order in our DB (status: pending, waiting for webhook)
      const orderPayload = {
        customer:      form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        product:       itemsDesc,
        quantity:      items.reduce((s, i) => s + i.qty, 0),
        amount:        grandTotal,
        note:          [
          fulfillment === 'delivery' ? `Deliver to: ${form.address}, ${form.city}` : 'Farm pickup',
          form.note,
        ].filter(Boolean).join(' | '),
        payment:         'unpaid',
        fulfillmentType: fulfillment,
        pickupDate:      fulfillment === 'pickup' ? form.pickupDate : null,
        shippingFee,
        paymongoLinkId:  paymentData.linkId,
        paymongoCheckoutUrl: paymentData.checkoutUrl,
        items: items.map(i => ({ productId: i._id, name: i.name, price: i.price, qty: i.qty })),
      };

      const order = await shopOrdersApi.create(orderPayload, token);

      clearCart();

      // Redirect to PayMongo checkout
// Open PayMongo checkout in a new tab
    if (paymentData.checkoutUrl) {
      window.open(paymentData.checkoutUrl, '_blank');
      navigate(`/order-pending/${order._id}`);
    } else {
      navigate(`/order-success/${order._id}`);
    }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const payMethods = [
    { value: 'gcash',         label: 'GCash',          icon: 'ti-brand-google-pay', desc: 'Pay via GCash e-wallet' },
    { value: 'paymaya',       label: 'Maya',            icon: 'ti-credit-card',      desc: 'Pay via Maya e-wallet' },
    { value: 'card',          label: 'Credit / Debit card', icon: 'ti-credit-card',  desc: 'Visa, Mastercard, JCB' },
    { value: 'bank_transfer', label: 'Online banking',  icon: 'ti-building-bank',    desc: 'BPI, UnionBank, etc.' },
  ];

  if (items.length === 0) {
    navigate('/shop', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-gray-800 mb-2">Checkout</h1>
        <p className="text-gray-500 mb-8">Almost there — just a few more details</p>

        {/* Step indicator */}
        <div className="mb-10">
          <StepIndicator steps={['Delivery details', 'Payment', 'Confirm']} current={step} />
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2">

            {/* Step 0 — Details */}
            {step === 0 && (
              <form onSubmit={handleDetailsSubmit} className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-gray-800 text-lg">Contact &amp; delivery details</h2>

                {/* Fulfillment type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-3 block">How would you like to receive your order?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'delivery', label: 'Home delivery', icon: 'ti-truck-delivery', desc: 'Delivery available' },
                      { value: 'pickup',   label: 'Farm pickup',   icon: 'ti-building-store', desc: 'Free — pick up at our nursery' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFulfillment(opt.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all
                          ${fulfillment === opt.value ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}
                      >
                        <i className={`ti ${opt.icon} text-xl ${fulfillment === opt.value ? 'text-brand-700' : 'text-gray-400'} block mb-1`} />
                        <div className={`text-sm font-semibold ${fulfillment === opt.value ? 'text-brand-800' : 'text-gray-700'}`}>{opt.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField label="Full name" id="name" required>
                    <Input id="name" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Juan dela Cruz" required />
                  </FormField>
                  <FormField label="Email address" id="email" required>
                    <Input id="email" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="juan@email.com" required />
                  </FormField>
                </div>
                <FormField label="Phone number" id="phone" required>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={e => f('phone', e.target.value.replace(/[\s-]/g, ''))}
                    placeholder="09171234567"
                    maxLength={11}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Format: 11 digits starting with 09, e.g. 09171234567.</p>
                </FormField>

                {/* Address — only for delivery */}
                {fulfillment === 'delivery' && (
                  <>
                    {savedAddresses.length > 0 && (
                      <div className="space-y-2">
                        <label htmlFor="savedAddress" className="text-sm font-medium text-gray-700">Saved addresses</label>
                        <select
                          id="savedAddress"
                          value={selectedSavedAddressId}
                          onChange={(e) => handleSavedAddressSelect(e.target.value)}
                          className="input-base w-full"
                        >
                          <option value="">Use a new address</option>
                          {savedAddresses.map(addr => (
                            <option key={addr._id} value={addr._id}>
                              {addr.label} — {addr.address}, {addr.city}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(showCustomAddress || savedAddresses.length === 0) && (
                      <>
                        <FormField label="Delivery address" id="address" required>
                          <Input id="address" value={form.address} onChange={e => f('address', e.target.value)} placeholder="House/Unit No., Street, Barangay" required />
                        </FormField>
                        <FormField label="City / Municipality" id="city" required>
                          <Input id="city" value={form.city} onChange={e => f('city', e.target.value)} placeholder="e.g. Sta. Rosa, Laguna" required />
                        </FormField>

                        {user && token && (
                          <div className="rounded-xl bg-gray-50 p-3">
                            <div className="text-sm font-medium text-gray-700 mb-2">Save this address permanently?</div>
                            <div className="flex gap-4 flex-wrap">
                              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="radio"
                                  name="saveAddressPermanently"
                                  checked={saveAddressPermanently === true}
                                  onChange={() => setSaveAddressPermanently(true)}
                                />
                                Yes
                              </label>
                              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="radio"
                                  name="saveAddressPermanently"
                                  checked={saveAddressPermanently === false}
                                  onChange={() => setSaveAddressPermanently(false)}
                                />
                                No, use temporarily
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

            {fulfillment === 'pickup' && (
                  <>
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                      <iframe
                        title="Mapili Plant Nursery location"
                        src={FARM_MAP_EMBED_URL}
                        width="100%"
                        height="220"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>

                    <div className="p-4 bg-brand-50 rounded-xl text-sm text-brand-800 flex items-start gap-2">
                      <i className="ti ti-map-pin flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Mapili Plant Nursery</strong><br />
                        {FARM_ADDRESS}<br />
                        <i className="ti ti-phone text-xs" /> {FARM_PHONE}<br />
                        Available Mon–Sun, Opens from 7am–5pm.
                      </div>
                    </div>

                    <FormField label="Preferred pickup date" id="pickupDate" required>
                      <Input
                        id="pickupDate"
                        type="date"
                        min={getMinPickupDate()}
                        value={form.pickupDate}
                        onChange={e => f('pickupDate', e.target.value)}
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1.5">
                        Pickup dates start 3 days from today, so our team has time to prepare your order.
                      </p>
                    </FormField>
                  </>
                )}

                <FormField label="Order note (optional)" id="note">
                  <textarea
                    id="note"
                    value={form.note}
                    onChange={e => f('note', e.target.value)}
                    placeholder="Special instructions, preferred delivery time, etc."
                    rows={3}
                    className="input-base resize-none"
                  />
                </FormField>

                <Button variant="primary" type="submit" size="lg" icon="ti-arrow-right" disabled={!canProceedStep0} className="self-end">
                  Continue to payment
                </Button>
              </form>
            )}

            {/* Step 1 — Payment */}
            {step === 1 && (
              <form onSubmit={handlePaymentSubmit} className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 flex flex-col gap-5">
                <div className="flex items-center gap-3 mb-1">
                  <button type="button" onClick={() => setStep(0)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <i className="ti ti-arrow-left text-lg" />
                  </button>
                  <h2 className="font-semibold text-gray-800 text-lg">Choose payment method</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {payMethods.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPayMethod(m.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all
                        ${payMethod === m.value ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}
                    >
                      <i className={`ti ${m.icon} text-xl ${payMethod === m.value ? 'text-brand-700' : 'text-gray-400'} block mb-1.5`} />
                      <div className={`text-sm font-semibold ${payMethod === m.value ? 'text-brand-800' : 'text-gray-700'}`}>{m.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Order review */}
                <div className="bg-gray-50 rounded-xl p-4 mt-2">
                  <div className="text-sm font-medium text-gray-700 mb-3">Review your order</div>
                  {items.map(i => (
                    <div key={i._id} className="flex justify-between text-sm text-gray-600 mb-1.5">
                      <span>{i.name} ×{i.qty}</span>
                      <span>₱{(i.price * i.qty).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 mt-3 pt-3 flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span><span>₱{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-800 text-base mt-1">
                      <span>Total</span><span>₱{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <i className="ti ti-shield-check text-green-500 flex-shrink-0 mt-0.5" />
                  Your payment is secured and encrypted by PayMongo.
                </div>

                <Button variant="primary" type="submit" size="lg" icon="ti-lock" disabled={loading} className="w-full">
                  {loading ? 'Redirecting to payment…' : `Pay ₱${grandTotal.toFixed(2)} securely`}
                </Button>
              </form>
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5 sticky top-24">
              <h3 className="font-semibold text-gray-800 mb-4">Your items</h3>
              <div className="flex flex-col gap-3">
                {items.map(item => (
                  <div key={item._id} className="flex gap-3">
                    <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <i className="ti ti-plant text-brand-300 text-lg" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{item.name}</div>
                      <div className="text-xs text-gray-400">×{item.qty} — ₱{(item.price * item.qty).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-4 pt-4 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₱{total.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-gray-800 text-base mt-1">
                  <span>Total</span><span>₱{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
