import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Button, Badge, PulseDot, SectionLabel, RangeInput, Toggle } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { irrigationApi, dashboardApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const reasonLabel = {
  auto_dry: { label: 'Auto — soil dry', variant: 'default' },
  auto_wet: { label: 'Auto — soil wet', variant: 'ok' },
  manual: { label: 'Manual', variant: 'default' },
  safety_tank_empty: { label: 'Safety — tank empty', variant: 'warning' },
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const IrrigationPage = () => {
  const { token } = useAuth();
  const { data: settings, error: settingsError, refetch: refetchSettings, setData: setSettings } = useApiData(irrigationApi.getSettings);
  const { data: logs, error: logsError, refetch: refetchLogs } = useApiData((t) => irrigationApi.getLogs(t, 50));
  const { data: summary, refetch: refetchSummary } = useApiData(dashboardApi.getSummary);

  const [dryThreshold, setDryThreshold] = useState(30);
  const [wetThreshold, setWetThreshold] = useState(60);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Sync local threshold sliders once settings load
  useEffect(() => {
    if (settings) {
      setDryThreshold(settings.moistureDryThreshold);
      setWetThreshold(settings.moistureWetThreshold);
    }
  }, [settings]);

  const irrigation = summary?.irrigation;

  const applySettingsPatch = async (patch) => {
    setToggling(true);
    try {
      const updated = await irrigationApi.updateSettings(patch, token);
      setSettings(updated);
      refetchSummary();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update irrigation settings.');
    } finally {
      setToggling(false);
    }
  };

  const setMode = (mode) => applySettingsPatch({ mode });
  const toggleManualPump = () => applySettingsPatch({ manualPump: !settings.manualPump });
  const toggleManualSolenoid = () => applySettingsPatch({ manualSolenoid: !settings.manualSolenoid });

  const saveThresholds = async () => {
    setSavingThresholds(true);
    setThresholdSaved(false);
    try {
      const updated = await irrigationApi.updateSettings({
        moistureDryThreshold: dryThreshold,
        moistureWetThreshold: wetThreshold,
      }, token);
      setSettings(updated);
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 2000);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to save thresholds.');
    } finally {
      setSavingThresholds(false);
    }
  };

  return (
    <div>
      {(settingsError || logsError) && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load irrigation data. Check that the backend and MongoDB are running.{' '}
          <button className="underline" onClick={() => { refetchSettings(); refetchLogs(); }}>Retry</button>
        </div>
      )}

      <div className={ps.grid.twoCol}>
        {/* Live status + manual control */}
        <Card>
          <CardHeader
            title="System control"
            subtitle="Your single pump/solenoid system"
            actions={<Badge variant={settings?.mode === 'manual' ? 'warning' : 'ok'}>{settings?.mode === 'manual' ? 'Manual mode' : 'Auto mode'}</Badge>}
          />
          <CardBody>
            {/* Mode switch */}
            <div className="flex items-center gap-2 pb-3.5 mb-3.5 border-b-[0.5px] border-border">
              <Button size="sm" variant={settings?.mode === 'auto' ? 'primary' : 'default'} onClick={() => setMode('auto')} disabled={toggling}>Auto</Button>
              <Button size="sm" variant={settings?.mode === 'manual' ? 'primary' : 'default'} onClick={() => setMode('manual')} disabled={toggling}>Manual</Button>
            </div>

            {/* Live state */}
            <SectionLabel>Current state</SectionLabel>
            <div className={`${ps.irrRow} !mb-1.5`}>
              <div className={irrigation?.pumpActive ? ps.irrOn : ps.irrOff}>
                <PulseDot active={!!irrigation?.pumpActive} /> Pump — {irrigation?.pumpActive ? 'Running' : 'Off'}
              </div>
            </div>
            <div className={`${ps.irrRow} mb-3.5`}>
              <div className={irrigation?.solenoidActive ? ps.irrOn : ps.irrOff}>
                <PulseDot active={!!irrigation?.solenoidActive} /> Solenoid — {irrigation?.solenoidActive ? 'Open' : 'Closed'}
              </div>
            </div>

            {/* Manual switches */}
            <SectionLabel>Manual override {settings?.mode !== 'manual' && '(switch to Manual mode to use)'}</SectionLabel>
            <div className={`${settings?.mode !== 'manual' ? 'opacity-50 pointer-events-none' : ''} space-y-2`}>
              <Toggle id="manual-pump" checked={!!settings?.manualPump} onChange={toggleManualPump} label="Pump on" />
              <Toggle id="manual-solenoid" checked={!!settings?.manualSolenoid} onChange={toggleManualSolenoid} label="Solenoid open" />
            </div>
            <div className="text-sm text-text-secondary mt-3">
              The tank-empty safety switch always applies, even in Manual mode — the pump will never run dry.
            </div>
          </CardBody>
        </Card>

        {/* Auto-trigger thresholds */}
        <Card>
          <CardHeader title="Auto-trigger thresholds" subtitle="Used when the system is in Auto mode" />
          <CardBody>
            <RangeInput
              label="Soil moisture trigger (irrigate below)"
              min={10} max={80} unit="%"
              value={dryThreshold}
              onChange={setDryThreshold}
            />
            <RangeInput
              label="Stop irrigation when moisture reaches"
              min={20} max={100} unit="%"
              value={wetThreshold}
              onChange={setWetThreshold}
            />
            <Button variant="primary" className="w-full justify-center mt-2" onClick={saveThresholds} disabled={savingThresholds}>
              {savingThresholds ? 'Saving…' : 'Save threshold settings'}
            </Button>
            {thresholdSaved && (
              <div className="mt-2 text-sm text-green-800 flex items-center gap-1.5">
                <i className="ti ti-check" aria-hidden="true" /> Thresholds saved
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Irrigation logs — replaces the old schedule */}
      <Card className={ps.lastCard}>
        <CardHeader
          title="Irrigation logs"
          subtitle="Real history of every time the pump/solenoid turned on or off"
          actions={<Button variant="ghost" size="sm" icon="ti-refresh" aria-label="Refresh" onClick={refetchLogs} />}
        />
        <CardBody>
          {(logs || []).map(item => {
            const reason = reasonLabel[item.reason] || reasonLabel.manual;
            return (
              <div key={item._id} className={ps.schedItem}>
                <span className={ps.schedTime}>{formatDateTime(item.occurredAt)}</span>
                <span className={ps.schedZone}>
                  {item.source === 'PUMP' ? 'Pump' : 'Solenoid'} · {item.moistureAtEvent != null ? `${item.moistureAtEvent}% moisture` : '—'}
                </span>
                <div className={ps.schedRight}>
                  <Badge variant={item.action === 'ON' ? 'ok' : 'default'}>{item.action}</Badge>
                  <Badge variant={reason.variant}>{reason.label}</Badge>
                </div>
              </div>
            );
          })}
          {(!logs || logs.length === 0) && (
            <div className="text-center text-text-secondary py-6 text-sm">No irrigation events recorded yet.</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default IrrigationPage;