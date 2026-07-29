import React from 'react';

// Printable walk-in receipt — only visible when printing (see index.css print rules).
// `order` is the object returned from ordersApi.createPOSSale (has orderNumber, items, amount, etc.)
const WalkInReceipt = ({ order }) => {
  if (!order) return null;

  const date = order.createdAt ? new Date(order.createdAt) : new Date();

  return (
    <div id="walkin-receipt" className="hidden print:block font-mono text-black" style={{ width: '80mm', padding: '4mm' }}>
      <div className="text-center mb-2">
        <div className="text-sm font-bold">Mapili Plant Nursery</div>
        <div className="text-[10px]">Talisay, Batangas, Philippines</div>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      <div className="text-[10px]">
        <div>Receipt: {order.orderNumber}</div>
        <div>Date: {date.toLocaleString('en-PH')}</div>
        <div>Customer: {order.customer || 'Walk-in customer'}</div>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      <div className="text-[10px]">
        {order.items?.map((item, idx) => (
          <div key={idx} className="mb-1">
            <div className="flex justify-between">
              <span>{item.name}</span>
              <span>₱{(item.price * item.qty).toFixed(2)}</span>
            </div>
            <div className="text-[9px] text-gray-700">
              {item.qty} {item.unit} × ₱{item.price}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black my-1" />

      <div className="flex justify-between text-xs font-bold">
        <span>TOTAL</span>
        <span>₱{Number(order.amount).toFixed(2)}</span>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      <div className="text-center text-[10px] mt-2">
        Thank you for your purchase!
      </div>
    </div>
  );
};

export default WalkInReceipt;