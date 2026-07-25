import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardBody, StatCard, Badge, Button, RangeInput } from '../components/ui/UI';
import { WaterLevelTrendChart } from '../components/charts/Charts';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { sensorsApi, dashboardApi, irrigationApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

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

  const { data: summary, error: summaryError, refetch: refetchSummary } = useApiData(dashboardApi.getSummary, [], 5000);
  const { data: history, error: historyError, refetch: refetchHistory } =
    useApiData((t) => sensorsApi.getHistory(t, hours), [hours], 20000);
  const { data: settings, error: settingsError, refetch: refetchSettings, setData: setSettings } =
    useApiData(irrigationApi.getSettings, [], 10000);

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

  const points = history || [];

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

  return (
    <div>
      {hasError && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load tank data. {hasError instanceof ApiError ? hasError.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={() => { refetchSummary(); refetchHistory(); refetchSettings(); }}>Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className={ps.grid.stats4}>
        <StatCard
          icon={summary?.waterTank.available ? 'ti-droplet' : 'ti-alert-triangle'}
          iconVariant={summary?.waterTank.available ? 'green' : 'red'}
          value={summary?.waterTank.available ? 'OK' : 'LOW'}
          label="Tank status"
        />
        <StatCard icon="ti-gauge" iconVariant="blue" value={summary?.waterTank.percent != null ? `${summary.waterTank.percent}%` : '—'} label="Fill level" />
        <StatCard icon="ti-chart-line" iconVariant="teal" value={availablePct != null ? `${availablePct}%` : '—'} label={`Time above threshold (${range})`} />
        <StatCard icon="ti-clock" iconVariant="amber" value={formatTime(summary?.irrigation.lastUpdated)} label="Last reading" />
      </div>

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
          Fill level is calculated from ultrasonic distance, using the calibration above. There's still no flow meter or rain
          gauge installed, so litres collected/used and rainfall forecasts aren't something this system measures.
        </span>
      </div>
    </div>
  );
};

export default RainwaterPage;