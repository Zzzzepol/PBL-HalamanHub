// Read-only device readings stay outside MainLayout and do not call the database API.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BigStat, Button, StatusBadge } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { socket } from '../socket';
import { getSoilRecommendations } from '../utils/soilRecommendations';
import { getWaterQualityCategory, getTankStatusInfo, getWaterQualityRecommendation } from '../utils/waterQuality';
import { timeAgo } from '../utils/timeAgo';
import { formatTankDistance } from '../utils/tankDistance';

const PAGE_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_HOST = /^(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[a-z0-9-]+\.local)$/i.test(PAGE_HOST) ? PAGE_HOST : 'localhost';
const API_BASE = process.env.REACT_APP_API_URL || `http://${API_HOST}:4000/api`;
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, ok: 3 };
const statusFromSeverity = severity => ({ high: 'action', medium: 'check', low: 'check', ok: 'good' }[severity] || 'none');
const friendlyCategory = (category = '') => category
  .replace(/Soil Salinity \(EC\)|Soil EC/gi, 'Soil salt level (EC)')
  .replace(/Soil pH/gi, 'Soil acidity (pH)')
  .replace(/Nitrogen \(N\)|Phosphorus \(P\)|Potassium \(K\)/gi, match => `Plant food (${match.slice(-2, -1)})`)
  .replace(/Water Quality \(TDS\)/gi, 'Water purity (TDS)');

