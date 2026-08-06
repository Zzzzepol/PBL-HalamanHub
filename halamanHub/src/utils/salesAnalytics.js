export const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeDate = (dateValue) => {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayKey = (date) => date.toISOString().slice(0, 10);

export const buildSalesAnalytics = (orders = [], lookbackDays = 7) => {
  const completedOrders = (orders || []).filter((order) => order?.status === 'completed' && order?.payment === 'paid');
  const totalRevenue = completedOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const totalOrders = completedOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const itemMap = new Map();
  completedOrders.forEach((order) => {
    const items = Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [{ name: order.product || 'Single item', qty: Number(order.quantity || 1), price: Number(order.amount || 0) }];

    items.forEach((item) => {
      const name = item?.name || 'Single item';
      const qty = Number(item?.qty || 0);
      const price = Number(item?.price || 0);
      const entry = itemMap.get(name) || { name, quantity: 0, revenue: 0 };
      entry.quantity += qty;
      entry.revenue += qty * price;
      itemMap.set(name, entry);
    });
  });

  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 5)
    .map((item) => ({ ...item, revenue: Number(item.revenue || 0) }));

  const latestOrderDate = completedOrders.reduce((latest, order) => {
    const date = normalizeDate(order.orderDate || order.createdAt);
    if (!date) return latest;
    return latest && latest > date ? latest : date;
  }, null);

  const referenceDate = latestOrderDate || new Date();
  const revenueTrend = [];
  for (let index = lookbackDays - 1; index >= 0; index -= 1) {
    const target = new Date(referenceDate);
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() - index);
    const key = dayKey(target);
    const dayRevenue = completedOrders.reduce((sum, order) => {
      const date = normalizeDate(order.orderDate || order.createdAt);
      if (!date) return sum;
      return dayKey(date) === key ? sum + Number(order.amount || 0) : sum;
    }, 0);

    revenueTrend.push({ label: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: dayRevenue });
  }

  const monthlyAverage = revenueTrend.length > 0 ? revenueTrend.reduce((sum, item) => sum + item.revenue, 0) / revenueTrend.length : 0;
  const forecastRevenue = Number((monthlyAverage * 1.15).toFixed(2));

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    topItems,
    revenueTrend,
    forecastRevenue,
    completedOrders,
  };
};
