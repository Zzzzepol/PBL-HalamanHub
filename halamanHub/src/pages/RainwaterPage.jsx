import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardBody, StatCard, Badge, Button, RangeInput, StatusBadge, ErrorState } from '../components/ui/UI';
import { WaterLevelTrendChart } from '../components/charts/Charts';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { sensorsApi, dashboardApi, irrigationApi } from '../api/client';
import * as ps from './pageStyles';
import { useLiveRefetch } from '../hooks/useLiveRefetch';
import { getWaterQualityRecommendation } from '../utils/waterQuality';
import { timeAgo } from '../utils/timeAgo';

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

const recommendationTone = {
  high:   { card: 'border-red-200 bg-red-50/60',     badge: 'bg-red-100 text-red-800' },
  medium: { card: 'border-amber-200 bg-amber-50/60', badge: 'bg-amber-100 text-amber-800' },
  low:    { card: 'border-blue-200 bg-blue-50/60',   badge: 'bg-blue-100 text-blue-800' },
  ok:     { card: 'border-green-200 bg-green-50/60', badge: 'bg-green-100 text-green-800' },
};

const RainwaterPage = () => {
  const { token } = useAuth();
  const [range, setRange] = useState('24h');
  const hours = RANGE_HOURS[range];

const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary, [], 30000, 'admin:dashboard-summary');
  const { data: history, error: historyError, refetch: refetchHistory } =
    useApiData((t) => sensorsApi.getHistory(t, hours), [hours], 30000);
  const { data: settings, error: settingsError, refetch: refetchSettings, setData: setSettings } =
    useApiData(irrigationApi.getSettings, [], 30000);

  // real-time updates — throttling now lives inside useLiveRefetch, shared
  // across all admin pages instead of a page-local useRef/useEffect.
  useLiveRefetch(['sensor:reading', 'sensor:status'], () => {
    refetchSummary();
    refetchHistory();
  });

  const [emptyDist, setEmptyDist] = useState(100);
  const [fullDist, setFullDist] = useState(10);
  const [lowThreshold, setLowThreshold] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setEmptyDist(settings.tankEmptyDistanceCm);
      setFullDist(settings.tankFullDistanceCm);
      setLowThreshold(settings.tankLowThresholdPercent);
    }
  }, [settings]);

  const points = useMemo(() => history || [], [history]);

  const chart = useMemo(() => ({
    labels: points.map(p =>
      hours <= 24
        ? new Date(p.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(p.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    ),
    values: points.map(p => p.levelPercent ?? null),
  }), [points, hours]);

  const availablePct = useMemo(() => {
    if (points.length === 0) return null;
    const availableCount = points.filter(p => p.waterAvailable).length;
    return Math.round((availableCount / points.length) * 100);
  }, [points]);

  const saveCalibration = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await irrigationApi.updateSettings({
        tankEmptyDistanceCm: emptyDist,
        tankFullDistanceCm: fullDist,
        tankLowThresholdPercent: lowThreshold,
      }, token);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('We could not save the tank settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hasError = summaryError || historyError || settingsError;
  const waterRec = summary?.waterTank.waterQualityRecommendation
    || getWaterQualityRecommendation(summary?.waterTank.tds ?? null);
  const waterRecTone = recommendationTone[waterRec.severity] || recommendationTone.low;

  return (
    <div>
      {hasError && (
        <div className="mb-4"><ErrorState title="Rain tank information is not loading" description="Check your connection, then try again." onRetry={() => { refetchSummary(); refetchHistory(); refetchSettings(); }} /></div>
      )}

      {summary && !summary.irrigation?.deviceOnline && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">No recent reading from the ESP32. Water quality and tank values are hidden until it reconnects.</p>}
      {summary?.irrigation?.deviceOnline && !summary.irrigation?.tankReadingFresh && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">The tank level has not updated. Watering is paused for safety until a new reading arrives.</p>}

      <div className={`mb-4 rounded-xl border p-4 ${waterRec.severity === 'high' ? 'border-red-200 bg-red-50' : waterRec.severity === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`} aria-live="polite">
        <h2 className="font-semibold text-text-primary">{summary?.waterTank?.tds == null ? 'Waiting for a water reading.' : waterRec.severity === 'high' ? 'This water needs attention before use.' : waterRec.severity === 'medium' ? 'Check this water before using it on sensitive plants.' : 'This water is ready for plants.'}</h2>
        <p className="mt-1 text-sm text-text-secondary">{summary?.waterTank?.tds == null ? 'The latest tank and water status will appear here.' : waterRec.message}</p>
      </div>

      {/* Stats */}
      <div className={ps.grid.stats4}>
        <StatCard icon="ti-gauge" iconVariant="blue" value={summary?.waterTank.percent != null ? `${summary.waterTank.percent}%` : '—'} label="Tank level" />
        <StatCard icon="ti-chart-line" iconVariant="teal" value={availablePct != null ? `${availablePct}%` : '—'} label={`Water available (${range})`} />
        <StatCard icon="ti-clock" iconVariant="amber" value={timeAgo(summary?.irrigation?.lastUpdated)} label="Last updated" />
      </div>

      {/* Rainwater quality — TDS, pH, 3-state float-switch tank level */}
      <div className={ps.grid.twoCol}>
        <Card>
          <CardHeader title="Water purity (TDS)" subtitle="A simple measure of what is dissolved in the water." />
          <CardBody>
            <div className="text-[28px] font-medium text-text-primary leading-tight">
              {summary?.waterTank.tds != null ? `${summary.waterTank.tds.toFixed(0)}` : '—'}
              <span className="text-sm text-text-secondary ml-1 font-normal">ppm</span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <StatusBadge status={summary?.waterTank.waterQuality?.tone === 'ok' ? 'good' : summary?.waterTank.waterQuality?.tone === 'warning' ? 'check' : summary?.waterTank.waterQuality?.tone === 'error' ? 'action' : 'none'} />
              {summary?.waterTank.tds != null && summary?.waterTank.tdsStable === false && (
                <Badge variant="warning" title="This reading is changing quickly, so the last steady reading is shown.">
                  <i className="ti ti-alert-triangle" aria-hidden="true" />Reading is changing
                </Badge>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tank level" subtitle="The level is Low, Medium, or Full." />
          <CardBody>
            <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={summary?.waterTank.tankStatus3Info?.tone === 'ok' ? 'good' : summary?.waterTank.tankStatus3Info?.tone === 'warning' ? 'check' : summary?.waterTank.tankStatus3Info?.tone === 'error' ? 'action' : 'none'} /><span className="text-sm text-text-secondary">Tank level: {summary?.waterTank.tankStatus3Info?.label || 'No data'}</span></div>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-2.5 flex-1 rounded-full ${
                    (summary?.waterTank.tankStatus3Info?.step || 0) >= step
                      ? step === 3 ? 'bg-green-600' : step === 2 ? 'bg-amber-500' : 'bg-red-500'
                      : 'bg-bg-tertiary'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-text-secondary mt-1.5">
              <span>Low</span><span>Medium</span><span>Full</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Recommendation — proper PPM for gardening use, based on the TDS reading above */}
      <Card className="mb-3.5">
        <CardHeader title="Can I use this water for plants?" subtitle="Based on water purity (TDS)." />
        <CardBody>
          <div className={`border rounded-md p-3.5 ${waterRecTone.card}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={waterRec.severity === 'ok' ? 'good' : waterRec.severity === 'medium' ? 'check' : waterRec.severity === 'high' ? 'action' : 'none'} />
                <span className="text-sm font-medium text-text-primary">Water purity (TDS)</span>
              </div>
              {waterRec.reading && <span className="text-sm font-semibold text-text-primary flex-shrink-0">{waterRec.reading}</span>}
            </div>
            <p className="text-sm text-text-secondary leading-snug">{waterRec.message}</p>
            {waterRec.fix && (
              <p className="text-sm mt-2 leading-snug">
                <span className="font-medium text-text-primary">Fix: </span>
                <span className="text-text-secondary">{waterRec.fix}</span>
              </p>
            )}
            {waterRec.diyTip && (
              <div className="text-sm mt-1.5 leading-snug bg-green-50/70 border border-green-100 rounded px-2.5 py-1.5">
                <span className="font-medium text-green-800">DIY option: </span>
                <span className="text-green-900/80">{waterRec.diyTip}</span>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <div className={ps.grid.twoCol}>
        {/* Trend */}
        <Card>
          <CardHeader
            title="Tank fill level trend"
            subtitle="Shows how full the tank is based on its sensor readings."
            actions={
              <div className={ps.btnRow}>
              {['24h', '7d', '30d'].map((r, index) => (
                  <Button key={r} size="sm" variant={range === r ? 'primary' : 'default'} onClick={() => setRange(r)}>
                  {['Today', '7 days', '30 days'][index]}
                  </Button>
                ))}
              </div>
            }
          />
          <CardBody>
            <WaterLevelTrendChart labels={chart.labels} values={chart.values} />
          </CardBody>
        </Card>

        {/* Calibration */}
        <details className="overflow-hidden rounded-xl border border-border bg-bg-primary">
          <summary className="min-h-12 cursor-pointer px-4 py-3 font-semibold text-text-primary">Advanced tank settings</summary>
          <div className="border-t border-border p-4">
            <p className="mb-4 text-sm text-text-secondary">Adjust these only if the sensor is moved or the tank changes.</p>
            <RangeInput
              label="Distance reading when tank is EMPTY"
              min={0} max={300} unit="cm"
              value={emptyDist}
              onChange={setEmptyDist}
            />
            <RangeInput
              label="Distance reading when tank is FULL"
              min={0} max={300} unit="cm"
              value={fullDist}
              onChange={setFullDist}
            />
            <RangeInput
              label="Low-water safety threshold"
              min={0} max={100} unit="%"
              value={lowThreshold}
              onChange={setLowThreshold}
            />
            <Button variant="primary" className="w-full justify-center mt-2" onClick={saveCalibration} disabled={saving}>
              {saving ? 'Saving…' : 'Save tank settings'}
            </Button>
            {saved && (
              <div className="mt-2 text-sm text-green-800 flex items-center gap-1.5" role="status">
                <i className="ti ti-check" aria-hidden="true" /> Saved. New tank readings will use these settings.
              </div>
            )}
            <div className="text-sm text-text-secondary mt-3">
              Measure from the sensor to the tank bottom when it is empty. Then measure to the water surface when the tank is full.
            </div>
          </div>
        </details>
      </div>

      <div className="text-sm text-text-secondary mt-2 flex items-start gap-1.5">
        <i className="ti ti-info-circle flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          The tank level is an estimate based on the sensor.
        </span>
      </div>
    </div>
  );
};

export default RainwaterPage;
