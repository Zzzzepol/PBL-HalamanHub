import React, { useMemo } from 'react';
import { Card, CardHeader, CardBody, StatCard, Table, Badge, EmptyState } from '../components/ui/UI';
import { SalesRevenueChart, TopProductsChart } from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { ordersApi } from '../api/client';
import * as s from './pageStyles';
import { buildSalesAnalytics, formatCurrency } from '../utils/salesAnalytics';

const SalesAnalyticsPage = () => {
  const {
    data: orders,
    loading,
    error,
    refetch,
  } = useApiData(ordersApi.getAll, [], 15000);

  const analytics = useMemo(() => buildSalesAnalytics(orders || [], 7), [orders]);

  const recentSales = useMemo(() => {
    const completed = (orders || []).filter(
      (order) => order?.status === 'completed' && order?.payment === 'paid'
    );

    return completed
      .slice()
      .sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt))
      .slice(0, 6);
  }, [orders]);

  const topItems = analytics.topItems || [];
  const forecastConfidence = analytics.forecastConfidence || 0;
  const forecastTrend = analytics.forecastTrendPercent || 0;

  const trendLabel =
    forecastTrend > 0
      ? `+${forecastTrend}% trend`
      : forecastTrend < 0
        ? `${forecastTrend}% trend`
        : 'Stable trend';

  const confidenceLabel =
    forecastConfidence >= 75
      ? 'High confidence'
      : forecastConfidence >= 50
        ? 'Moderate confidence'
        : 'Low confidence';

  return (
    <div className="space-y-3.5">
      <div className={s.filterBar}>
        <div>
          <div className="text-lg font-semibold text-text-primary">Sales Analytics</div>
          <div className="text-sm text-text-secondary">
            Revenue, top-selling items, and data-driven sales forecast
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load sales analytics.{' '}
          <button className="underline" onClick={refetch}>
            Retry
          </button>
        </div>
      )}

      <div className={s.grid.stats4}>
        <StatCard
          icon="ti-cash"
          iconVariant="green"
          value={formatCurrency(analytics.totalRevenue)}
          label="Revenue"
        />
        <StatCard
          icon="ti-shopping-cart"
          iconVariant="blue"
          value={analytics.totalOrders}
          label="Completed sales"
        />
        <StatCard
          icon="ti-chart-bar"
          iconVariant="amber"
          value={formatCurrency(analytics.averageOrderValue)}
          label="Avg. order value"
        />
        <StatCard
          icon="ti-trending-up"
          iconVariant="teal"
          value={formatCurrency(analytics.forecastRevenue)}
          label="Next 7-day forecast"
          trend={trendLabel}
          trendDir={forecastTrend >= 0 ? 'up' : 'down'}
        />
      </div>

      {/* Forecast explanation */}
      <Card>
        <CardHeader
          title="Sales forecast"
          subtitle="Estimated revenue for the next 7 days based on historical sales behavior"
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-bg-secondary px-3 py-3">
              <div className="text-xs text-text-secondary">Forecast revenue</div>
              <div className="mt-1 text-lg font-semibold text-text-primary">
                {formatCurrency(analytics.forecastRevenue)}
              </div>
              <div className="mt-1 text-xs text-text-secondary">Next 7 days</div>
            </div>

            <div className="rounded-md border border-border bg-bg-secondary px-3 py-3">
              <div className="text-xs text-text-secondary">Forecast confidence</div>
              <div className="mt-1 text-lg font-semibold text-text-primary">
                {forecastConfidence}%
              </div>
              <div className="mt-1 text-xs text-text-secondary">{confidenceLabel}</div>
            </div>

            <div className="rounded-md border border-border bg-bg-secondary px-3 py-3">
              <div className="text-xs text-text-secondary">Forecast model</div>
              <div className="mt-1 text-sm font-semibold text-text-primary">
                {analytics.forecastMethod}
              </div>
              <div className="mt-1 text-xs text-text-secondary">
                Based on {analytics.forecastHistoricalDays} historical days
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-border px-3 py-2.5 bg-bg-secondary">
            <div className="text-sm text-text-secondary">
              The forecast uses recent sales performance, revenue trend, and weekly day-of-week
              patterns when enough historical data is available. It is an estimate, not a guaranteed
              result.
            </div>
          </div>
        </CardBody>
      </Card>

      <div className={s.grid.twoCol}>
        <Card>
          <CardHeader
            title="Revenue trend"
            subtitle="Completed paid orders over the last 7 days"
          />
          <CardBody>
            <SalesRevenueChart
              labels={analytics.revenueTrend.map((entry) => entry.label)}
              values={analytics.revenueTrend.map((entry) => entry.revenue)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Most purchased items"
            subtitle="Best-selling products by quantity"
          />
          <CardBody>
            {topItems.length > 0 ? (
              <TopProductsChart
                labels={topItems.map((item) => item.name)}
                values={topItems.map((item) => item.quantity)}
              />
            ) : (
              <EmptyState
                icon="ti-package"
                title="No sales yet"
                description="Completed orders will appear here once your shop starts selling."
              />
            )}
          </CardBody>
        </Card>
      </div>

      <div className={s.grid.twoCol}>
        <Card>
          <CardHeader
            title="Top items by revenue"
            subtitle="Products driving the most income"
          />
          <CardBody>
            {topItems.length > 0 ? (
              <div className="space-y-2.5">
                {topItems.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 bg-bg-secondary"
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge variant={index === 0 ? 'ok' : 'default'}>{index + 1}</Badge>
                      <div>
                        <div className="font-medium text-text-primary">{item.name}</div>
                        <div className="text-sm text-text-secondary">
                          {item.quantity} units sold
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-green-800">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="ti-chart-pie"
                title="No product performance yet"
                description="Once orders are completed, this section will highlight your best sellers."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent completed sales"
            subtitle="Latest paid and fulfilled orders"
          />
          <CardBody>
            {loading ? (
              <div className="text-sm text-text-secondary">Loading sales data…</div>
            ) : recentSales.length > 0 ? (
              <Table headers={['Order', 'Customer', 'Product', 'Amount']}>
                {recentSales.map((order) => (
                  <tr key={order._id}>
                    <td className="font-medium text-green-800">{order.orderNumber}</td>
                    <td>{order.customer}</td>
                    <td className="max-w-[180px] truncate">{order.product}</td>
                    <td>{formatCurrency(order.amount)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState
                icon="ti-receipt"
                title="No completed sales"
                description="Sales made through the shop and POS will appear here."
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default SalesAnalyticsPage;