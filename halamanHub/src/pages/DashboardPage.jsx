import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, Badge, Button, PulseDot, StatCard } from '../components/ui/UI';
import { NPKRing, SensorReadingRow } from '../components/charts/Widgets';
import { MoistureTrendChart } from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { dashboardApi, sensorsApi, alertsApi, ApiError } from '../api/client';
import * as s from './pageStyles';
import { socket } from '../socket';

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

const parseNitrogenValue = (sensor) => {
  if (sensor == null) return null;
  if (typeof sensor.numericValue === 'number') return sensor.numericValue;
  if (typeof sensor.value === 'string') {
    const match = sensor.value.match(/N:(\d+(?:\.\d+)?)/i);
    return match ? Number(match[1]) : null;
  }
  return null;
};

const sensorStatusToPercent = (sensor) => {
  if (sensor.type === 'NPK') {
    const nitrogen = parseNitrogenValue(sensor);
    if (nitrogen == null) return 0;
    return Math.min((nitrogen / 100) * 100, 100);
  }
  if (sensor.numericValue == null) return 0;
  if (sensor.type === 'pH') return Math.min((sensor.numericValue / 14) * 100, 100);
  if (sensor.type === 'EC') return Math.min((sensor.numericValue / 2000) * 100, 100); // uS/cm scale
  if (sensor.type === 'Temperature') return Math.min((sensor.numericValue / 50) * 100, 100);
  return Math.min(sensor.numericValue, 100);
};