const OfflineReadingsPage = () => {
  const { logout, user } = useAuth();
  const [reading, setReading] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadReading = useCallback(() => {
    setLoading(true); setError(false);
    const token = localStorage.getItem('halamanhub_token');
    fetch(`${API_BASE}/sensor-data/live`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(response => { if (!response.ok) throw new Error('no-reading'); return response.json(); })
      .then(data => { setReading(data); setLastUpdated(data.recordedAt); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadReading(); }, [loadReading]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const handleReading = data => { setReading(data); setLastUpdated(data.recordedAt || new Date().toISOString()); setError(false); };
    socket.on('sensor:reading', handleReading);
    return () => socket.off('sensor:reading', handleReading);
  }, []);

  const soil = reading?.soil || {};
  const air = reading?.air || {};
  const watering = reading?.watering || {};
  const water = reading?.water || {};
  const readingAt = reading?.recordedAt ? new Date(reading.recordedAt).getTime() : NaN;
  const deviceOnline = Number.isFinite(readingAt) && now - readingAt <= 15000;
  const soilReadingValid = deviceOnline && watering.soilReadingValid !== false;
  const tankReadingValid = deviceOnline && watering.tankReadingValid !== false;
  const airReadingValid = deviceOnline && air.readingValid !== false;
  const tankTds = deviceOnline ? water.tds ?? null : null;
  const waterQuality = getWaterQualityCategory(tankTds);
  const tankStatus = getTankStatusInfo(water.tankStatus ?? null);
  const recommendations = useMemo(() => {
    if (!reading || !soilReadingValid) return [];
    const items = getSoilRecommendations({ ph: soil.ph, ec: soil.ec, nitrogen: soil.nitrogen, phosphorus: soil.phosphorus, potassium: soil.potassium, temperature: airReadingValid ? air.temperature : null, humidity: airReadingValid ? air.humidity : null });
    if (deviceOnline && water.tds != null) items.push(getWaterQualityRecommendation(water.tds));
    return items.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
    // The recommendation functions are pure and always read from this latest snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, deviceOnline, soilReadingValid, tankReadingValid, airReadingValid]);

  const needsAction = recommendations.filter(item => item.severity === 'high').length;
  const needsCheck = recommendations.filter(item => item.severity === 'medium').length;
  const hasReadings = Boolean(reading && ((soilReadingValid && soil.moisture != null) || (tankReadingValid && formatTankDistance(watering.distanceCm) != null) || (airReadingValid && air.temperature != null)));
  const overallStatus = !hasReadings ? 'none' : needsAction ? 'action' : needsCheck ? 'check' : 'good';
  const wateringNow = Boolean(deviceOnline && (watering.pumpActive || watering.solenoidActive));

  return (
    <div className="min-h-screen bg-bg-tertiary">
      <header className="border-b border-border bg-bg-primary">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><img src="/logo.jpg" alt="Mapili Plant Nursery" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" /><div className="min-w-0"><h1 className="truncate text-lg font-semibold text-text-primary">Plant and water readings</h1><p className="text-sm text-text-secondary">Read-only view · {user?.name || 'Offline viewer'}</p></div></div>
          <Button variant="default" onClick={logout}>Log out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 pb-8 sm:px-6">
        <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><i className="ti ti-info-circle mt-0.5" aria-hidden="true" />No internet. Showing live readings from the device.</p>
        {reading?.monitoringLocation && <p className="rounded-xl border border-border bg-white p-3 text-sm text-text-secondary"><strong className="text-text-primary">Monitoring area:</strong> {reading.monitoringLocation}{reading.monitoredPlantNames?.length ? ` · shared sample for ${reading.monitoredPlantNames.join(', ')}` : ''}</p>}
        {reading?.bufferDroppedSamples > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">The device buffer filled during a local connection gap. {reading.bufferDroppedSamples} readings were skipped since the ESP32 last restarted.</p>}
        {reading?.bufferRestartLossCount > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">The ESP32 restarted with unsent readings {reading.bufferRestartLossCount} time{reading.bufferRestartLossCount === 1 ? '' : 's'}; history may have gaps.</p>}
        {reading && !deviceOnline && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">No recent reading from the device. Check its USB cable and the laptop gateway.</p>}
        {reading && (!soilReadingValid || !tankReadingValid || !airReadingValid) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">{!soilReadingValid || !tankReadingValid ? `${!soilReadingValid && !tankReadingValid ? 'Soil and tank readings have not updated.' : !soilReadingValid ? 'The soil reading has not updated.' : 'The tank reading has not updated.'} Watering is paused for safety.${!airReadingValid ? ' The air reading also needs attention.' : ''}` : 'The air reading has not updated. Soil and tank readings are still available.'}</p>}
        <section className={`rounded-2xl border p-4 ${overallStatus === 'action' ? 'border-red-200 bg-red-50' : overallStatus === 'check' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`} aria-live="polite">
          <div className="flex items-start gap-3"><i className={`ti ${overallStatus === 'action' ? 'ti-alert-circle text-red-700' : overallStatus === 'check' ? 'ti-alert-triangle text-amber-800' : overallStatus === 'none' ? 'ti-hourglass text-gray-700' : 'ti-circle-check text-green-800'} mt-0.5 text-xl`} aria-hidden="true" /><div><h2 className="font-semibold text-text-primary">{!hasReadings ? 'Waiting for a reading.' : needsAction ? `${needsAction} thing${needsAction === 1 ? '' : 's'} need your attention.` : needsCheck ? 'A few readings are worth checking soon.' : 'Your plants look healthy.'}</h2><p className="mt-1 text-sm text-text-secondary">{needsAction || needsCheck ? 'See the next steps below.' : 'This screen updates when the device sends a new reading.'}</p></div></div>
        </section>

        {error && !reading && <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center"><p className="flex-1 text-sm text-text-secondary">No reading has arrived yet. Check the device connection, then try again.</p><Button onClick={loadReading} icon="ti-refresh">Try again</Button></div>}
        {loading && !reading && <div className="rounded-xl border border-border bg-white p-4 text-sm text-text-secondary" role="status">Loading the latest reading…</div>}

        <section aria-label="Key readings">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <BigStat icon="ti-droplet" label="Soil wetness" value={!soilReadingValid ? 'Not updated' : soil.moisture ?? '—'} unit={soilReadingValid && soil.moisture != null ? '%' : ''} status={!soilReadingValid ? 'check' : soil.moisture == null ? 'none' : 'good'} />
            <BigStat icon="ti-glass-full" label="Distance to water" value={!tankReadingValid ? 'Not updated' : formatTankDistance(watering.distanceCm) ?? '—'} status={!tankReadingValid ? 'check' : formatTankDistance(watering.distanceCm) == null ? 'none' : statusFromSeverity(tankStatus.tone === 'ok' ? 'ok' : tankStatus.tone === 'warning' ? 'medium' : tankStatus.tone === 'error' ? 'high' : 'low')} />
            <BigStat icon="ti-droplet" label="Watering now" value={!deviceOnline ? 'No signal' : wateringNow ? 'On' : 'Off'} status={!deviceOnline ? 'none' : 'good'} />
            <BigStat icon="ti-temperature" label="Temperature & humidity" value={!airReadingValid ? 'Not updated' : `${air.temperature ?? '—'}${air.temperature != null ? '°C' : ''} · ${air.humidity ?? '—'}${air.humidity != null ? '%' : ''}`} status={!airReadingValid ? 'check' : air.temperature == null && air.humidity == null ? 'none' : 'good'} />
          </div>
          <p className="mt-2 text-sm text-text-secondary">Last updated {timeAgo(lastUpdated)}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">What to do</h2>
          {recommendations.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{recommendations.slice(0, 4).map((item, index) => <article key={`${item.category}-${index}`} className="rounded-xl border border-border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold text-text-primary">{friendlyCategory(item.category)}</h3><StatusBadge status={statusFromSeverity(item.severity)} /></div>{item.reading && <p className="mt-1 text-sm font-medium text-text-primary">{item.reading.replace('uS/cm', 'µS/cm')}</p>}<p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.message}</p>{item.fix && <p className="mt-2 text-sm text-text-primary"><strong>Try this:</strong> {item.fix}</p>}</article>)}</div> : <p className="rounded-xl border border-border bg-white p-4 text-sm text-text-secondary">New advice will appear when readings arrive.</p>}
        </section>

        <details className="rounded-xl border border-border bg-white">
          <summary className="min-h-12 cursor-pointer px-4 py-3 font-semibold text-text-primary">Show more details</summary>
          <div className="space-y-5 border-t border-border p-4">
            <section><h2 className="mb-3 font-semibold text-text-primary">Plant food levels (N, P, K)</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[['Nitrogen (N)', soil.nitrogen], ['Phosphorus (P)', soil.phosphorus], ['Potassium (K)', soil.potassium]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-bg-secondary p-4"><p className="text-sm text-text-secondary">{label}</p><p className="mt-1 text-lg font-semibold text-text-primary">{soilReadingValid ? value ?? '—' : 'Not updated'}{soilReadingValid && value != null ? ' mg/kg' : ''}</p></div>)}</div></section>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><h2 className="font-medium text-text-primary">Soil salt level (EC)</h2><p className="mt-1 text-lg font-semibold">{soilReadingValid ? `${soil.ec ?? '—'}${soil.ec != null ? ' µS/cm' : ''}` : 'Not updated'}</p></div><div className="rounded-xl border border-border p-4"><h2 className="font-medium text-text-primary">Soil acidity (pH)</h2><p className="mt-1 text-lg font-semibold">{soilReadingValid ? soil.ph ?? '—' : 'Not updated'}</p></div></section>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><h2 className="font-medium text-text-primary">Water purity (TDS)</h2><p className="mt-1 text-lg font-semibold">{tankTds != null ? `${Math.round(tankTds)} ppm` : '—'}</p><StatusBadge className="mt-2" status={tankTds == null ? 'none' : waterQuality.tone === 'ok' ? 'good' : waterQuality.tone === 'warning' ? 'check' : 'action'} /></div><div className="rounded-xl border border-border p-4"><h2 className="font-medium text-text-primary">Tank level</h2><div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={!tankReadingValid ? 'none' : tankStatus.tone === 'ok' ? 'good' : tankStatus.tone === 'warning' ? 'check' : tankStatus.tone === 'error' ? 'action' : 'none'} /><span className="text-sm text-text-secondary">Level: {tankReadingValid ? tankStatus.label : 'No fresh reading'}</span></div><div className="mt-3 flex gap-1.5" aria-label={`Tank level: ${tankReadingValid ? tankStatus.label : 'No fresh reading'}`}>{[1, 2, 3].map(step => <span key={step} className={`h-2 flex-1 rounded-full ${tankReadingValid && tankStatus.step >= step ? step === 3 ? 'bg-green-700' : step === 2 ? 'bg-amber-600' : 'bg-red-700' : 'bg-gray-200'}`} />)}</div></div></section>
            <section><h2 className="mb-3 font-semibold text-text-primary">Air conditions</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border p-4"><p className="text-sm text-text-secondary">Soil temperature</p><p className="mt-1 font-semibold">{soilReadingValid ? `${soil.temperature ?? '—'}${soil.temperature != null ? '°C' : ''}` : 'Not updated'}</p></div><div className="rounded-xl border border-border p-4"><p className="text-sm text-text-secondary">Air temperature</p><p className="mt-1 font-semibold">{airReadingValid ? `${air.temperature ?? '—'}${air.temperature != null ? '°C' : ''}` : 'Not updated'}</p></div><div className="rounded-xl border border-border p-4"><p className="text-sm text-text-secondary">Air humidity</p><p className="mt-1 font-semibold">{airReadingValid ? `${air.humidity ?? '—'}${air.humidity != null ? '%' : ''}` : 'Not updated'}</p></div></div></section>
          </div>
        </details>
      </main>
    </div>
  );
};

export default OfflineReadingsPage;
