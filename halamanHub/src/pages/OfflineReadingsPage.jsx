// HalamanHub — Offline Readings Page
// Shown ONLY to the offline-readonly account. This route lives OUTSIDE
// MainLayout (see App.jsx) — no Sidebar, no TopBar, no MongoDB-backed API
// calls, by design. It pulls the last known reading from
// GET /api/sensor-data/live on load, then updates live via the
// 'sensor:reading' socket event — neither of which touches MongoDB, so this
// works even when the database is down.

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { socket } from '../socket';
import { getSoilRecommendations } from '../utils/soilRecommendations';
import { getWaterQualityCategory, getPhStatus, getTankStatusInfo } from '../utils/waterQuality';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, ok: 3 };

const recTone = {
  high:   { border: 'border-red-200',   bg: 'bg-red-50/60',    badge: 'bg-red-100 text-red-800' },
  medium: { border: 'border-amber-200', bg: 'bg-amber-50/60',  badge: 'bg-amber-100 text-amber-800' },
  low:    { border: 'border-blue-200',  bg: 'bg-blue-50/60',   badge: 'bg-blue-100 text-blue-800' },
  ok:     { border: 'border-green-200', bg: 'bg-green-50/60',  badge: 'bg-green-100 text-green-800' },
};

const SectionHeading = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2.5 mb-3">
    <div className="w-7 h-7 rounded-sm flex items-center justify-center bg-green-100 text-green-700 text-sm flex-shrink-0">
      <i className={`ti ${icon}`} aria-hidden="true" />
    </div>
    <div>
      <h2 className="text-base font-medium text-text-primary leading-tight">{title}</h2>
      {subtitle && <p className="text-xs text-text-secondary leading-tight">{subtitle}</p>}
    </div>
  </div>
);

const MetricCard = ({ icon, label, value, unit, emphasis }) => (
  <div className={`rounded-md p-4 border-[0.5px] border-border ${emphasis ? 'bg-green-50/70' : 'bg-bg-secondary'}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-sm flex items-center justify-center text-sm bg-green-100 text-green-700 flex-shrink-0">
        <i className={`ti ${icon}`} aria-hidden="true" />
      </div>
      <div className="text-xs text-text-secondary leading-tight">{label}</div>
    </div>
    <div className="text-2xl font-medium leading-[1.1] text-text-primary">
      {value ?? '—'}
      {unit && value != null ? <span className="text-sm text-text-secondary ml-1 font-normal">{unit}</span> : null}
    </div>
  </div>
);

// Water tank status is the one metric where a plain number isn't enough —
// an operator scanning the page quickly needs to see "is this fine or do I
// need to act" at a glance, so it gets a dedicated visual treatment instead
// of sharing a grid cell with everything else.
const WaterTankCard = ({ levelPercent, pumpActive, solenoidActive }) => {
  const hasReading = levelPercent != null;
  const pct = hasReading ? Math.max(0, Math.min(100, levelPercent)) : 0;

  let status = 'No data';
  let barColor = 'bg-gray-300';
  let textColor = 'text-text-secondary';
  if (hasReading) {
    if (pct <= 15) { status = 'Critical — refill soon'; barColor = 'bg-red-500'; textColor = 'text-red-700'; }
    else if (pct <= 35) { status = 'Low'; barColor = 'bg-amber-500'; textColor = 'text-amber-700'; }
    else { status = 'Good'; barColor = 'bg-green-600'; textColor = 'text-green-700'; }
  }

  const activeSource = pumpActive ? 'Pump running' : solenoidActive ? 'Solenoid open' : 'Idle';

  return (
    <div className="rounded-md p-4 border-[0.5px] border-border bg-bg-secondary">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-sm flex items-center justify-center text-sm bg-blue-50 text-blue-700 flex-shrink-0">
            <i className="ti ti-glass-full" aria-hidden="true" />
          </div>
          <div className="text-xs text-text-secondary leading-tight">Water tank level</div>
        </div>
        <span className={`text-xs font-medium ${textColor}`}>{status}</span>
      </div>

      <div className="flex items-end gap-2 mb-2.5">
        <div className="text-2xl font-medium leading-[1.1] text-text-primary">
          {hasReading ? pct : '—'}
          {hasReading && <span className="text-sm text-text-secondary ml-0.5 font-normal">%</span>}
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden mb-2.5">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
          style={{ width: `${hasReading ? pct : 0}%` }}
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pumpActive || solenoidActive ? 'bg-green-600 animate-pulse-dot' : 'bg-gray-400'}`} />
        {activeSource}
      </div>
    </div>
  );
};

