import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigStat, Button, Card, CardBody, CardHeader, ErrorState, StatusBadge } from '../components/ui/UI';
import { MoistureTrendChart } from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { dashboardApi, sensorsApi, alertsApi } from '../api/client';
import { useLiveRefetch } from '../hooks/useLiveRefetch';
import { timeAgo } from '../utils/timeAgo';

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
const severityOrder = { high: 0, medium: 1, low: 2, ok: 3 };
const statusFromTone = (tone) => ({ ok: 'good', warning: 'check', error: 'action', offline: 'none', default: 'none' }[tone] || 'none');
const statusFromSeverity = severity => ({ high: 'action', medium: 'check', low: 'check', ok: 'good' }[severity] || 'none');
const statusLabel = status => ({ good: 'Good', check: 'Check soon', action: 'Needs action', none: 'No data' }[status] || 'No data');
const friendlyCategory = (category = '') => category
  .replace(/Soil Salinity \(EC\)|Soil EC|EC level/gi, 'Soil salt level (EC)')
  .replace(/Soil pH|pH level/gi, 'Soil acidity (pH)')
  .replace(/Nitrogen \(N\)|Phosphorus \(P\)|Potassium \(K\)/gi, match => `Plant food (${match.slice(-2, -1)})`)
  .replace(/Water Quality \(TDS\)/gi, 'Water purity (TDS)');
