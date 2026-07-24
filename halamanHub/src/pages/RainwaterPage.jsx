import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardBody, StatCard, Badge } from '../components/ui/UI';
import { WaterLevelTrendChart } from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { sensorsApi, dashboardApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

const formatTime = (iso) => {
  if (!iso) return '—';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
};

const RainwaterPage = () => {
  const [range, setRange] = useState('24h');
  const hours = RANGE_HOURS[range];

  const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary);
  const { data: history, error: historyError, refetch: refetchHistory } =
    useApiData((token) => sensorsApi.getHistory(token, hours), [hours]);

  const points = history || [];

  const chart = useMemo(() => ({
    labels: points.map(p =>
      hours <= 24
        ? new Date(p.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(p.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    ),
    values: points.map(p => p.waterRawADC ?? null),
  }), [points, hours]);

  const availablePct = useMemo(() => {
    if (points.length === 0) return null;
    const availableCount = points.filter(p => p.waterAvailable).length;
    return Math.round((availableCount / points.length) * 100);
  }, [points]);

  const hasError = summaryError || historyError;

  return (
    <div>
      {hasError && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load tank data. {hasError instanceof ApiError ? hasError.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={() => { refetchSummary(); refetchHistory(); }}>Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className={ps.grid.stats4}>
        <StatCard
          icon={summary?.waterTank.available ? 'ti-droplet' : 'ti-alert-triangle'}
          iconVariant={summary?.waterTank.available ? 'green' : 'red'}
          value={summary?.waterTank.available ? 'OK' : 'LOW'}
          label="Tank status"
        />
        <StatCard icon="ti-gauge" iconVariant="blue" value={summary?.waterTank.raw ?? '—'} label="Raw ADC reading" />
        <StatCard icon="ti-chart-line" iconVariant="teal" value={availablePct != null ? `${availablePct}%` : '—'} label={`Time available (${range})`} />
        <StatCard icon="ti-clock" iconVariant="amber" value={formatTime(summary?.irrigation.lastUpdated)} label="Last reading" />
      </div>

      {/* Trend */}
      <Card className={ps.lastCard}>
        <CardHeader
          title="Tank sensor trend"
          subtitle="Raw ADC value over time — higher generally means more water"
          actions={
            <div className={ps.btnRow}>
              {['24h', '7d', '30d'].map(r => (
                <button
                  key={r}
                  className={`px-2.5 py-1 rounded-md text-sm ${range === r ? 'bg-primary text-white' : 'bg-bg-tertiary'}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          <WaterLevelTrendChart labels={chart.labels} values={chart.values} />
          <div className="text-sm text-text-secondary mt-2.5 flex items-start gap-1.5">
            <i className="ti ti-info-circle flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              This reflects only the on/off water-level sensor on your tank (threshold-based). There's no flow meter or rain
              gauge installed, so litres collected/used and rainfall forecasts aren't something this system can measure yet.
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default RainwaterPage;