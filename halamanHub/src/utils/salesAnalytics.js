export const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDate = (dateValue) => {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const mean = (values) => (values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0);

const median = (values) => {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const winsorize = (values, lowerPercentile = 0.1, upperPercentile = 0.9) => {
  if (values.length < 5) return [...values];

  const sorted = [...values].sort((a, b) => a - b);
  const lowerIndex = Math.floor((sorted.length - 1) * lowerPercentile);
  const upperIndex = Math.floor((sorted.length - 1) * upperPercentile);

  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];

  return values.map((value) => clamp(value, lower, upper));
};

const weightedMovingAverage = (values) => {
  if (!values.length) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  values.forEach((value, index) => {
    const weight = index + 1;
    weightedSum += value * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

const linearRegression = (values) => {
  const n = values.length;

  if (n < 2) {
    return { slope: 0, intercept: values[0] || 0 };
  }

  const xMean = (n - 1) / 2;
  const yMean = mean(values);

  let numerator = 0;
  let denominator = 0;

  values.forEach((value, index) => {
    const x = index;
    numerator += (x - xMean) * (value - yMean);
    denominator += (x - xMean) ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  return { slope, intercept };
};

const regressionPrediction = (regression, x) =>
  Math.max(0, regression.intercept + regression.slope * x);

const buildDailySeries = (completedOrders, referenceDate) => {
  if (!completedOrders.length) return [];

  const dates = completedOrders
    .map((order) => normalizeDate(order.orderDate || order.createdAt))
    .filter(Boolean)
    .map(startOfDay)
    .sort((a, b) => a - b);

  if (!dates.length) return [];

  const firstDate = dates[0];
  const lastDate = referenceDate || dates[dates.length - 1];

  const revenueByDay = new Map();

  completedOrders.forEach((order) => {
    const date = normalizeDate(order.orderDate || order.createdAt);
    if (!date) return;

    const key = dateKey(date);
    const amount = Number(order.amount || 0);

    revenueByDay.set(
      key,
      (revenueByDay.get(key) || 0) + (Number.isFinite(amount) ? amount : 0)
    );
  });

  const result = [];
  let cursor = startOfDay(firstDate);
  const end = startOfDay(lastDate);

  while (cursor <= end) {
    const key = dateKey(cursor);

    result.push({
      date: new Date(cursor),
      key,
      revenue: revenueByDay.get(key) || 0,
      dayOfWeek: cursor.getDay(),
    });

    cursor = addDays(cursor, 1);
  }

  return result;
};

const calculateDayOfWeekFactors = (dailySeries) => {
  const overallAverage = mean(dailySeries.map((entry) => entry.revenue));

  if (overallAverage <= 0 || dailySeries.length < 14) {
    return Array(7).fill(1);
  }

  const factors = Array(7).fill(1);

  for (let day = 0; day < 7; day += 1) {
    const values = dailySeries
      .filter((entry) => entry.dayOfWeek === day)
      .map((entry) => entry.revenue);

    if (values.length >= 2) {
      const dayAverage = mean(values);
      // Limit the impact of weekday seasonality.
      factors[day] = clamp(dayAverage / overallAverage, 0.65, 1.35);
    }
  }

  const factorMean = mean(factors);

  return factors.map((factor) => (factorMean > 0 ? factor / factorMean : 1));
};

const createForecast = (dailySeries, forecastDays = 7) => {
  if (!dailySeries.length) {
    return {
      revenue: 0,
      dailyForecast: [],
      confidence: 0,
      method: 'Insufficient sales history',
      trendPercent: 0,
      averageDailyRevenue: 0,
      historicalDays: 0,
    };
  }

  const values = dailySeries.map((entry) => entry.revenue);
  const positiveValues = values.filter((value) => value > 0);

  const historicalDays = dailySeries.length;
  const averageDailyRevenue = mean(values);

  if (positiveValues.length < 2) {
    const fallback = averageDailyRevenue * forecastDays;

    return {
      revenue: Number(fallback.toFixed(2)),
      dailyForecast: Array.from({ length: forecastDays }, (_, index) => ({
        date: addDays(dailySeries[dailySeries.length - 1].date, index + 1),
        revenue: Number(averageDailyRevenue.toFixed(2)),
      })),
      confidence: 25,
      method: 'Limited historical data',
      trendPercent: 0,
      averageDailyRevenue,
      historicalDays,
    };
  }

  const recentWindowSize = Math.min(28, Math.max(7, dailySeries.length));
  const recentSeries = dailySeries.slice(-recentWindowSize);
  const recentValues = winsorize(recentSeries.map((entry) => entry.revenue));

  const recentAverage = mean(recentValues);
  const weightedAverage = weightedMovingAverage(recentValues);
  const regression = linearRegression(recentValues);

  const dailyTrend = regression.slope;
  const trendPercent = recentAverage > 0 ? (dailyTrend / recentAverage) * 100 : 0;
  const safeTrendPercent = clamp(trendPercent, -8, 8);

  const dayOfWeekFactors = calculateDayOfWeekFactors(dailySeries);

  let baseWeight = 0.75;
  let trendWeight = 0.25;

  if (historicalDays >= 28) {
    baseWeight = 0.60;
    trendWeight = 0.40;
  } else if (historicalDays >= 14) {
    baseWeight = 0.68;
    trendWeight = 0.32;
  }

  const baseDailyRevenue =
    weightedAverage * baseWeight +
    Math.max(0, weightedAverage + dailyTrend) * trendWeight;

  const dailyForecast = [];

  for (let index = 1; index <= forecastDays; index += 1) {
    const forecastDate = addDays(dailySeries[dailySeries.length - 1].date, index);

    const trendAdjustment = 1 + (safeTrendPercent / 100) * Math.min(index / 7, 1) * 0.5;
    const weekdayFactor = historicalDays >= 14 ? dayOfWeekFactors[forecastDate.getDay()] : 1;

    let prediction = baseDailyRevenue * trendAdjustment * weekdayFactor;

    const lowerBound = recentAverage * 0.35;
    const upperBound = recentAverage * 2.25;

    if (recentAverage > 0) {
      prediction = clamp(prediction, lowerBound, upperBound);
    }

    dailyForecast.push({
      date: forecastDate,
      revenue: Math.max(0, prediction),
    });
  }

  const forecastRevenue = dailyForecast.reduce((sum, entry) => sum + entry.revenue, 0);
  const deviations = values.map((value) => (value - averageDailyRevenue) ** 2);
  const standardDeviation = deviations.length > 0 ? Math.sqrt(mean(deviations)) : 0;
  const coefficientOfVariation = averageDailyRevenue > 0 ? standardDeviation / averageDailyRevenue : 1;

  let confidence = 75 - coefficientOfVariation * 35;

  if (historicalDays >= 28) confidence += 8;
  else if (historicalDays >= 14) confidence += 4;
  else if (historicalDays < 7) confidence -= 15;

  confidence = Math.round(clamp(confidence, 20, 92));

  let method = 'Weighted trend forecast';
  if (historicalDays >= 28) {
    method = 'Trend + weekly seasonality';
  } else if (historicalDays < 14) {
    method = 'Recent weighted average';
  }

  return {
    revenue: Number(forecastRevenue.toFixed(2)),
    dailyForecast: dailyForecast.map((entry) => ({
      ...entry,
      revenue: Number(entry.revenue.toFixed(2)),
    })),
    confidence,
    method,
    trendPercent: Number(safeTrendPercent.toFixed(1)),
    averageDailyRevenue: Number(averageDailyRevenue.toFixed(2)),
    historicalDays,
  };
};

export const buildSalesAnalytics = (orders = [], lookbackDays = 7) => {
  const completedOrders = (orders || []).filter(
    (order) => order?.status === 'completed' && order?.payment === 'paid'
  );

  const totalRevenue = completedOrders.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  );

  const totalOrders = completedOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const itemMap = new Map();

  completedOrders.forEach((order) => {
    const items =
      Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : [
            {
              name: order.product || 'Single item',
              qty: Number(order.quantity || 1),
              price: Number(order.amount || 0),
            },
          ];

    items.forEach((item) => {
      const name = item?.name || 'Single item';
      const qty = Number(item?.qty || 0);
      const price = Number(item?.price || 0);

      const entry = itemMap.get(name) || {
        name,
        quantity: 0,
        revenue: 0,
      };

      entry.quantity += qty;
      entry.revenue += qty * price;

      itemMap.set(name, entry);
    });
  });

  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      revenue: Number(item.revenue || 0),
    }));

  const latestOrderDate = completedOrders.reduce((latest, order) => {
    const date = normalizeDate(order.orderDate || order.createdAt);
    if (!date) return latest;
    return latest && latest > date ? latest : date;
  }, null);

  const referenceDate = startOfDay(latestOrderDate || new Date());
  const dailySeries = buildDailySeries(completedOrders, referenceDate);

  const revenueTrend = [];

  for (let index = lookbackDays - 1; index >= 0; index -= 1) {
    const target = addDays(referenceDate, -index);
    const matchingDay = dailySeries.find((entry) => entry.key === dateKey(target));

    revenueTrend.push({
      label: target.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      revenue: matchingDay?.revenue || 0,
    });
  }

  const forecast = createForecast(dailySeries, 7);

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalOrders,
    averageOrderValue: Number(averageOrderValue.toFixed(2)),

    topItems,
    revenueTrend,

    forecastRevenue: forecast.revenue,
    forecastDaily: forecast.dailyForecast,
    forecastConfidence: forecast.confidence,
    forecastMethod: forecast.method,
    forecastTrendPercent: forecast.trendPercent,
    forecastAverageDailyRevenue: forecast.averageDailyRevenue,
    forecastHistoricalDays: forecast.historicalDays,

    completedOrders,
  };
};