const RecommendationCard = ({ rec }) => {
  const tone = recTone[rec.severity] || recTone.low;
  return (
    <div className={`border rounded-md p-3.5 ${tone.border} ${tone.bg}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${tone.badge}`}>
            {rec.severity === 'ok' ? 'Good' : rec.severity}
          </span>
          <span className="text-sm font-medium text-text-primary">{rec.category}</span>
        </div>
        {rec.reading && <span className="text-sm font-semibold text-text-primary flex-shrink-0">{rec.reading}</span>}
      </div>
      <p className="text-sm text-text-secondary leading-snug">{rec.message}</p>
      {rec.fix && (
        <p className="text-sm mt-2 leading-snug">
          <span className="font-medium text-text-primary">Fix: </span>
          <span className="text-text-secondary">{rec.fix}</span>
        </p>
      )}
      {rec.diyTip && (
        <div className="text-sm mt-1.5 leading-snug bg-green-50/70 border border-green-100 rounded px-2.5 py-1.5">
          <span className="font-medium text-green-800">DIY option: </span>
          <span className="text-green-900/80">{rec.diyTip}</span>
        </div>
      )}
    </div>
  );
};

const OfflineReadingsPage = () => {
  const { logout, user } = useAuth();
  const [reading, setReading] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Initial load — last known reading, straight from memory (no DB).
  useEffect(() => {
    const token = localStorage.getItem('halamanhub_token');
    fetch(`${API_BASE}/sensor-data/live`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('No reading received yet.');
        return res.json();
      })
      .then((data) => {
        setReading(data);
        setLastUpdated(data.recordedAt);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Live updates as they stream in over USB serial / WiFi.
  useEffect(() => {
    const handleReading = (data) => {
      setReading(data);
      setLastUpdated(data.recordedAt || new Date().toISOString());
      setError(null);
    };
    socket.on('sensor:reading', handleReading);
    return () => socket.off('sensor:reading', handleReading);
  }, []);

  const soil = reading?.soil || {};
  const air = reading?.air || {};
  const watering = reading?.watering || {};
  const water = reading?.water || {};
  const waterQuality = getWaterQualityCategory(water.tds ?? null);
  const waterPhStatus = getPhStatus(water.ph ?? null);
  const tankStatus3Info = getTankStatusInfo(water.tankStatus ?? null);

  const recommendations = useMemo(() => {
    if (!reading) return [];
    const recs = getSoilRecommendations({
      ph: soil.ph,
      ec: soil.ec,
      nitrogen: soil.nitrogen,
      phosphorus: soil.phosphorus,
      potassium: soil.potassium,
      temperature: air.temperature,
      humidity: air.humidity,
    });
    // Most actionable first — an operator scanning this list should see
    // what needs attention before what's already fine.
    return [...recs].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  const actionableCount = recommendations.filter(r => r.severity === 'high' || r.severity === 'medium').length;

  return (
    <div className="min-h-screen bg-bg-tertiary">
      {/* Header — deliberately its own bar (not the main TopBar) so it's
          visually obvious this is a restricted, single-purpose session. */}
      <div className="bg-bg-primary border-b-[0.5px] border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.jpg" alt="Mapili Plant Nursery logo" className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-medium text-text-primary truncate">Live Sensor Readings</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-amber-50 text-amber-800 flex-shrink-0">
                  <i className="ti ti-plug-connected-x text-[11px]" aria-hidden="true" />
                  Offline mode
                </span>
              </div>
              <p className="text-xs text-text-secondary truncate">
                {user?.name || 'Offline Viewer'} · read-only · ESP32 direct
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md border-[0.5px] border-border flex-shrink-0"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-7">
        {/* Connection status */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${reading ? 'bg-green-500 animate-pulse-dot' : 'bg-gray-300'}`} />
          <span className="text-text-secondary">
            {reading
              ? `Last updated ${new Date(lastUpdated).toLocaleTimeString()}`
              : error || 'Waiting for the first reading…'}
          </span>
        </div>

        {/* Soil nutrients — the primary reason this dashboard exists */}
        <section>
          <SectionHeading icon="ti-leaf" title="Soil Nutrients" subtitle="N-P-K, salinity & pH from the ESP32 probe" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard icon="ti-atom-2" label="Nitrogen (N)" value={soil.nitrogen} unit="mg/kg" emphasis />
            <MetricCard icon="ti-atom-2" label="Phosphorus (P)" value={soil.phosphorus} unit="mg/kg" emphasis />
            <MetricCard icon="ti-atom-2" label="Potassium (K)" value={soil.potassium} unit="mg/kg" emphasis />
            <MetricCard icon="ti-bolt" label="EC (salinity)" value={soil.ec} unit="uS/cm" />
            <MetricCard icon="ti-flask" label="pH" value={soil.ph} unit="" />
            <MetricCard icon="ti-droplet" label="Soil moisture" value={soil.moisture} unit="%" />
          </div>
        </section>

        {/* Environment — secondary context, smaller visual weight */}
        <section>
          <SectionHeading icon="ti-cloud" title="Environment" subtitle="Air & soil conditions around the sensor" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard icon="ti-thermometer" label="Soil temperature" value={soil.temperature} unit="°C" />
            <MetricCard icon="ti-temperature" label="Air temperature" value={air.temperature} unit="°C" />
            <MetricCard icon="ti-cloud" label="Air humidity" value={air.humidity} unit="%" />
          </div>
        </section>

        {/* Water — irrigation tank (ultrasonic) + rainwater quality (TDS/pH/float switches) */}
        <section>
          <SectionHeading icon="ti-glass-full" title="Water Level Monitor" subtitle="Tank status & active irrigation source" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <WaterTankCard
              levelPercent={watering.levelPercent}
              pumpActive={watering.pumpActive}
              solenoidActive={watering.solenoidActive}
            />
            <div className="rounded-md p-4 border-[0.5px] border-border bg-bg-secondary flex flex-col justify-center">
              <div className="text-xs text-text-secondary mb-1">Water availability</div>
              <div className="text-sm text-text-primary leading-snug">
                {watering.levelPercent != null
                  ? watering.levelPercent <= 15
                    ? 'Tank is critically low. Irrigation may pause automatically until refilled.'
                    : watering.levelPercent <= 35
                    ? 'Tank is running low — plan a refill soon.'
                    : 'Tank level is healthy — no action needed.'
                  : 'No water level reading yet.'}
              </div>
            </div>
          </div>
        </section>

        {/* Rainwater Harvesting — TDS, pH, 3-state float-switch tank level */}
        <section>
          <SectionHeading icon="ti-droplet" title="Rainwater Quality" subtitle="TDS, pH & float-switch tank level" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md p-4 border-[0.5px] border-border bg-bg-secondary">
              <div className="text-xs text-text-secondary mb-2">Water quality (TDS)</div>
              <div className="text-2xl font-medium text-text-primary leading-tight">
                {water.tds != null ? Math.round(water.tds) : '—'}
                {water.tds != null && <span className="text-sm text-text-secondary ml-1 font-normal">ppm</span>}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${
                waterQuality.tone === 'ok' ? 'bg-green-50 text-green-800' :
                waterQuality.tone === 'warning' ? 'bg-amber-50 text-amber-800' :
                waterQuality.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-bg-tertiary text-text-secondary'
              }`}>
                {waterQuality.label}
              </span>
            </div>

            <div className="rounded-md p-4 border-[0.5px] border-border bg-bg-secondary">
              <div className="text-xs text-text-secondary mb-2">Water pH</div>
              <div className="text-2xl font-medium text-text-primary leading-tight">
                {water.ph != null ? water.ph.toFixed(2) : '—'}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${
                waterPhStatus.tone === 'ok' ? 'bg-green-50 text-green-800' :
                waterPhStatus.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-bg-tertiary text-text-secondary'
              }`}>
                {waterPhStatus.label}
              </span>
            </div>

            <div className="rounded-md p-4 border-[0.5px] border-border bg-bg-secondary">
              <div className="text-xs text-text-secondary mb-2">Tank level (3-state)</div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${
                tankStatus3Info.tone === 'ok' ? 'bg-green-50 text-green-800' :
                tankStatus3Info.tone === 'warning' ? 'bg-amber-50 text-amber-800' :
                tankStatus3Info.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-bg-tertiary text-text-secondary'
              }`}>
                {tankStatus3Info.label}
              </span>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2.5 flex-1 rounded-full ${
                      tankStatus3Info.step >= step
                        ? step === 3 ? 'bg-green-600' : step === 2 ? 'bg-amber-500' : 'bg-red-500'
                        : 'bg-bg-tertiary'
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-text-secondary mt-1.5">
                <span>Low</span><span>Medium</span><span>Full</span>
              </div>
            </div>
          </div>
        </section>

        {/* Recommendations — the most actionable content, so it gets a
            header badge showing how many items need attention. */}
        {recommendations.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionHeading icon="ti-bulb" title="Soil & Environment Recommendations" subtitle="Fertilizer guidance based on current readings" />
              {actionableCount > 0 && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-800 flex-shrink-0">
                  {actionableCount} need{actionableCount === 1 ? 's' : ''} attention
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map((rec, idx) => (
                <RecommendationCard key={idx} rec={rec} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default OfflineReadingsPage;