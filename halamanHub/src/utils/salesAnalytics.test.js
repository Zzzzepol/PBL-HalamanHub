import { buildSalesAnalytics } from './salesAnalytics';

describe('buildSalesAnalytics', () => {
  it('summarizes sales data into revenue, averages, and top products', () => {
    const orders = [
      {
        _id: '1',
        status: 'completed',
        payment: 'paid',
        amount: 120,
        orderDate: '2024-01-05T10:00:00.000Z',
        items: [
          { name: 'Rose', qty: 2, price: 50 },
          { name: 'Sunflower', qty: 1, price: 20 },
        ],
      },
      {
        _id: '2',
        status: 'completed',
        payment: 'paid',
        amount: 80,
        orderDate: '2024-01-06T10:00:00.000Z',
        items: [
          { name: 'Rose', qty: 1, price: 50 },
          { name: 'Fern', qty: 2, price: 15 },
        ],
      },
      {
        _id: '3',
        status: 'pending',
        payment: 'unpaid',
        amount: 40,
        orderDate: '2024-01-07T10:00:00.000Z',
        product: 'Cactus',
        quantity: 1,
      },
    ];

    const analytics = buildSalesAnalytics(orders, 7);

    expect(analytics.totalRevenue).toBe(200);
    expect(analytics.totalOrders).toBe(2);
    expect(analytics.averageOrderValue).toBe(100);
    expect(analytics.topItems[0]).toMatchObject({ name: 'Rose', quantity: 3, revenue: 150 });
    expect(analytics.revenueTrend.some((entry) => entry.revenue === 120)).toBe(true);
    expect(analytics.forecastRevenue).toBeGreaterThan(0);
  });
});