const hasPlantReading = plant => (plant.recommendations || []).some(item => item.category !== 'General' && item.reading != null);
const plantStatus = plant => {
  if (!hasPlantReading(plant)) return 'none';
  return plant.status === 'high' ? 'action' : plant.status === 'medium' ? 'check' : 'good';
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('24h');
  const [selectedPlant, setSelectedPlant] = useState(null);
  const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary, [], 30000);
  const { data: alerts } = useApiData(alertsApi.getAll, [4], 15000);
  const { data: history } = useApiData((token) => sensorsApi.getHistory(token, RANGE_HOURS[range]), [range], 20000);
  useLiveRefetch(['sensor:reading', 'sensor:status'], refetchSummary);

  const trend = useMemo(() => {
    const points = history || [];
    return {
      labels: points.map(point => new Date(point.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      values: points.map(point => point.soilMoisture ?? null),
    };
  }, [history]);

  const recommendations = [...(summary?.recommendations || [])].sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));
  const plantRecommendations = summary?.plantRecommendations || [];
  const plantsNeedingAction = plantRecommendations.filter(plant => plantStatus(plant) === 'action').length;
  const plantsToCheck = plantRecommendations.filter(plant => plantStatus(plant) === 'check').length;
  const needsAction = recommendations.filter(item => item.severity === 'high');
  const needsCheck = recommendations.filter(item => item.severity === 'medium');
  const noSignal = [summary?.soilMoisture?.status, summary?.npk?.status, summary?.pH?.status, summary?.ec?.status, summary?.waterTank?.status]
    .some(status => status === 'offline');
  const tankStatus = statusFromTone(summary?.waterTank?.tankStatus3Info?.tone || summary?.waterTank?.status);
  const irrigation = summary?.irrigation;
  const wateringActive = Boolean(irrigation?.pumpActive || irrigation?.solenoidActive);
  const hasReadings = summary?.soilMoisture?.value != null || summary?.npk?.nitrogen != null || summary?.pH?.value != null || summary?.ec?.value != null;
  const hasAction = needsAction.length > 0 || plantsNeedingAction > 0;
  const hasCheck = needsCheck.length > 0 || plantsToCheck > 0;
  const bannerStatus = !hasReadings ? 'none' : hasAction ? 'action' : hasCheck ? 'check' : 'good';
  const bannerMessage = !hasReadings ? 'Waiting for soil readings.'
    : plantsNeedingAction > 0 ? `${plantsNeedingAction} plant${plantsNeedingAction === 1 ? '' : 's'} need attention.`
      : needsAction.length > 0 ? 'Some soil readings need attention.'
        : plantsToCheck > 0 ? `${plantsToCheck} plant${plantsToCheck === 1 ? '' : 's'} to check soon.`
          : needsCheck.length > 0 ? 'Some soil readings are worth checking soon.' : 'Soil readings look good.';
  const soilMetrics = [
    { label: 'Soil wetness', value: summary?.soilMoisture?.value, unit: '%', icon: 'ti-droplet', sensorStatus: summary?.soilMoisture?.status, match: /soil moisture|soil wetness/i },
    { label: 'Nitrogen (N)', value: summary?.npk?.nitrogen, unit: 'mg/kg', icon: 'ti-seeding', sensorStatus: summary?.npk?.status, match: /nitrogen/i },
    { label: 'Phosphorus (P)', value: summary?.npk?.phosphorus, unit: 'mg/kg', icon: 'ti-seeding', sensorStatus: summary?.npk?.status, match: /phosphorus/i },
    { label: 'Potassium (K)', value: summary?.npk?.potassium, unit: 'mg/kg', icon: 'ti-seeding', sensorStatus: summary?.npk?.status, match: /potassium/i },
    { label: 'Soil acidity (pH)', value: summary?.pH?.value, unit: '', icon: 'ti-flask', sensorStatus: summary?.pH?.status, match: /soil ph|ph level/i },
    { label: 'Soil salt (EC)', value: summary?.ec?.value, unit: 'µS/cm', icon: 'ti-test-pipe', sensorStatus: summary?.ec?.status, match: /soil salinity|soil ec|ec level/i },
  ].map(metric => {
    const finding = summary?.recommendations?.find(item => metric.match.test(item.category));
    const status = metric.value == null || metric.sensorStatus === 'offline' ? 'none' : finding ? statusFromSeverity(finding.severity) : statusFromTone(metric.sensorStatus);
    const label = metric.value == null ? 'No data' : metric.sensorStatus === 'offline' ? 'No signal' : finding ? statusLabel(status) : 'Reading available';
    return { ...metric, finding, status, statusText: label };
  });
  const orderedPlants = [...plantRecommendations].sort((a, b) => ({ action: 0, check: 1, none: 2, good: 3 }[plantStatus(a)] - ({ action: 0, check: 1, none: 2, good: 3 }[plantStatus(b)])));

  return (
    <div className="space-y-5">
      {summaryError && !summary && <ErrorState onRetry={refetchSummary} description="Check the connection, then try loading your readings again." />}

      <section className={`rounded-2xl border p-4 sm:p-5 ${bannerStatus === 'action' ? 'border-red-200 bg-red-50' : bannerStatus === 'check' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`} aria-live="polite">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <i className={`ti ${bannerStatus === 'action' ? 'ti-alert-circle text-red-700' : bannerStatus === 'check' ? 'ti-alert-triangle text-amber-800' : bannerStatus === 'none' ? 'ti-hourglass text-gray-600' : 'ti-circle-check text-green-800'} mt-0.5 text-base`} aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{bannerMessage}</h2>
              <p className="mt-0.5 text-sm text-text-secondary">
                {summaryError ? 'Some readings may be out of date.' : noSignal ? 'No signal from one or more sensors. Check the sensor list for details.' : 'Here is the latest from your nursery.'}
              </p>
            </div>
          </div>
          <Button variant={bannerStatus === 'action' ? 'danger' : 'primary'} onClick={() => document.getElementById(plantsNeedingAction || plantsToCheck ? 'your-plants-title' : 'soil-monitoring')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {plantsNeedingAction || plantsToCheck ? 'Review plant checks' : 'View soil readings'}
          </Button>
        </div>
      </section>

      {noSignal && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-text-secondary" role="status">
          <i className="ti ti-wifi-off mt-0.5 text-base" aria-hidden="true" />
          <p>One or more sensors have no signal. The last reading is shown until they reconnect.</p>
          <Button className="ml-auto" size="sm" variant="ghost" onClick={() => navigate('/sensors')}>View sensors</Button>
        </div>
      )}

      <section id="soil-monitoring" aria-labelledby="soil-monitoring-title" className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="soil-monitoring-title" className="text-lg font-semibold text-text-primary">Soil monitoring</h2>
            <p className="text-sm text-text-secondary">The latest wetness and plant food readings from your nursery.</p>
          </div>
          <span className="text-sm text-text-secondary">Updated {timeAgo(irrigation?.lastUpdated)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {soilMetrics.map(metric => (
            <article key={metric.label} className={`min-w-0 rounded-xl border p-3 ${metric.status === 'action' ? 'border-red-200 bg-red-50/50' : metric.status === 'check' ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-white'}`}>
              <div className="flex min-h-9 items-start gap-1.5">
                <div className="flex min-w-0 items-start gap-1.5 text-sm font-medium leading-snug text-text-secondary">
                  <i className={`ti ${metric.icon} mt-0.5 text-sm text-green-800`} aria-hidden="true" />
                  <span>{metric.label}</span>
                </div>
              </div>
              <p className="mt-2 flex flex-wrap items-baseline gap-1 text-xl font-semibold leading-tight text-text-primary">
                <span>{metric.value ?? '—'}</span>{metric.unit && metric.value != null && <span className="text-xs font-medium text-text-secondary">{metric.unit}</span>}
              </p>
              <StatusBadge status={metric.status} label={metric.statusText} className="mt-2 !px-2 !py-1" />
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="your-plants-title" className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-green-100 bg-green-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <i className="ti ti-seeding text-base text-green-800" aria-hidden="true" />
              <h2 id="your-plants-title" className="text-lg font-semibold text-text-primary">Your plants</h2>
            </div>
            <p className="mt-1 text-sm text-text-secondary">Each plant is checked against its own soil targets using the latest nursery readings.</p>
          </div>
          {plantRecommendations.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-border bg-white px-3 py-1.5 font-medium text-text-primary">{plantRecommendations.length} plants</span>
              {plantsNeedingAction > 0 && <StatusBadge status="action" label={`${plantsNeedingAction} need attention`} />}
              {plantsToCheck > 0 && <StatusBadge status="check" label={`${plantsToCheck} to check`} />}
              {plantsNeedingAction === 0 && plantsToCheck === 0 && <StatusBadge status={plantRecommendations.some(plant => plantStatus(plant) === 'good') ? 'good' : 'none'} label={plantRecommendations.some(plant => plantStatus(plant) === 'good') ? 'Targets look good' : 'Waiting for readings'} />}
            </div>
          )}
        </div>

        {plantRecommendations.length ? (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 sm:p-4">
            {orderedPlants.map(plant => {
              const status = plantStatus(plant);
              const findings = plant.recommendations || [];
              const focusFinding = findings.find(item => item.severity === 'high' || item.severity === 'medium')
                || findings.find(item => item.category !== 'General' && item.reading != null);
              const readingItems = [
                { label: 'Nitrogen (N)', test: /nitrogen/i },
                { label: 'Phosphorus (P)', test: /phosphorus/i },
                { label: 'Potassium (K)', test: /potassium/i },
                { label: 'Soil acidity (pH)', test: /soil ph|ph level/i },
                { label: 'Soil salt (EC)', test: /soil salinity|soil ec|ec level/i },
              ].map(reading => ({ ...reading, item: findings.find(item => reading.test.test(item.category) && item.reading != null) }))
                .filter(reading => reading.item);
              const statusText = status === 'action' ? 'This plant needs attention.'
                : status === 'check' ? 'Check this plant’s soil soon.'
                  : status === 'good' ? 'Readings match this plant’s targets.'
                    : 'Waiting for soil readings.';
              return (
                <article key={plant._id} className={`rounded-xl border ${status === 'action' ? 'border-red-200 bg-red-50/40' : status === 'check' ? 'border-amber-200 bg-amber-50/40' : 'border-border bg-white'}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedPlant(plant)}
                    aria-label={`${plant.name}: ${statusText} Open plant soil checks.`}
                    className="flex w-full flex-col items-stretch rounded-xl p-3 text-left transition-colors hover:bg-bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        {plant.imageUrl ? <img src={plant.imageUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg border border-border object-cover" /> : <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-base text-green-800"><i className="ti ti-plant-2" aria-hidden="true" /></span>}
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-text-primary">{plant.name}</span><span className="mt-0.5 block truncate text-xs text-text-secondary">{plant.category || 'Plant'}</span></span>
                      </span>
                      <StatusBadge status={status} className="!px-2 !py-1" />
                    </span>
                    <span className="mt-3 text-sm font-medium text-text-primary">{statusText}</span>
                    {focusFinding && <span className="mt-1 text-xs text-text-secondary">First to check: {friendlyCategory(focusFinding.category)}</span>}
                    {readingItems.length ? (
                      <span className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {readingItems.map(({ label, item }) => {
                          const readingStatus = statusFromSeverity(item.severity);
                          return <span key={label} className="min-w-0 rounded-lg border border-border bg-white p-2">
                            <span className="block truncate text-xs text-text-secondary">{label}</span>
                            <span className="mt-0.5 block truncate text-sm font-semibold text-text-primary">{item.reading.replace('uS/cm', 'µS/cm')}</span>
                            <span className={`mt-1 inline-flex items-center gap-1 text-xs ${readingStatus === 'action' ? 'text-red-800' : readingStatus === 'check' ? 'text-amber-900' : readingStatus === 'good' ? 'text-green-800' : 'text-text-secondary'}`}>
                              <i className={`ti ${readingStatus === 'action' ? 'ti-alert-circle' : readingStatus === 'check' ? 'ti-alert-triangle' : readingStatus === 'good' ? 'ti-circle-check' : 'ti-minus'} text-xs`} aria-hidden="true" />
                              {statusLabel(readingStatus)}
                            </span>
                          </span>;
                        })}
                      </span>
                    ) : <span className="mt-2 text-xs text-text-secondary">No plant-specific readings yet.</span>}
                    <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-green-800">Open plant checks <i className="ti ti-arrow-right text-xs" aria-hidden="true" /></span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium text-text-primary">No plants to monitor yet.</p><p className="mt-1 text-sm text-text-secondary">Add plants to your product list to see their soil checks here.</p></div>
            <Button variant="outline" onClick={() => navigate('/products')}>Open products</Button>
          </div>
        )}
      </section>

      <section id="what-to-do" className="scroll-mt-24">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-text-primary">What to do</h2><p className="text-sm text-text-secondary">The most important things come first.</p></div>
          {recommendations.length > 0 && <StatusBadge status={bannerStatus} label={needsAction.length ? `${needsAction.length} need action` : needsCheck.length ? `${needsCheck.length} to check` : 'All looks good'} />}
        </div>
        {recommendations.length ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recommendations.slice(0, 4).map((item, index) => (
              <article key={`${item.category}-${index}`} className={`rounded-xl border p-4 ${item.severity === 'high' ? 'border-red-200 bg-red-50/70' : item.severity === 'medium' ? 'border-amber-200 bg-amber-50/60' : 'border-border bg-white'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-text-primary">{friendlyCategory(item.category)}</h3>
                <StatusBadge status={item.severity === 'high' ? 'action' : item.severity === 'medium' || item.severity === 'low' ? 'check' : item.severity === 'ok' ? 'good' : 'none'} />
                </div>
                {item.reading && <p className="mt-1 text-sm font-medium text-text-primary">{item.reading.replace('uS/cm', 'µS/cm')}</p>}
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.message}</p>
                {item.fix && <p className="mt-2 text-sm leading-relaxed text-text-primary"><strong>Try this:</strong> {item.fix}</p>}
                {item.diyTip && <details className="mt-2 text-sm text-text-secondary"><summary className="min-h-11 cursor-pointer py-2 font-medium text-green-800">See a simple option</summary><p className="pb-1">{item.diyTip}</p></details>}
              </article>
            ))}
          </div>
        ) : <p className="rounded-xl border border-border bg-white p-5 text-sm text-text-secondary">No recommendations yet. New advice will appear when readings arrive.</p>}
      </section>

      <section aria-labelledby="other-readings-title">
        <div className="mb-3"><h2 id="other-readings-title" className="text-lg font-semibold text-text-primary">Water and air</h2><p className="text-sm text-text-secondary">Other readings for your nursery.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <BigStat icon="ti-glass-full" label="Water tank" value={summary?.waterTank?.percent ?? summary?.waterTank?.tankStatus3Info?.label ?? '—'} unit={summary?.waterTank?.percent != null ? '%' : ''} status={tankStatus} />
          <BigStat icon="ti-droplet" label="Watering now" value={wateringActive ? 'On' : 'Off'} status={irrigation?.lastUpdated ? 'good' : 'none'} />
          <BigStat icon="ti-temperature" label="Temperature & humidity" value={`${summary?.temperature?.value ?? '—'}${summary?.temperature?.value != null ? '°C' : ''} · ${summary?.humidity?.value ?? '—'}${summary?.humidity?.value != null ? '%' : ''}`} status={statusFromTone(summary?.temperature?.status || summary?.humidity?.status)} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
          <span>Watering mode: <strong className="font-medium text-text-primary">{irrigation?.mode === 'manual' ? 'Manual' : irrigation?.mode === 'auto' ? 'Auto' : 'No data'}</strong></span>
        </div>
      </section>

      <Card>
        <CardHeader title="Soil wetness over time" subtitle="See how the soil has changed." actions={<div className="flex gap-1">{[['24h', 'Today'], ['7d', '7 days'], ['30d', '30 days']].map(([value, label]) => <Button key={value} size="sm" variant={range === value ? 'primary' : 'ghost'} onClick={() => setRange(value)}>{label}</Button>)}</div>} />
        <CardBody><MoistureTrendChart labels={trend.labels} values={trend.values} /></CardBody>
      </Card>

      <details className="rounded-xl border border-border bg-white">
        <summary className="min-h-12 cursor-pointer px-4 py-3 font-semibold text-text-primary">Show more details</summary>
        <div className="space-y-5 border-t border-border p-4">
          <section>
            <h3 className="mb-2 font-semibold text-text-primary">Recent activity</h3>
            {alerts?.length ? <ul className="space-y-2">{alerts.slice(0, 5).map(alert => <li key={alert._id} className="flex gap-3 text-sm"><i className={`ti ${alert.icon || 'ti-bell'} mt-0.5 text-green-800`} aria-hidden="true" /><span className="flex-1 text-text-primary">{alert.message}</span><time className="text-text-secondary">{timeAgo(alert.occurredAt)}</time></li>)}</ul> : <p className="text-sm text-text-secondary">No recent activity.</p>}
          </section>
        </div>
      </details>

      {selectedPlant && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4" onMouseDown={event => event.target === event.currentTarget && setSelectedPlant(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="plant-detail-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3"><div><h2 id="plant-detail-title" className="text-lg font-semibold text-text-primary">{selectedPlant.name}</h2><p className="text-sm text-text-secondary">{selectedPlant.category}</p></div><Button variant="ghost" aria-label="Close plant details" onClick={() => setSelectedPlant(null)}>Close</Button></div>
            <div className="mt-4 space-y-3">{(selectedPlant.recommendations || []).map((item, index) => {
              const status = item.severity === 'high' ? 'action' : item.severity === 'medium' ? 'check' : item.severity === 'ok' ? 'good' : 'none';
              const plainStatus = status === 'action' ? 'This reading is outside the target range and needs attention.' : status === 'check' ? 'This reading is a little outside the target range. Check it soon.' : status === 'good' ? 'This reading is within this plant’s target range.' : 'Waiting for a soil reading.';
              return <article key={`${item.category}-${index}`} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold text-text-primary">{friendlyCategory(item.category)}</h3><StatusBadge status={status} /></div>{item.reading && <p className="mt-1 text-base font-semibold text-text-primary">{item.reading.replace('uS/cm', 'µS/cm')}</p>}<p className="mt-2 text-sm text-text-secondary">{plainStatus}</p>{item.fix && <p className="mt-2 text-sm text-text-primary"><strong>Try this next:</strong> {item.fix}</p>}<details className="mt-2 text-sm text-text-secondary"><summary className="min-h-11 cursor-pointer py-2 font-medium text-green-800">More about this reading</summary><p className="pb-1">{item.message}</p>{item.diyTip && <p className="mt-2"><strong className="text-text-primary">Simple option:</strong> {item.diyTip}</p>}</details></article>;
            })}</div>
          </section>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
