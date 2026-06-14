import React, { useState } from 'react';
import { Card, CardHeader, CardBody, Badge, Button, PulseDot, StatCard } from '../components/ui/UI';
import { WaterTank, NPKRing, SensorReadingRow } from '../components/charts/Widgets';
import { MoistureTrendChart } from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { dashboardApi, sensorsApi, irrigationApi, alertsApi, ApiError } from '../api/client';
import { chartData } from '../data/mockData'; // historical trend data (not yet modeled in MongoDB)
import * as s from './pageStyles';

const sensorStatusToPercent = (sensor) => {
  if (sensor.numericValue == null) return 0;
  // Rough visual scaling per sensor type for the progress bar
  if (sensor.type === 'pH') return Math.min((sensor.numericValue / 14) * 100, 100);
  if (sensor.type === 'EC') return Math.min((sensor.numericValue / 5) * 100, 100);
  if (sensor.type === 'Temperature') return Math.min((sensor.numericValue / 50) * 100, 100);
  return Math.min(sensor.numericValue, 100);
};

const formatTime = (iso) => {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
};

const DashboardPage = () => {
  const [range, setRange] = useState('24h');

  const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary);
  const { data: sensors, refetch: refetchSensors } = useApiData(sensorsApi.getAll);
  const { data: zones } = useApiData(irrigationApi.getZones);
  const { data: alerts } = useApiData(alertsApi.getAll, [4]);

  const zoneAList = (sensors || []).filter(s => s.zone === 'Zone A' && s.type !== 'NPK');
  const zoneA = (zones || []).find(z => z.zoneId === 'zone-a');
  const zoneB = (zones || []).find(z => z.zoneId === 'zone-b');

  const handleRefresh = () => {
    refetchSummary();
    refetchSensors();
  };

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
        <StatCard icon="ti-radar" iconVariant="green" value={summary?.activeSensors ?? '—'} label="Active sensors" trend="All systems normal" trendDir="ok" />
        <StatCard icon="ti-droplet" iconVariant="blue" value={summary?.soilMoisture.value != null ? `${summary.soilMoisture.value}%` : '—'} label="Soil moisture" trend="Since yesterday" trendDir="up" />
        <StatCard icon="ti-test-pipe" iconVariant="green" value={summary?.pH.value ?? '—'} label="pH level" trend="Optimal range" trendDir="ok" />
        <StatCard icon="ti-bolt" iconVariant="amber" value={summary?.ec.value != null ? `${summary.ec.value} mS` : '—'} label="EC level" trend="Since 8am" trendDir="dn" />
        <StatCard icon="ti-thermometer" iconVariant="red" value={summary?.temperature.value != null ? `${summary.temperature.value}°C` : '—'} label="Soil temperature" trend="Normal range" trendDir="ok" />
        <StatCard icon="ti-wave-sine" iconVariant="teal" value={summary?.humidity.value != null ? `${summary.humidity.value}%` : '—'} label="Humidity" trend="Stable" trendDir="ok" />
      </div>

      {/* Live sensor feed + Right column */}
      <div className={s.grid.twoCol}>
        {/* Live sensor feed */}
        <Card>
          <CardHeader
            title="Live sensor feed"
            subtitle={zoneAList[0] ? `Updated ${formatTime(zoneAList[0].lastReadingAt)}` : 'Loading…'}
            actions={<Button variant="ghost" size="sm" icon="ti-refresh" aria-label="Refresh" onClick={handleRefresh} />}
          />
          <CardBody>
            {zoneAList.map(sensor => (
              <SensorReadingRow
                key={sensor._id}
                name={sensor.type === 'Soil moisture' ? 'Soil moisture — Zone A' : `${sensor.type} sensor`}
                value={sensor.value}
                percent={sensorStatusToPercent(sensor)}
                status={sensor.status}
                time={formatTime(sensor.lastReadingAt)}
              />
            ))}
            {zoneAList.length === 0 && (
              <div className="text-center text-text-secondary py-4 text-sm">Loading sensor readings…</div>
            )}
          </CardBody>
        </Card>

        {/* Right column */}
        <div className={s.grid.colStack}>
          {/* Irrigation status */}
          <Card>
            <CardHeader title="Irrigation status" />
            <CardBody>
              {zoneA && (
                <div className={s.irrRow}>
                  <div className={zoneA.status === 'active' ? s.irrOn : s.irrOff}>
                    <PulseDot active={zoneA.status === 'active'} /> Zone A — {zoneA.status === 'active' ? 'Active' : 'Idle'}
                  </div>
                  {zoneA.status === 'active' && <Button variant="danger" size="sm" icon="ti-player-stop">Stop</Button>}
                </div>
              )}
              {zoneB && (
                <div className={`${zoneB.status === 'active' ? s.irrOn : s.irrOff} mb-3`}>
                  <PulseDot active={zoneB.status === 'active'} /> Zone B — {zoneB.status === 'active' ? 'Active' : 'Idle'}
                </div>
              )}
              <div className={s.btnRow}>
                <Button variant="default" size="sm" icon="ti-calendar">View schedule</Button>
                <Button variant="primary" size="sm" icon="ti-player-play">Start Zone B</Button>
              </div>
              {zoneA && <div className={s.irrMeta}>{zoneA.lastRunSummary}</div>}
            </CardBody>
          </Card>

          {/* Water tank */}
          <Card>
            <CardHeader title="Water tank" subtitle={`${summary?.waterTank.capacity ?? 1200} L total capacity`} />
            <CardBody>
              <div className={s.tankRow}>
                <WaterTank percent={summary?.waterTank.value ?? 0} sublabel={`${summary?.waterTank.litres ?? 0} L`} />
                <div className={s.tankInfo}>
                  <div className={s.tankVal}>{summary?.waterTank.litres ?? '—'} L</div>
                  <div className={s.tankSub}>of {summary?.waterTank.capacity ?? '—'} L available</div>
                  <div className={s.tankMeta}>
                    Source: <strong className={s.greenText}>Rainwater</strong>
                  </div>
                  <div className={s.tankMeta}>Refill est. <strong>2 days</strong></div>
                  <Badge variant="ok" className={s.tankBadge}>
                    <i className="ti ti-cloud-rain" aria-hidden="true" /> Harvest active
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* NPK + Alerts */}
      <div className={s.grid.twoCol}>
        {/* NPK */}
        <Card>
          <CardHeader title="NPK nutrient levels" subtitle="Zone A soil analysis" />
          <CardBody>
            <div className={s.npkRow}>
              <NPKRing symbol="N" value={summary?.npk.nitrogen ?? 0} max={100} name="Nitrogen" unit="mg/kg" />
              <NPKRing symbol="P" value={summary?.npk.phosphorus ?? 0} max={80} name="Phosphorus" unit="mg/kg" />
              <NPKRing symbol="K" value={summary?.npk.potassium ?? 0} max={80} name="Potassium" unit="mg/kg" />
            </div>
            <div className={s.npkLegend}>
              <span><i className="ti ti-check text-[#27a85a]" aria-hidden="true" /> N: optimal</span>
              <span><i className="ti ti-check text-[#27a85a]" aria-hidden="true" /> P: optimal</span>
              <span><i className="ti ti-alert-triangle text-[#f0b429]" aria-hidden="true" /> K: slightly high</span>
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
          title="Soil moisture trend — today"
          subtitle="All zones, 24-hour view"
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
          <MoistureTrendChart labels={chartData.moistureTrend.labels} zoneA={chartData.moistureTrend.zoneA} zoneB={chartData.moistureTrend.zoneB} />
        </CardBody>
      </Card>
    </div>
  );
};

export default DashboardPage;
