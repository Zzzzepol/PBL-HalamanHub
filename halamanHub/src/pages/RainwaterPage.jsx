import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardBody, StatCard, Badge, Button, RangeInput } from '../components/ui/UI';
import { WaterLevelTrendChart } from '../components/charts/Charts';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { sensorsApi, dashboardApi, irrigationApi, ApiError } from '../api/client';
import * as ps from './pageStyles';
import { useLiveRefetch } from '../hooks/useLiveRefetch';
import { getWaterQualityRecommendation } from '../utils/waterQuality';
import WeatherForecast from '../components/layout/WeatherForecast';

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

const recommendationTone = {
  high:   { card: 'border-red-200 bg-red-50/60',     badge: 'bg-red-100 text-red-800' },
  medium: { card: 'border-amber-200 bg-amber-50/60', badge: 'bg-amber-100 text-amber-800' },
  low:    { card: 'border-blue-200 bg-blue-50/60',   badge: 'bg-blue-100 text-blue-800' },
  ok:     { card: 'border-green-200 bg-green-50/60', badge: 'bg-green-100 text-green-800' },
};

const formatTime = (iso) => {
  if (!iso) return '—';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
};

const RainwaterPage = () => {
  const { token } = useAuth();
  const [range, setRange] = useState('24h');
  const hours = RANGE_HOURS[range];

const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary, [], 30000);
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
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to save tank calibration.');
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
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load tank data. {hasError instanceof ApiError ? hasError.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={() => { refetchSummary(); refetchHistory(); refetchSettings(); }}>Retry</button>
        </div>
      )}

      <Card className="mb-3.5">
        <CardHeader title="Local weather & rain outlook" subtitle="Live conditions and a location-based seven-day forecast to help plan rainwater collection and irrigation" />
        <CardBody>
          <WeatherForecast />
        </CardBody>
      </Card>

      {/* Stats */}
      <div className={ps.grid.stats4}>
        <StatCard icon="ti-gauge" iconVariant="blue" value={summary?.waterTank.percent != null ? `${summary.waterTank.percent}%` : '—'} label="Fill level" />
        <StatCard icon="ti-chart-line" iconVariant="teal" value={availablePct != null ? `${availablePct}%` : '—'} label={`Time above threshold (${range})`} />
        <StatCard icon="ti-clock" iconVariant="amber" value={formatTime(summary?.irrigation.lastUpdated)} label="Last reading" />
      </div>

      {/* Rainwater quality — TDS, pH, 3-state float-switch tank level */}
      <div className={ps.grid.twoCol}>
        <Card>
          <CardHeader title="Water quality (TDS)" subtitle="Total dissolved solids" />
          <CardBody>
            <div className="text-[28px] font-medium text-text-primary leading-tight">
              {summary?.waterTank.tds != null ? `${summary.waterTank.tds.toFixed(0)}` : '—'}
              <span className="text-sm text-text-secondary ml-1 font-normal">ppm</span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <Badge variant={summary?.waterTank.waterQuality?.tone || 'default'}>
                {summary?.waterTank.waterQuality?.label || 'No data'}
              </Badge>
              {summary?.waterTank.tds != null && summary?.waterTank.tdsStable === false && (
                <Badge variant="warning" title="Sensor readings are fluctuating too much to trust right now — showing the last known-good value instead of a fresh one.">
                  Unstable — showing last known value
                </Badge>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tank level (3-state)" subtitle="Low / Medium / Full, from the ultrasonic sensor" />
          <CardBody>
            <Badge variant={summary?.waterTank.tankStatus3Info?.tone || 'default'} className="mb-3">
              {summary?.waterTank.tankStatus3Info?.label || 'No data'}
            </Badge>
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
        <CardHeader title="Gardening-use recommendation" subtitle="Is this water safe to irrigate with, based on TDS (ppm)?" />
        <CardBody>
          <div className={`border rounded-md p-3.5 ${waterRecTone.card}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${waterRecTone.badge}`}>
                  {waterRec.severity === 'ok' ? 'Good' : waterRec.severity}
                </span>
                <span className="text-sm font-medium text-text-primary">{waterRec.category}</span>
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
            subtitle="Calculated from the ultrasonic distance sensor"
            actions={
              <div className={ps.btnRow}>
                {['24h', '7d', '30d'].map(r => (
                  <Button key={r} size="sm" variant={range === r ? 'primary' : 'default'} onClick={() => setRange(r)}>
                    {r}
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
        <Card>
          <CardHeader title="Sensor calibration" subtitle="Adjust if the sensor is remounted or the tank changes" />
          <CardBody>
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
              {saving ? 'Saving…' : 'Save calibration'}
            </Button>
            {saved && (
              <div className="mt-2 text-sm text-green-800 flex items-center gap-1.5">
                <i className="ti ti-check" aria-hidden="true" /> Calibration saved — the ESP32 will pick this up on its next poll
              </div>
            )}
            <div className="text-sm text-text-secondary mt-3">
              Measure "empty" as the distance from the mounted sensor down to the tank bottom, and "full" as the distance down to the water surface at maximum capacity.
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="text-sm text-text-secondary mt-2 flex items-start gap-1.5">
        <i className="ti ti-info-circle flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Fill level is calculated from ultrasonic distance, using the calibration above. The forecast above is external
          weather data; without an onsite rain gauge or flow meter, this system cannot verify rainfall or calculate litres collected/used.
        </span>
      </div>
    </div>
  );
};

export default RainwaterPage;