const severityVariant = { high: 'error', medium: 'warning', low: 'blue', ok: 'ok' };
const severityLabel = { high: 'Action needed', medium: 'Monitor', low: 'Minor', ok: 'Healthy' };
const recommendationTone = {
  high: { card: 'border-red-200 bg-red-50/60', icon: 'ti-alert-circle bg-red-100 text-red-700', value: 'text-red-800' },
  medium: { card: 'border-amber-200 bg-amber-50/60', icon: 'ti-eye bg-amber-100 text-amber-800', value: 'text-amber-900' },
  low: { card: 'border-blue-200 bg-blue-50/60', icon: 'ti-info-circle bg-blue-100 text-blue-700', value: 'text-blue-900' },
  ok: { card: 'border-green-200 bg-green-50/60', icon: 'ti-circle-check bg-green-100 text-green-700', value: 'text-green-900' },
};
const liveLabel = (status) => status === 'offline' ? 'Inactive' : 'Live';
const liveTrend = (status) => status === 'offline' ? 'dn' : 'ok';
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

  const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary, [], 30000);
  const { data: sensors, refetch: refetchSensors } = useApiData(sensorsApi.getAll, [], 30000);
  // real-time updates — socket pushes new readings instantly, polling above
  // just stays as a slower fallback in case the socket ever drops.
  useEffect(() => {
    const handleReading = () => {
      refetchSensors();
      refetchSummary();
    };
    socket.on('sensor:reading', handleReading);
    socket.on('sensor:status', handleReading);
    return () => {
      socket.off('sensor:reading', handleReading);
      socket.off('sensor:status', handleReading);
    };
  }, [refetchSensors, refetchSummary]);
  const { data: alerts } = useApiData(alertsApi.getAll, [4], 15000);
  const { data: history } = useApiData(
    (token) => sensorsApi.getHistory(token, RANGE_HOURS[range]),
    [range],
    20000
  );

  const liveSensors = (sensors || []).filter(sn => sn.zone === 'Main System');

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
  const recommendations = summary?.recommendations || [];
  const actionCount = recommendations.filter(rec => rec.severity === 'high').length;

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
        <StatCard icon="ti-droplet" iconVariant="blue" value={summary?.soilMoisture.value != null ? `${summary.soilMoisture.value}%` : '—'} label="Soil moisture" trend={liveLabel(summary?.soilMoisture.status)} trendDir={liveTrend(summary?.soilMoisture.status)} />
        <StatCard icon="ti-test-pipe" iconVariant="green" value={summary?.pH.value ?? '—'} label="pH level" trend={liveLabel(summary?.pH.status)} trendDir={liveTrend(summary?.pH.status)} />
        <StatCard icon="ti-bolt" iconVariant="amber" value={summary?.ec.value != null ? `${summary.ec.value} uS/cm` : '—'} label="EC level" trend={liveLabel(summary?.ec.status)} trendDir={liveTrend(summary?.ec.status)} />
        <StatCard icon="ti-seedling" iconVariant="green" value={summary?.npk.nitrogen != null ? `${summary.npk.nitrogen} mg/kg` : '—'} label="Nitrogen" trend={liveLabel(summary?.npk.status)} trendDir={liveTrend(summary?.npk.status)} />
        <StatCard icon="ti-thermometer" iconVariant="red" value={summary?.temperature.value != null ? `${summary.temperature.value}°C` : '—'} label="Temperature" trend={liveLabel(summary?.temperature.status)} trendDir={liveTrend(summary?.temperature.status)} />
        <StatCard icon="ti-wave-sine" iconVariant="teal" value={summary?.humidity.value != null ? `${summary.humidity.value}%` : '—'} label="Humidity" trend={liveLabel(summary?.humidity.status)} trendDir={liveTrend(summary?.humidity.status)} />
      </div>

      {/* The recommendations sit beside the readings so important actions are visible immediately. */}
      <div className={s.grid.twoCol}>
        <Card>
          <CardHeader
            title="Live sensor feed"
            subtitle={liveSensors[0] ? `Updated ${formatTime(liveSensors[0].lastReadingAt)}` : 'Loading…'}
            actions={<Button variant="ghost" size="sm" icon="ti-refresh" aria-label="Refresh" onClick={handleRefresh} />}
          />
          <CardBody>
            {liveSensors.map(sensor => {
              const nitrogenValue = sensor.type === 'NPK' ? parseNitrogenValue(sensor) : null;
              return (
                <SensorReadingRow
                  key={sensor._id}
                  name={sensor.type === 'NPK' ? 'Nitrogen (N)' : `${sensor.type} sensor`}
                  value={sensor.type === 'NPK' && nitrogenValue != null ? `${nitrogenValue} mg/kg` : sensor.value}
                  percent={sensorStatusToPercent(sensor)}
                  status={sensor.status}
                  time={formatTime(sensor.lastReadingAt)}
                />
              );
            })}
            {liveSensors.length === 0 && (
              <div className="text-center text-text-secondary py-4 text-sm">Waiting for sensor data…</div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Soil & environment recommendations"
            subtitle="Clear next steps based on the latest sensor readings."
            actions={recommendations.length > 0 && <Badge variant={actionCount > 0 ? 'error' : 'ok'}>{actionCount > 0 ? `${actionCount} to review` : 'Healthy'}</Badge>}
          />
          <CardBody>
            {recommendations.length > 0 && (
              <div className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${actionCount > 0 ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}`}>
                <i className={`ti ${actionCount > 0 ? 'ti-clipboard-heart' : 'ti-circle-check'} text-lg`} aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium">{actionCount > 0 ? `${actionCount} priority action${actionCount === 1 ? '' : 's'} to take` : 'Conditions look healthy'}</div>
                  <div className="text-xs opacity-80">{actionCount > 0 ? 'Start with the red cards below, then retest after treatment.' : 'Keep monitoring to maintain these conditions.'}</div>
                </div>
              </div>
            )}

            <div className="grid gap-2.5 mt-3">
              {recommendations.map((rec, idx) => {
                const tone = recommendationTone[rec.severity] || recommendationTone.low;
                return (
                  <div key={idx} className={`border rounded-md p-3 ${tone.card}`}>
                    <div className="flex items-start gap-2.5">
                      <i className={`ti ${tone.icon} w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-text-primary">{rec.category}</div>
                            {rec.reading && <div className={`text-base font-semibold mt-0.5 ${tone.value}`}>{rec.reading}</div>}
                          </div>
                          <Badge variant={severityVariant[rec.severity] || 'blue'}>{severityLabel[rec.severity] || rec.severity}</Badge>
                        </div>
                        <div className="text-xs font-medium uppercase tracking-wide text-text-secondary mt-2">Recommended next step</div>
                        <div className="text-sm text-text-secondary leading-snug mt-0.5">{rec.message}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {recommendations.length === 0 && (
              <div className="text-center text-text-secondary py-4 text-sm">Waiting for sensor data…</div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Irrigation + water tank */}
      <div className={s.grid.twoCol}>
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
              <Button variant="primary" size="sm" icon="ti-settings" onClick={() => navigate('/irrigation')}>Manage irrigation</Button>
            </div>
            <div className={s.irrMeta}>Last update: {formatTime(irrigation?.lastUpdated)}</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Water tank" subtitle="Live level sensor" />
          <CardBody>
            <div className="flex items-center gap-3">
              <Badge variant={summary?.waterTank.status === 'offline' ? 'error' : summary?.waterTank.available ? 'ok' : 'warning'}>
                <i className={`ti ${summary?.waterTank.status === 'offline' ? 'ti-wifi-off' : summary?.waterTank.available ? 'ti-droplet' : 'ti-alert-triangle'}`} aria-hidden="true" />{' '}
                {summary?.waterTank.status === 'offline' ? 'Sensor inactive' : summary?.waterTank.available ? 'Water available' : 'Tank low'}
              </Badge>
            </div>
            <div className="text-sm text-text-secondary mt-2.5">Raw sensor reading: <strong>{summary?.waterTank.raw ?? '—'}</strong></div>
            <div className="text-sm text-text-secondary mt-1">No flow meter is installed, so litres can't be calculated yet — this reflects the tank sensor's on/off threshold only.</div>
          </CardBody>
        </Card>
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
          <CardHeader title="Recent alerts" />
          <CardBody>
            {((alerts || []).slice(0, 10)).map(a => (
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
