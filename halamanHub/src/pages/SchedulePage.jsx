import React, { useMemo } from 'react';
import { Card, CardHeader, Badge, EmptyState } from '../components/ui/UI';
import { useApiData } from '../hooks/useApiData';
import { ordersApi } from '../api/client';

const formatDay = (dateKey) => {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const dateKey = (iso) => new Date(iso).toISOString().split('T')[0];
const todayKey = dateKey(new Date().toISOString());

const STATUS_BADGE = {
  pending:    { label: 'Pending',    variant: 'warning' },
  confirmed:  { label: 'Confirmed',  variant: 'blue' },
  processing: { label: 'Processing', variant: 'purple' },
  ready:      { label: 'Ready for pickup', variant: 'amber' },
  completed:  { label: 'Completed',  variant: 'ok' },
  cancelled:  { label: 'Cancelled',  variant: 'error' },
};

const SchedulePage = () => {
  const { data: orders, loading, error, refetch } = useApiData(ordersApi.getAll, [], 8000);

  const grouped = useMemo(() => {
    const list = (orders || []).filter(o =>
      o.fulfillmentType === 'pickup' &&
      o.pickupDate &&
      o.status !== 'cancelled'
    );

    const groups = {};
    list.forEach(o => {
      const key = dateKey(o.pickupDate);
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-text-primary">Pickup schedule</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          See who's visiting the farm to pick up their order, grouped by date.
        </p>
      </div>

      {error && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load schedule. <button className="underline" onClick={refetch}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-text-secondary py-16">Loading…</div>
      ) : grouped.length === 0 ? (
        <Card>
          <EmptyState
            icon="ti-calendar"
            title="No upcoming pickups"
            description="Orders with farm pickup and a scheduled date will appear here."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([day, dayOrders]) => (
            <Card key={day}>
              <CardHeader
                title={formatDay(day)}
                subtitle={`${dayOrders.length} visit${dayOrders.length !== 1 ? 's' : ''}`}
              />
              {day === todayKey && (
                <div className="px-4 pb-2">
                  <Badge variant="ok">Today</Badge>
                </div>
              )}
              <div className="divide-y divide-border">
                {dayOrders.map(o => {
                  const sb = STATUS_BADGE[o.status] || STATUS_BADGE.pending;
                  return (
                    <div key={o._id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{o.customer}</span>
                          <span className="text-xs text-text-tertiary">{o.orderNumber}</span>
                        </div>
                        <div className="text-sm text-text-secondary truncate max-w-[420px]">{o.product}</div>
                        {o.customerPhone && (
                          <div className="text-xs text-text-tertiary mt-0.5 flex items-center gap-1">
                            <i className="ti ti-phone" /> {o.customerPhone}
                          </div>
                        )}
                      </div>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchedulePage;