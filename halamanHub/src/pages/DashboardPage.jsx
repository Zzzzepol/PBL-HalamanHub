import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, Badge, Button, PulseDot, StatCard } from '../components/ui/UI';
import { NPKRing, SensorReadingRow } from '../components/charts/Widgets';
import { MoistureTrendChart } from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { dashboardApi, sensorsApi, alertsApi, ApiError } from '../api/client';
import * as s from './pageStyles';

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

const sensorStatusToPercent = (sensor) => {
  if (sensor.numericValue == null) return 0;
  if (sensor.type === 'pH') return Math.min((sensor.numericValue / 14) * 100, 100);
  if (sensor.type === 'EC') return Math.min((sensor.numericValue / 2000) * 100, 100); // uS/cm scale
  if (sensor.type === 'Temperature') return Math.min((sensor.numericValue / 50) * 100, 100);
  return Math.min(sensor.numericValue, 100);
};

const formatTime = (iso) => {
  if (!iso) return '—';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('24h');

  const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary);
  const { data: sensors, refetch: refetchSensors } = useApiData(sensorsApi.getAll);
  const { data: alerts } = useApiData(alertsApi.getAll, [4]);
  const { data: history } = useApiData(
    (token) => sensorsApi.getHistory(token, RANGE_HOURS[range]),
    [range]
  );

  const liveSensors = (sensors || []).filter(sn => sn.zone === 'Main System' && sn.type !== 'NPK');

  const moistureTrend = useMemo(() => {
    const points = history || [];
    return {
      labels: points.map(p => new Date(p.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      values: points.map(p => p.soilMoisture ?? null),
    };
  }, [history]);

  const handleRefresh = () => {
    refetchSummary();
    refetchSensors();
  };

  const irrigation = summary?.irrigation;

  return (
    <div>
      {summaryError && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load dashboard data. {summaryError instanceof ApiError ? summaryError.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={handleRefresh}>Retry</button>
        </div>
      )}

      {/* KPI Stats */}
      <div className={s.grid.stats}>
        <StatCard icon="ti-radar" iconVariant="green" value={summary?.activeSensors ?? '—'} label="Active sensors" trend="Live" trendDir="ok" />
        <StatCard icon="ti-droplet" iconVariant="blue" value={summary?.soilMoisture.value != null ? `${summary.soilMoisture.value}%` : '—'} label="Soil moisture" trend="Live" trendDir="ok" />
        <StatCard icon="ti-test-pipe" iconVariant="green" value={summary?.pH.value ?? '—'} label="pH level" trend="Live" trendDir="ok" />
        <StatCard icon="ti-bolt" iconVariant="amber" value={summary?.ec.value != null ? `${summary.ec.value} uS/cm` : '—'} label="EC level" trend="Live" trendDir="ok" />
        <StatCard icon="ti-thermometer" iconVariant="red" value={summary?.temperature.value != null ? `${summary.temperature.value}°C` : '—'} label="Soil temperature" trend="Live" trendDir="ok" />
        <StatCard icon="ti-wave-sine" iconVariant="teal" value={summary?.humidity.value != null ? `${summary.humidity.value}%` : '—'} label="Humidity" trend="Live" trendDir="ok" />
      </div>

      {/* Live sensor feed + Right column */}
      <div className={s.grid.twoCol}>
        {/* Live sensor feed */}
        <Card>
          <CardHeader
            title="Live sensor feed"
            subtitle={liveSensors[0] ? `Updated ${formatTime(liveSensors[0].lastReadingAt)}` : 'Loading…'}
            actions={<Button variant="ghost" size="sm" icon="ti-refresh" aria-label="Refresh" onClick={handleRefresh} />}
          />
          <CardBody>
            {liveSensors.map(sensor => (
              <SensorReadingRow
                key={sensor._id}
                name={`${sensor.type} sensor`}
                value={sensor.value}
                percent={sensorStatusToPercent(sensor)}
                status={sensor.status}
                time={formatTime(sensor.lastReadingAt)}
              />
            ))}
            {liveSensors.length === 0 && (
              <div className="text-center text-text-secondary py-4 text-sm">Waiting for sensor data…</div>
            )}
          </CardBody>
        </Card>

        {/* Right column */}
        <div className={s.grid.colStack}>
          {/* Irrigation status */}
          <Card>
            <CardHeader title="Irrigation status" actions={<Badge variant={irrigation?.mode === 'manual' ? 'warning' : 'ok'}>{irrigation?.mode === 'manual' ? 'Manual' : 'Auto'}</Badge>} />
            <CardBody>
              <div className={`${s.irrRow} !mb-1.5`}>
                <div className={irrigation?.pumpActive ? s.irrOn : s.irrOff}>
                  <PulseDot active={!!irrigation?.pumpActive} /> Pump — {irrigation?.pumpActive ? 'Running' : 'Off'}
                </div>
              </div>
              <div className={`${s.irrRow} mb-3`}>
                <div className={irrigation?.solenoidActive ? s.irrOn : s.irrOff}>
                  <PulseDot active={!!irrigation?.solenoidActive} /> Solenoid — {irrigation?.solenoidActive ? 'Open' : 'Closed'}
                </div>
              </div>
              <div className={s.btnRow}>
                <Button variant="primary" size="sm" icon="ti-settings" onClick={() => navigate('/irrigation')}>
                  Manage irrigation
                </Button>
              </div>
              <div className={s.irrMeta}>Last update: {formatTime(irrigation?.lastUpdated)}</div>
            </CardBody>
          </Card>

          {/* Water tank */}
          <Card>
            <CardHeader title="Water tank" subtitle="Live level sensor" />
            <CardBody>
              <div className="flex items-center gap-3">
                <Badge variant={summary?.waterTank.available ? 'ok' : 'error'}>
                  <i className={`ti ${summary?.waterTank.available ? 'ti-droplet' : 'ti-alert-triangle'}`} aria-hidden="true" />{' '}
                  {summary?.waterTank.available ? 'Water available' : 'Tank low'}
                </Badge>
              </div>
              <div className="text-sm text-text-secondary mt-2.5">
                Raw sensor reading: <strong>{summary?.waterTank.raw ?? '—'}</strong>
              </div>
              <div className="text-sm text-text-secondary mt-1">
                No flow meter is installed, so litres can't be calculated yet — this reflects the tank sensor's on/off threshold only.
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* NPK + Alerts */}
      <div className={s.grid.twoCol}>
        {/* NPK */}
        <Card>
          <CardHeader title="NPK nutrient levels" subtitle="Live soil analysis" />
          <CardBody>
            <div className={s.npkRow}>
              <NPKRing symbol="N" value={summary?.npk.nitrogen ?? 0} max={100} name="Nitrogen" unit="mg/kg" />
              <NPKRing symbol="P" value={summary?.npk.phosphorus ?? 0} max={80} name="Phosphorus" unit="mg/kg" />
              <NPKRing symbol="K" value={summary?.npk.potassium ?? 0} max={80} name="Potassium" unit="mg/kg" />
            </div>
          </CardBody>
        </Card>

        {/* Recent alerts */}
        <Card>
          <CardHeader title="Recent alerts" actions={<Button variant="default" size="sm">View all</Button>} />
          <CardBody>
            {(alerts || []).map(a => (
              <div key={a._id} className={s.alertItem}>
                <div className={s.alertIconVariant[a.type] || s.alertIconVariant.ok}>
                  <i className={`ti ${a.icon}`} aria-hidden="true" />
                </div>
                <div>
                  <div className={s.alertText}>{a.message}</div>
                  <div className={s.alertTime}>{formatTime(a.occurredAt)}</div>
                </div>
              </div>
            ))}
            {(!alerts || alerts.length === 0) && (
              <div className="text-center text-text-secondary py-4 text-sm">No alerts yet.</div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Soil moisture chart */}
      <Card className={s.lastCard}>
        <CardHeader
          title="Soil moisture trend"
          subtitle="Live system"
          actions={
            <div className={s.btnRow}>
              {['24h', '7d', '30d'].map(r => (
                <Button key={r} size="sm" variant={range === r ? 'primary' : 'default'} onClick={() => setRange(r)}>
                  {r}
                </Button>
              ))}
            </div>
          }
        />
        <CardBody>
          <MoistureTrendChart labels={moistureTrend.labels} values={moistureTrend.values} />
        </CardBody>
      </Card>
    </div>
  );
};

export default DashboardPage;