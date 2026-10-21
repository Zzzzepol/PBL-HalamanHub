import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigStat, Button, Card, CardBody, CardHeader, ErrorState, StatusBadge } from '../components/ui/UI';
import { MoistureTrendChart } from '../components/charts/Charts';
import { useApiData } from '../hooks/useApiData';
import { dashboardApi, sensorsApi, alertsApi } from '../api/client';
import { useLiveRefetch } from '../hooks/useLiveRefetch';
import { timeAgo } from '../utils/timeAgo';
import { formatTankDistance } from '../utils/tankDistance';

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
const MAIN_DEFAULT_TARGETS = [
  {
    key: 'ph', label: 'Soil acidity (pH)', target: '6.5', range: '6.2–6.8', min: 6.2, max: 6.8, unit: '',
    read: summary => summary?.pH?.value,
    lowAdvice: 'Retest the soil, then check local crop guidance before adding lime.',
    highAdvice: 'Retest the soil, then check local crop guidance before trying to lower pH.',
  },
  {
    key: 'ec', label: 'Soil salt (EC)', target: '900 µS/cm', range: '750–1,050 µS/cm', min: 750, max: 1050, unit: 'µS/cm',
    read: summary => summary?.ec?.value,
    lowAdvice: 'Check the nutrient readings and retest before adding fertilizer.',
    highAdvice: 'Pause extra fertilizer salts. Retest before flushing the soil.',
  },
  {
    key: 'nitrogen', label: 'Nitrogen (N)', target: '50 mg/kg', range: '40–60 mg/kg', min: 40, max: 60, unit: 'mg/kg',
    read: summary => summary?.npk?.nitrogen,
    lowAdvice: 'Check crop guidance and the fertilizer label before changing the amount.',
    highAdvice: 'Pause extra nitrogen fertilizer and retest before adding more.',
  },
  {
    key: 'phosphorus', label: 'Phosphorus (P)', target: '30 mg/kg', range: '20–40 mg/kg', min: 20, max: 40, unit: 'mg/kg',
    read: summary => summary?.npk?.phosphorus,
    lowAdvice: 'Check crop guidance and the fertilizer label before changing the amount.',
    highAdvice: 'Pause extra phosphorus fertilizer and retest before adding more.',
  },
  {
    key: 'potassium', label: 'Potassium (K)', target: '140 mg/kg', range: '120–160 mg/kg', min: 120, max: 160, unit: 'mg/kg',
    read: summary => summary?.npk?.potassium,
    lowAdvice: 'Check crop guidance and the fertilizer label before changing the amount.',
    highAdvice: 'Pause extra potassium fertilizer and retest before adding more.',
  },
];
const formatTargetReading = value => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
const isDefaultTargetRecommendation = category => /soil\s*pH|pH\s*level|soil\s*(salinity|EC)|EC\s*level|nitrogen|phosphorus|potassium/i.test(category || '');
const hasPlantReading = plant => (plant.recommendations || []).some(item => item.category !== 'General' && item.reading != null);
const plantStatus = plant => {
  if (!hasPlantReading(plant)) return 'none';
  return plant.status === 'high' ? 'action' : plant.status === 'medium' ? 'check' : 'good';
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('24h');
  const [selectedPlant, setSelectedPlant] = useState(null);
  const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary, [], 30000, 'admin:dashboard-summary');
  const { data: alerts } = useApiData(alertsApi.getAll, [4], 15000);
  const activePlotId = summary?.monitoringStation?.activePlotId || '';
  const { data: historyResult } = useApiData(async (token) => ({
    plotId: activePlotId,
    range,
    rows: activePlotId ? await sensorsApi.getHistory(token, RANGE_HOURS[range], '', activePlotId) : [],
  }), [range, activePlotId], 20000);
  useLiveRefetch(['sensor:reading', 'sensor:status'], refetchSummary);

  const trend = useMemo(() => {
    const points = historyResult?.plotId === activePlotId && historyResult?.range === range ? historyResult.rows : [];
    return {
      labels: points.map(point => new Date(point.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      values: points.map(point => point.soilMoisture ?? null),
    };
  }, [historyResult, activePlotId, range]);

  const recommendations = [...(summary?.recommendations || [])].sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));
  const defaultTargetChecks = MAIN_DEFAULT_TARGETS.map(target => {
    const rawValue = target.read(summary);
    const sensorStatus = target.key === 'ph' ? summary?.pH?.status : target.key === 'ec' ? summary?.ec?.status : summary?.npk?.status;
    const value = rawValue == null || rawValue === '' || sensorStatus === 'offline' || sensorStatus === 'warning' ? null : Number(rawValue);
    const status = value == null || !Number.isFinite(value) ? 'none' : value < target.min || value > target.max ? 'check' : 'good';
    const advice = status !== 'check' ? '' : value < target.min ? target.lowAdvice : target.highAdvice;
    return { ...target, value: Number.isFinite(value) ? value : null, status, advice };
  });
  const defaultReadingsToCheck = defaultTargetChecks.filter(item => item.status === 'check').length;
  const temperatureHumidityRecommendations = recommendations.filter(item => /^(temperature|humidity)$/i.test(item.category || ''));
  const plantRecommendations = summary?.plantRecommendations || [];
  const monitoringStation = summary?.monitoringStation || { name: 'Main System', location: '', monitoredPlants: [] };
  const hasMonitoredPlants = monitoringStation.monitoredPlants?.length > 0;
  const plantsNeedingAction = plantRecommendations.filter(plant => plantStatus(plant) === 'action').length;
  const plantsToCheck = plantRecommendations.filter(plant => plantStatus(plant) === 'check').length;
  const otherSoilRecommendations = recommendations.filter(item => !isDefaultTargetRecommendation(item.category));
  const needsAction = otherSoilRecommendations.filter(item => item.severity === 'high');
  const needsCheck = otherSoilRecommendations.filter(item => item.severity === 'medium' || item.severity === 'low');
  const noSignal = [summary?.soilMoisture?.status, summary?.npk?.status, summary?.pH?.status, summary?.ec?.status, summary?.waterTank?.status, summary?.temperature?.status, summary?.humidity?.status]
    .some(status => status === 'offline' || status === 'warning');
  const tankStatus = statusFromTone(summary?.waterTank?.tankStatus3Info?.tone || summary?.waterTank?.status);
  const irrigation = summary?.irrigation;
  const wateringActive = Boolean(irrigation?.pumpActive || irrigation?.solenoidActive);
  const hasReadings = summary?.soilMoisture?.value != null || summary?.npk?.nitrogen != null || summary?.pH?.value != null || summary?.ec?.value != null;
  const hasAction = needsAction.length > 0 || plantsNeedingAction > 0;
  const hasCheck = needsCheck.length > 0 || defaultReadingsToCheck > 0 || plantsToCheck > 0;
  const bannerStatus = !hasReadings ? 'none' : hasAction ? 'action' : hasCheck ? 'check' : 'good';
  const bannerMessage = !hasReadings ? 'Waiting for soil readings.'
    : plantsNeedingAction > 0 ? `${plantsNeedingAction} plant${plantsNeedingAction === 1 ? '' : 's'} need attention.`
      : needsAction.length > 0 ? 'Some soil readings need attention.'
        : defaultReadingsToCheck > 0 ? 'Some general soil readings are outside their default ranges.'
        : plantsToCheck > 0 ? `${plantsToCheck} plant${plantsToCheck === 1 ? '' : 's'} to check soon.`
          : needsCheck.length > 0 ? 'Some soil readings are worth checking soon.'
            : !hasMonitoredPlants ? 'Choose which plants this soil probe represents.' : 'Soil readings look good.';
  const soilMetrics = [
    { label: 'Soil wetness', value: summary?.soilMoisture?.value, unit: '%', icon: 'ti-droplet', sensorStatus: summary?.soilMoisture?.status, match: /soil moisture|soil wetness/i },
    { label: 'Nitrogen (N)', value: summary?.npk?.nitrogen, unit: 'mg/kg', icon: 'ti-seeding', sensorStatus: summary?.npk?.status, targetKey: 'nitrogen', match: /nitrogen/i },
    { label: 'Phosphorus (P)', value: summary?.npk?.phosphorus, unit: 'mg/kg', icon: 'ti-seeding', sensorStatus: summary?.npk?.status, targetKey: 'phosphorus', match: /phosphorus/i },
    { label: 'Potassium (K)', value: summary?.npk?.potassium, unit: 'mg/kg', icon: 'ti-seeding', sensorStatus: summary?.npk?.status, targetKey: 'potassium', match: /potassium/i },
    { label: 'Soil acidity (pH)', value: summary?.pH?.value, unit: '', icon: 'ti-flask', sensorStatus: summary?.pH?.status, targetKey: 'ph', match: /soil ph|ph level/i },
    { label: 'Soil salt (EC)', value: summary?.ec?.value, unit: 'µS/cm', icon: 'ti-test-pipe', sensorStatus: summary?.ec?.status, targetKey: 'ec', match: /soil salinity|soil ec|ec level/i },
  ].map(metric => {
    const targetCheck = metric.targetKey ? defaultTargetChecks.find(item => item.key === metric.targetKey) : null;
    const finding = targetCheck ? null : summary?.recommendations?.find(item => metric.match.test(item.category));
    const status = targetCheck ? targetCheck.status : metric.value == null || metric.sensorStatus === 'offline' ? 'none' : finding ? statusFromSeverity(finding.severity) : statusFromTone(metric.sensorStatus);
    const label = metric.value == null ? 'No data' : metric.sensorStatus === 'offline' ? 'No signal' : targetCheck ? status === 'good' ? 'Within default range' : 'Check default range' : finding ? statusLabel(status) : 'Reading available';
    return { ...metric, finding, status, statusText: label };
  });
  const orderedPlants = [...plantRecommendations].sort((a, b) => ({ action: 0, check: 1, none: 2, good: 3 }[plantStatus(a)] - ({ action: 0, check: 1, none: 2, good: 3 }[plantStatus(b)])));

  return (
    <div className="space-y-5">
      {summaryError && !summary && <ErrorState onRetry={refetchSummary} description="Check the connection, then try loading your readings again." />}

      <section className={`rounded-2xl border p-4 sm:p-5 ${bannerStatus === 'action' ? 'border-red-200 bg-red-50' : bannerStatus === 'check' || (!hasMonitoredPlants && hasReadings) ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`} aria-live="polite">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <i className={`ti ${bannerStatus === 'action' ? 'ti-alert-circle text-red-700' : bannerStatus === 'check' ? 'ti-alert-triangle text-amber-800' : bannerStatus === 'none' ? 'ti-hourglass text-gray-600' : 'ti-circle-check text-green-800'} mt-0.5 text-base`} aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{bannerMessage}</h2>
              <p className="mt-0.5 text-sm text-text-secondary">
                {summaryError ? 'Some readings may be out of date.' : noSignal ? 'A reading is stale or a sensor needs checking. See sensor connections for details.' : 'Here is the latest from your nursery.'}
              </p>
            </div>
          </div>
          <Button variant={bannerStatus === 'action' ? 'danger' : 'primary'} onClick={() => !hasMonitoredPlants ? navigate('/growing-areas') : document.getElementById(plantsNeedingAction || plantsToCheck ? 'your-plants-title' : 'soil-monitoring')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {!hasMonitoredPlants ? 'Set up monitored plants' : plantsNeedingAction || plantsToCheck ? 'Review plant checks' : 'View soil readings'}
          </Button>
        </div>
      </section>

      {(noSignal || summary?.sensorBufferDrops > 0 || summary?.sensorBufferRestartLosses > 0) && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-text-secondary" role="status">
          <i className={`ti ${summary?.sensorBufferDrops > 0 || summary?.sensorBufferRestartLosses > 0 ? 'ti-history' : 'ti-wifi-off'} mt-0.5 text-base`} aria-hidden="true" />
          <p>{[
            noSignal ? 'One or more readings need attention. Values from stale sensors are hidden until they reconnect.' : '',
            summary?.sensorBufferDrops > 0 ? `${summary.sensorBufferDrops} readings were skipped after the ESP32 buffer filled.` : '',
            summary?.sensorBufferRestartLosses > 0 ? `The ESP32 restarted with unsent readings ${summary.sensorBufferRestartLosses} time${summary.sensorBufferRestartLosses === 1 ? '' : 's'}; history may have gaps.` : '',
          ].filter(Boolean).join(' ')}</p>
          <Button className="ml-auto" size="sm" variant="ghost" onClick={() => navigate('/sensors')}>View sensors</Button>
        </div>
      )}

      <section id="soil-monitoring" aria-labelledby="soil-monitoring-title" className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="soil-monitoring-title" className="text-lg font-semibold text-text-primary">Monitoring Plants</h2>
            <p className="text-sm text-text-secondary">One shared probe at {monitoringStation.location || 'your main growing area'} provides these readings.</p>
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
        {temperatureHumidityRecommendations.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-3 font-semibold text-text-primary">Temperature and humidity advice</h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {temperatureHumidityRecommendations.map((item, index) => (
                <article key={`${item.category}-${index}`} className={`rounded-xl border p-4 ${item.severity === 'high' ? 'border-red-200 bg-red-50/70' : item.severity === 'medium' ? 'border-amber-200 bg-amber-50/60' : 'border-border bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-semibold text-text-primary">{friendlyCategory(item.category)}</h4>
                    <StatusBadge status={item.severity === 'high' ? 'action' : item.severity === 'medium' || item.severity === 'low' ? 'check' : item.severity === 'ok' ? 'good' : 'none'} />
                  </div>
                  {item.reading && <p className="mt-1 text-sm font-medium text-text-primary">{item.reading}</p>}
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.message}</p>
                  {item.fix && <p className="mt-2 text-sm leading-relaxed text-text-primary"><strong>Try this:</strong> {item.fix}</p>}
                  {item.diyTip && <details className="mt-2 text-sm text-text-secondary"><summary className="min-h-11 cursor-pointer py-2 font-medium text-green-800">See a simple option</summary><p className="pb-1">{item.diyTip}</p></details>}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="your-plants-title" className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-green-100 bg-green-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <i className="ti ti-seeding text-base text-green-800" aria-hidden="true" />
              <h2 id="your-plants-title" className="text-lg font-semibold text-text-primary">Your plants</h2>
            </div>
            <p className="mt-1 text-sm text-text-secondary">The shared probe is assigned to {monitoringStation.location || 'the main growing area'}. These plants share its soil reading; each plant does not have a separate sensor.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" variant="default" onClick={() => navigate('/plant-profiles')}>Manage profiles</Button>
            <Button size="sm" variant="default" onClick={() => navigate('/growing-areas')}>View growing areas</Button>
            {plantRecommendations.length > 0 && (
              <>
              <span className="rounded-full border border-border bg-white px-3 py-1.5 font-medium text-text-primary">{plantRecommendations.length} plants</span>
              {plantsNeedingAction > 0 && <StatusBadge status="action" label={`${plantsNeedingAction} need attention`} />}
              {plantsToCheck > 0 && <StatusBadge status="check" label={`${plantsToCheck} to check`} />}
              {plantsNeedingAction === 0 && plantsToCheck === 0 && <StatusBadge status={plantRecommendations.some(plant => plantStatus(plant) === 'good') ? 'good' : 'none'} label={plantRecommendations.some(plant => plantStatus(plant) === 'good') ? 'Targets look good' : 'Waiting for readings'} />}
              </>
            )}
          </div>
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
                    ) : <span className="mt-2 text-xs text-text-secondary">No matching soil readings are available yet.</span>}
                    <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-green-800">Open plant checks <i className="ti ti-arrow-right text-xs" aria-hidden="true" /></span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium text-text-primary">No plants are assigned to this probe yet.</p><p className="mt-1 text-sm text-text-secondary">Choose which plant profiles grow here in Growing areas.</p></div>
            <Button variant="default" onClick={() => navigate('/growing-areas')}>Choose monitored plants</Button>
          </div>
        )}
      </section>

      <details className="group rounded-xl border border-border bg-white shadow-sm">
        <summary className="min-h-14 cursor-pointer px-4 py-3 text-base font-semibold text-text-primary marker:text-green-800">
          <span className="ml-1">Main Default Values</span>
          <span className="ml-2 text-sm font-normal text-text-secondary">General targets used for the shared soil readings</span>
        </summary>
        <div className="border-t border-border px-4 py-3">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(110px,0.8fr)_minmax(150px,1fr)] gap-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary sm:grid">
            <span>Value</span><span>Default target</span><span>Within target</span>
          </div>
          <div className="divide-y divide-border">
            {defaultTargetChecks.map(item => (
              <div key={item.key} className="grid grid-cols-1 gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(110px,0.8fr)_minmax(150px,1fr)] sm:items-center sm:gap-3">
                <span className="font-medium text-text-primary">{item.label}</span>
                <span className="text-text-secondary"><span className="sm:hidden">Default target: </span>{item.target}</span>
                <span className="text-text-secondary"><span className="sm:hidden">Within target: </span>{item.range}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">These are general ranges, not plant-specific targets. Check crop needs and soil-test results before making major changes.</p>
          <section aria-labelledby="default-checks-title" className="mt-5 border-t border-border pt-4">
            <div className="mb-3">
              <h3 id="default-checks-title" className="font-semibold text-text-primary">General soil checks</h3>
              <p className="mt-1 text-sm text-text-secondary">Each shared reading is compared with the default range above (Based on DA-BSWM FertMap Department Of Agriculture Philippines). These checks are not tied to a specific plant profile.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {defaultTargetChecks.map(item => (
                <article key={item.key} className={`rounded-xl border p-3 ${item.status === 'check' ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-semibold text-text-primary">{item.label}</h4>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">Current reading: <strong className="font-semibold text-text-primary">{item.value == null ? 'No data' : `${formatTargetReading(item.value)}${item.unit ? ` ${item.unit}` : ''}`}</strong></p>
                  <p className="mt-1 text-sm text-text-secondary">Default range: {item.range}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-primary">{item.status === 'none' ? 'Waiting for a fresh sensor reading.' : item.status === 'good' ? 'This reading is within the general default range.' : item.advice}</p>
                </article>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-text-secondary">Use this as a general guide. Soil needs vary by crop, growing stage, and test method; confirm major changes with a suitable soil test or local crop advice.</p>
          </section>
        </div>
      </details>

      <section aria-labelledby="other-readings-title">
        <div className="mb-3"><h2 id="other-readings-title" className="text-lg font-semibold text-text-primary">Water and air</h2><p className="text-sm text-text-secondary">Other readings for your nursery.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <BigStat icon="ti-glass-full" label="Distance to water" value={formatTankDistance(summary?.waterTank?.distanceCm) ?? '—'} status={tankStatus} />
          <BigStat icon="ti-droplet" label="Watering now" value={!irrigation?.deviceOnline ? 'No signal' : wateringActive ? 'On' : 'Off'} status={!irrigation?.deviceOnline ? 'none' : 'good'} />
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
