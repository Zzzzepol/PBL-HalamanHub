const SensorReading = require('../models/SensorReading');
const IrrigationLog = require('../models/IrrigationLog');
const ShopOrder = require('../models/ShopOrder');

function dateRange(from, to) {
  const start = from
    ? new Date(`${from}T00:00:00`)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const end = to
    ? new Date(`${to}T23:59:59.999`)
    : new Date();

  return { start, end };
}

function isoDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function buildMetadata(dataType, from, to, rowCount) {
  return {
    title: 'HalamanHub Farm Report',
    reportType: dataType,
    period: from && to ? `${from} to ${to}` : 'Last 30 days',
    generatedAt: new Date(),
    rowCount,
  };
}

function getCompletedSalesOrders(orders) {
  return orders.filter(
    (order) => order?.status === 'completed' && order?.payment === 'paid'
  );
}

function getOrderItems(order) {
  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items;
  }

  return [
    {
      name: order?.product || 'Single item',
      qty: Number(order?.quantity || 1),
      price: Number(order?.amount || 0),
    },
  ];
}

function buildSalesReport(orders, from, to) {
  const allOrders = orders || [];
  const completedOrders = getCompletedSalesOrders(allOrders);

  const totalRevenue = completedOrders.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  );

  const totalOrders = completedOrders.length;

  const averageOrderValue =
    totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const itemMap = new Map();

  completedOrders.forEach((order) => {
    const items = getOrderItems(order);

    items.forEach((item) => {
      const name = item?.name || 'Single item';
      const qty = Number(item?.qty || 0);
      const price = Number(item?.price || 0);

      if (!Number.isFinite(qty)) return;
      if (!Number.isFinite(price)) return;

      const existing = itemMap.get(name) || {
        name,
        quantity: 0,
        revenue: 0,
        orders: 0,
      };

      existing.quantity += qty;
      existing.revenue += qty * price;
      existing.orders += 1;

      itemMap.set(name, existing);
    });
  });

  const productSales = Array.from(itemMap.values())
    .sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.quantity - a.quantity
    )
    .map((item, index) => ({
      rank: index + 1,
      ...item,
      revenue: Number(item.revenue.toFixed(2)),
    }));

  const topProducts = productSales.slice(0, 5);

  const totalUnitsSold = productSales.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const dailyMap = new Map();

  completedOrders.forEach((order) => {
    const date = new Date(order.orderDate || order.createdAt);

    if (Number.isNaN(date.getTime())) return;

    const key = date.toISOString().slice(0, 10);

    const existing = dailyMap.get(key) || {
      date: key,
      revenue: 0,
      orders: 0,
      units: 0,
    };

    existing.revenue += Number(order.amount || 0);
    existing.orders += 1;

    getOrderItems(order).forEach((item) => {
      existing.units += Number(item?.qty || 0);
    });

    dailyMap.set(key, existing);
  });

  const dailySales = Array.from(dailyMap.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((entry) => ({
      ...entry,
      revenue: Number(entry.revenue.toFixed(2)),
    }));

  const paymentMap = new Map();

  allOrders.forEach((order) => {
    const payment = order?.payment || 'unknown';

    const existing = paymentMap.get(payment) || {
      payment,
      orders: 0,
      revenue: 0,
    };

    existing.orders += 1;

    if (order?.status === 'completed' && order?.payment === 'paid') {
      existing.revenue += Number(order.amount || 0);
    }

    paymentMap.set(payment, existing);
  });

  const paymentSummary = Array.from(paymentMap.values()).map((entry) => ({
    ...entry,
    revenue: Number(entry.revenue.toFixed(2)),
  }));

  const statusMap = new Map();

  allOrders.forEach((order) => {
    const status = order?.status || 'unknown';

    const existing = statusMap.get(status) || {
      status,
      orders: 0,
      revenue: 0,
    };

    existing.orders += 1;

    if (status === 'completed' && order?.payment === 'paid') {
      existing.revenue += Number(order.amount || 0);
    }

    statusMap.set(status, existing);
  });

  const statusSummary = Array.from(statusMap.values()).map((entry) => ({
    ...entry,
    revenue: Number(entry.revenue.toFixed(2)),
  }));

  const recentSales = completedOrders
    .slice()
    .sort(
      (a, b) =>
        new Date(b.orderDate || b.createdAt) -
        new Date(a.orderDate || a.createdAt)
    )
    .slice(0, 10)
    .map((order) => ({
      orderNumber: order.orderNumber,
      customer: order.customer,
      product: order.product,
      amount: Number(order.amount || 0),
      orderDate: isoDate(order.orderDate || order.createdAt),
    }));

  const dailyRevenueValues = dailySales.map((entry) => entry.revenue);
  const recentValues = dailyRevenueValues.slice(-7);

  const recentAverage = recentValues.length
    ? recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length
    : 0;

  const forecastRevenue = recentAverage * 7;

  return {
    metadata: {
      title: 'HalamanHub Sales Report',
      reportType: 'Sales Analytics Report',
      period: from && to ? `${from} to ${to}` : 'Last 30 days',
      generatedAt: new Date(),
      rowCount: completedOrders.length,
    },
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
      totalUnitsSold,
      uniqueProducts: productSales.length,
      forecastRevenue: Number(forecastRevenue.toFixed(2)),
    },
    topProducts,
    productSales,
    dailySales,
    paymentSummary,
    statusSummary,
    recentSales,
  };
}

