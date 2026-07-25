import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardBody, Button } from '../components/ui/UI';
import {
  PHTrendChart, ECTrendChart, NPKTrendChart, IrrigationHistoryChart, TempHumidityChart,
} from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { sensorsApi, irrigationApi, ApiError } from '../api/client';
import * as s from './pageStyles';

const RANGE_HOURS = { Daily: 24, Weekly: 24 * 7, Monthly: 24 * 30 };
const ranges = ['Daily', 'Weekly', 'Monthly'];

const dayKey = (date) => date.toISOString().slice(0, 10);

const buildDayBuckets = (hours) => {
  const days = Math.max(1, Math.ceil(hours / 24));
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push(d);
  }
  return buckets;
};

const AnalyticsPage = () => {
  const [range, setRange] = useState('Weekly');
  const hours = RANGE_HOURS[range];

  const { data: history, error: historyError, refetch: refetchHistory } =
    useApiData((token) => sensorsApi.getHistory(token, hours), [hours], 20000);
  const { data: logs, error: logsError, refetch: refetchLogs } =
    useApiData((token) => irrigationApi.getLogs(token, 500, hours), [hours], 20000);

  const points = history || [];

  const pointLabel = (iso) =>
    hours <= 24
      ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const labels = useMemo(() => points.map(p => pointLabel(p.recordedAt)), [points, hours]);

  const irrigationData = useMemo(() => {
    const dayBuckets = buildDayBuckets(hours);
    const minutesBySource = { PUMP: {}, SOLENOID: {} };
    const pendingOn = { PUMP: null, SOLENOID: null };

    [...(logs || [])]
      .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt))
      .forEach(entry => {
        if (entry.action === 'ON') {
          pendingOn[entry.source] = new Date(entry.occurredAt);
        } else if (entry.action === 'OFF' && pendingOn[entry.source]) {
          const onTime = pendingOn[entry.source];
          const offTime = new Date(entry.occurredAt);
          const minutes = (offTime - onTime) / 60000;
          const key = dayKey(onTime);
          minutesBySource[entry.source][key] = (minutesBySource[entry.source][key] || 0) + minutes;
          pendingOn[entry.source] = null;
        }
      });

    return {
      labels: dayBuckets.map(d => d.toLocaleDateString([], { month: 'short', day: 'numeric' })),
      pump: dayBuckets.map(d => Math.round(minutesBySource.PUMP[dayKey(d)] || 0)),
      solenoid: dayBuckets.map(d => Math.round(minutesBySource.SOLENOID[dayKey(d)] || 0)),
    };
  }, [logs, hours]);

  const hasError = historyError || logsError;

  return (
    <div>
      {hasError && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load analytics data. {hasError instanceof ApiError ? hasError.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={() => { refetchHistory(); refetchLogs(); }}>Retry</button>
        </div>
      )}

      {/* Header actions */}
      <div className={s.filterBar}>
        <div className={s.btnRow}>
          {ranges.map(r => (
            <Button key={r} size="sm" variant={range === r ? 'primary' : 'default'} onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
        </div>
      </div>

      {/* pH / EC */}
      <div className={s.grid.twoCol}>
        <Card>
          <CardHeader title="pH trend" subtitle="Live system" />
          <CardBody><PHTrendChart labels={labels} values={points.map(p => p.ph)} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="EC trend" subtitle="Live system, uS/cm" />
          <CardBody><ECTrendChart labels={labels} values={points.map(p => p.ec)} /></CardBody>
        </Card>
      </div>

      {/* NPK + Irrigation history */}
      <div className={s.grid.twoCol}>
        <Card>
          <CardHeader title="NPK trends" subtitle="Live system" />
          <CardBody>
            <NPKTrendChart
              labels={labels}
              nitrogen={points.map(p => p.nitrogen)}
              phosphorus={points.map(p => p.phosphorus)}
              potassium={points.map(p => p.potassium)}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Irrigation on-time" subtitle="Minutes per day, from real logs" />
          <CardBody>
            <IrrigationHistoryChart labels={irrigationData.labels} pump={irrigationData.pump} solenoid={irrigationData.solenoid} />
          </CardBody>
        </Card>
      </div>

      {/* Temp & humidity */}
      <Card className={s.lastCard}>
        <CardHeader title="Temperature & humidity" subtitle="Live system (DHT22, ambient air)" />
        <CardBody>
          <TempHumidityChart
            labels={labels}
            temperature={points.map(p => p.airTemp)}
            humidity={points.map(p => p.airHumidity)}
          />
        </CardBody>
      </Card>
    </div>
  );
};

export default AnalyticsPage;