async function buildReportData(dataType, from, to) {
  const { start, end } = dateRange(from, to);

  if (dataType === 'Orders & sales') {
    const orders = await ShopOrder.find({
      orderDate: {
        $gte: start,
        $lte: end,
      },
    }).sort({
      orderDate: 1,
    });

    const sales = buildSalesReport(orders, from, to);

    const columns = [
      'Rank',
      'Product',
      'Units Sold',
      'Orders',
      'Revenue (PHP)',
      'Revenue Share (%)',
    ];

    const rows = sales.productSales.map((item) => [
      item.rank,
      item.name,
      item.quantity,
      item.orders,
      item.revenue,
      sales.summary.totalRevenue > 0
        ? Number(((item.revenue / sales.summary.totalRevenue) * 100).toFixed(2))
        : 0,
    ]);

    return {
      columns,
      rows,
      metadata: sales.metadata,
      sales,
    };
  }

  if (dataType === 'Soil moisture only') {
    const rows = await SensorReading.find({
      recordedAt: {
        $gte: start,
        $lte: end,
      },
    }).sort({
      recordedAt: 1,
    });

    const dataRows = rows.map((r) => [
      isoDate(r.recordedAt),
      r.soilMoisture,
    ]);

    return {
      columns: ['Date/Time', 'Soil moisture (%)'],
      rows: dataRows,
      metadata: buildMetadata(dataType, from, to, dataRows.length),
    };
  }

  if (dataType === 'pH & EC trends') {
    const rows = await SensorReading.find({
      recordedAt: {
        $gte: start,
        $lte: end,
      },
    }).sort({
      recordedAt: 1,
    });

    const dataRows = rows.map((r) => [
      isoDate(r.recordedAt),
      r.ph,
      r.ec,
    ]);

    return {
      columns: ['Date/Time', 'pH', 'EC (uS/cm)'],
      rows: dataRows,
      metadata: buildMetadata(dataType, from, to, dataRows.length),
    };
  }

  if (dataType === 'NPK nutrient levels') {
    const rows = await SensorReading.find({
      recordedAt: {
        $gte: start,
        $lte: end,
      },
    }).sort({
      recordedAt: 1,
    });

    const dataRows = rows.map((r) => [
      isoDate(r.recordedAt),
      r.nitrogen,
      r.phosphorus,
      r.potassium,
    ]);

    return {
      columns: [
        'Date/Time',
        'Nitrogen (mg/kg)',
        'Phosphorus (mg/kg)',
        'Potassium (mg/kg)',
      ],
      rows: dataRows,
      metadata: buildMetadata(dataType, from, to, dataRows.length),
    };
  }

  if (dataType === 'Irrigation history') {
    const rows = await IrrigationLog.find({
      occurredAt: {
        $gte: start,
        $lte: end,
      },
    }).sort({
      occurredAt: 1,
    });

    const dataRows = rows.map((r) => [
      isoDate(r.occurredAt),
      r.source,
      r.action,
      r.reason,
      r.moistureAtEvent,
    ]);

    return {
      columns: [
        'Date/Time',
        'Source',
        'Action',
        'Reason',
        'Moisture at event (%)',
      ],
      rows: dataRows,
      metadata: buildMetadata(dataType, from, to, dataRows.length),
    };
  }

  if (dataType === 'Rainwater harvesting') {
    const rows = await SensorReading.find({
      recordedAt: {
        $gte: start,
        $lte: end,
      },
    }).sort({
      recordedAt: 1,
    });

    const dataRows = rows.map((r) => [
      isoDate(r.recordedAt),
      r.distanceCm,
      r.levelPercent,
      r.waterAvailable ? 'Yes' : 'No',
    ]);

    return {
      columns: [
        'Date/Time',
        'Distance (cm)',
        'Fill level (%)',
        'Water available',
      ],
      rows: dataRows,
      metadata: buildMetadata(dataType, from, to, dataRows.length),
    };
  }

  const rows = await SensorReading.find({
    recordedAt: {
      $gte: start,
      $lte: end,
    },
  }).sort({
    recordedAt: 1,
  });

  const dataRows = rows.map((r) => [
    isoDate(r.recordedAt),
    r.soilMoisture,
    r.soilTemp,
    r.ec,
    r.ph,
    r.nitrogen,
    r.phosphorus,
    r.potassium,
    r.airTemp,
    r.airHumidity,
    r.levelPercent,
    r.pumpActive ? 'ON' : 'OFF',
    r.solenoidActive ? 'ON' : 'OFF',
  ]);

  return {
    columns: [
      'Date/Time',
      'Soil moisture (%)',
      'Soil temp (°C)',
      'EC (uS/cm)',
      'pH',
      'N',
      'P',
      'K',
      'Air temp (°C)',
      'Humidity (%)',
      'Tank fill (%)',
      'Pump',
      'Solenoid',
    ],
    rows: dataRows,
    metadata: buildMetadata('All sensor data', from, to, dataRows.length),
  };
}

module.exports = {
  buildReportData,
  buildSalesReport,
};