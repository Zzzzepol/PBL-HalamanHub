import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, Button, Badge, PulseDot, RangeInput, Toggle, ConfirmDialog, ErrorState, LoadingSkeleton } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { irrigationApi, dashboardApi } from '../api/client';
import { useLiveRefetch } from '../hooks/useLiveRefetch';

const formatDateTime = (value) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const reasonLabel = { auto_dry: 'Auto — soil is dry', auto_wet: 'Auto — soil is wet', manual: 'Manual', safety_tank_empty: 'Stopped — tank is empty' };

const IrrigationPage = () => {
  const { token } = useAuth();
  const { data: settings, error: settingsError, loading: settingsLoading, refetch: refetchSettings, setData: setSettings } = useApiData(irrigationApi.getSettings, [], 30000);
  const { data: logs, error: logsError, refetch: refetchLogs } = useApiData(t => irrigationApi.getLogs(t, 50), [], 30000);
  const { data: summary, refetch: refetchSummary } = useApiData(dashboardApi.getSummary, [], 30000, 'admin:dashboard-summary');
  useLiveRefetch(['sensor:reading', 'sensor:status'], refetchSummary);
  useLiveRefetch('irrigation:log', () => { refetchLogs(); refetchSummary(); }, 0);

  const [dryThreshold, setDryThreshold] = useState(30);
  const [wetThreshold, setWetThreshold] = useState(60);
  const [pumpOnTimeSec, setPumpOnTimeSec] = useState(60);
  const [soakTimeSec, setSoakTimeSec] = useState(300);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [changing, setChanging] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);
  const [pendingLockoutReset, setPendingLockoutReset] = useState(false);
  const [pendingWateringEnabled, setPendingWateringEnabled] = useState(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setDryThreshold(settings.moistureDryThreshold);
    setWetThreshold(settings.moistureWetThreshold);
    setPumpOnTimeSec(settings.pumpOnTimeSec);
    setSoakTimeSec(settings.soakTimeSec);
  }, [settings]);

  const applySettingsPatch = async patch => {
    setChanging(true);
    try {
      const updated = await irrigationApi.updateSettings(patch, token);
      setSettings(updated);
      refetchSummary();
    } catch (error) {
      setSaveError(error.message || 'We could not update the watering system. Please try again.');
    } finally { setChanging(false); }
  };

  const confirmToggle = () => {
    if (pendingToggle === 'pump') applySettingsPatch({ manualPump: !settings.manualPump });
    if (pendingToggle === 'backup') applySettingsPatch({ manualSolenoid: !settings.manualSolenoid });
    setPendingToggle(null);
  };

  const requestLockoutReset = async () => {
    setChanging(true);
    setSaveError('');
    try {
      await irrigationApi.resetLockout(token);
      await refetchSummary();
    } catch {
      setSaveError('We could not request a safety reset. Please try again.');
    } finally {
      setChanging(false);
      setPendingLockoutReset(false);
    }
  };

  const confirmWateringEnabledChange = async () => {
    if (pendingWateringEnabled === null) return;
    await applySettingsPatch({ wateringEnabled: pendingWateringEnabled });
    setPendingWateringEnabled(null);
  };

  const saveAdvanced = async () => {
    setSaving(true); setSaved(false); setSaveError('');
    try {
      const updated = await irrigationApi.updateSettings({ moistureDryThreshold: dryThreshold, moistureWetThreshold: wetThreshold, pumpOnTimeSec, soakTimeSec }, token);
      setSettings(updated); setSaved(true); window.setTimeout(() => setSaved(false), 2500);
    } catch { setSaveError('We could not save these settings. Please try again.'); }
    finally { setSaving(false); }
  };

  const irrigation = summary?.irrigation;
  const probeOutsideWateredArea = Boolean(summary?.monitoringStation?.activePlotId
    && summary?.monitoringStation?.wateredPlotId
    && String(summary.monitoringStation.activePlotId) !== String(summary.monitoringStation.wateredPlotId));
  const active = Boolean(irrigation?.deviceOnline && (irrigation?.pumpActive || irrigation?.solenoidActive));
  const manualActive = Boolean(settings?.manualPump || settings?.manualSolenoid);
  const stateLabel = !irrigation?.deviceOnline ? 'Waiting for the ESP32' : ({ IDLE: 'Watching the soil', WATERING: 'Watering', SOAKING: 'Letting water soak in', SAFETY_LOCKOUT: 'Paused for safety' })[irrigation?.state] || 'Waiting for the ESP32';

  return (
    <div className="space-y-5">
      {(settingsError || logsError) && <ErrorState title="Watering information is not loading" description="Check your connection, then try again." onRetry={() => { refetchSettings(); refetchLogs(); }} />}
      {saveError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{saveError}</div>}
      {probeOutsideWateredArea && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">The probe is assigned to another growing area. The shared pump and backup line stay off until the probe is back in the watered area. <Link className="font-medium underline" to="/growing-areas">View growing areas</Link>.</p>}
      {settings?.bootstrapFromCloudPending && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">This laptop has not imported older watering settings yet. Review the values below and save them to use local control now, or reconnect to import the cloud settings. The ESP32 keeps its last saved settings until then.</div>}

      <section className={`rounded-2xl border p-4 sm:p-5 ${settings?.wateringEnabled === false ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'}`} aria-live="polite">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><i className={`ti ${settings?.wateringEnabled === false ? 'ti-player-pause text-red-700' : 'ti-shield-check text-amber-800'} mt-0.5 text-2xl`} aria-hidden="true" /><div><h2 className="font-semibold text-text-primary">{settings?.wateringEnabled === false ? 'Watering is disabled.' : 'Watering system kill switch'}</h2><p className="mt-1 text-sm text-text-secondary">Stops both the pump and backup water line in Auto and Manual modes. It stays off until you turn it back on.</p>{settings?.wateringEnabled === false && (!irrigation?.deviceOnline || irrigation?.deviceWateringEnabled !== false) && <p className="mt-1 text-sm font-medium text-red-800">Waiting for the ESP32 to receive and confirm the stop command.</p>}</div></div>
          <Toggle id="watering-enabled" checked={settings?.wateringEnabled !== false} onChange={() => setPendingWateringEnabled(settings?.wateringEnabled === false)} label={settings?.wateringEnabled === false ? 'Watering disabled' : 'Watering enabled'} disabled={settingsLoading || changing || !settings || (probeOutsideWateredArea && settings?.wateringEnabled === false)} />
        </div>
      </section>

      <section className="rounded-2xl border border-green-200 bg-green-50 p-4 sm:p-5" aria-live="polite">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><i className={`ti ${active ? 'ti-droplet-filled text-green-800' : 'ti-droplet-off text-text-secondary'} mt-0.5 text-2xl`} aria-hidden="true" /><div><h2 className="text-lg font-semibold text-text-primary">{active ? 'Watering is on.' : !irrigation?.deviceOnline ? 'Waiting for a fresh device reading.' : irrigation?.lockout ? 'Watering is paused for safety.' : 'Watering is off.'}</h2><p className="text-sm text-text-secondary">{settings?.mode === 'manual' ? 'You are using Manual mode.' : settings?.mode === 'auto' ? 'Auto mode follows fresh soil and tank readings.' : 'The system status will appear when it connects.'}</p></div></div>
          {irrigation?.mode && <Badge variant={irrigation.mode === 'manual' ? 'warning' : 'ok'}>{irrigation.mode === 'manual' ? 'Manual mode' : 'Auto mode'}</Badge>}
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t border-green-200 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className={irrigation?.deviceOnline ? 'text-green-900' : 'text-amber-900'}>{irrigation?.deviceOnline ? `ESP32 connected · last reading ${formatDateTime(irrigation.lastUpdated)}` : 'No recent reading from the ESP32. Water controls may not have reached the device.'}</span>
          <span className={irrigation?.settingsApplied ? 'text-green-900' : 'text-amber-900'}>{irrigation?.settingsApplied ? `Settings applied · version ${irrigation.appliedSettingsVersion}` : 'Waiting for the ESP32 to confirm the latest settings.'}</span>
        </div>
      </section>

      {irrigation?.lockout && <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert"><div><h2 className="font-semibold text-red-900">Watering is paused for safety.</h2><p className="mt-1 text-sm text-red-900">Check the soil sensor and tank reading first. Reset only after the readings are fresh.</p>{irrigation.lockoutResetVersion !== irrigation.appliedLockoutResetVersion && <p className="mt-1 text-sm text-red-900">Reset request sent; waiting for a fresh reading and device reply.</p>}</div><Button variant="danger" onClick={() => setPendingLockoutReset(true)} disabled={changing || !irrigation.soilReadingFresh || !irrigation.tankReadingFresh || irrigation.lockoutResetVersion !== irrigation.appliedLockoutResetVersion}>Reset safety pause</Button></section>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardBody className="space-y-5">
            <div><h2 className="text-lg font-semibold text-text-primary">Choose a watering mode</h2><p className="mt-1 text-sm text-text-secondary">Auto follows soil readings. Manual lets you control the water pump and backup water line.</p></div>
            {settingsLoading ? <LoadingSkeleton className="h-12 w-full" /> : <div className="grid grid-cols-2 gap-3">
              <button type="button" aria-pressed={settings?.mode === 'auto'} onClick={() => settings?.mode !== 'auto' && setPendingMode('auto')} disabled={changing || !settings} className={`min-h-[72px] rounded-xl border-2 p-3 text-left transition-colors ${settings?.mode === 'auto' ? 'border-green-700 bg-green-50' : 'border-border hover:bg-bg-secondary'}`}><span className="block font-semibold text-text-primary">Auto</span><span className="mt-1 block text-sm text-text-secondary">Uses soil wetness</span></button>
              <button type="button" aria-pressed={settings?.mode === 'manual'} onClick={() => settings?.mode !== 'manual' && setPendingMode('manual')} disabled={changing || !settings} className={`min-h-[72px] rounded-xl border-2 p-3 text-left transition-colors ${settings?.mode === 'manual' ? 'border-green-700 bg-green-50' : 'border-border hover:bg-bg-secondary'}`}><span className="block font-semibold text-text-primary">Manual</span><span className="mt-1 block text-sm text-text-secondary">You control the water</span></button>
            </div>}
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="font-semibold text-text-primary">Current state</h3>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-secondary px-3 py-2.5"><span>Water pump</span><span className="flex items-center gap-2 font-medium"><PulseDot active={Boolean(irrigation?.deviceOnline && irrigation?.pumpActive)} />{!irrigation?.deviceOnline ? 'No signal' : irrigation?.pumpActive ? 'On' : 'Off'}</span></div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-secondary px-3 py-2.5"><span>Backup water line</span><span className="flex items-center gap-2 font-medium"><PulseDot active={Boolean(irrigation?.deviceOnline && irrigation?.solenoidActive)} />{!irrigation?.deviceOnline ? 'No signal' : irrigation?.solenoidActive ? 'Open' : 'Closed'}</span></div>
            </div>
            <div className={`space-y-3 ${settings?.mode !== 'manual' ? 'opacity-60' : ''}`}>
              <h3 className="font-semibold text-text-primary">Manual controls</h3>
              <Toggle id="manual-pump" checked={Boolean(settings?.manualPump)} onChange={() => setPendingToggle('pump')} label="Water pump" disabled={settingsLoading || changing || (!settings?.manualPump && (probeOutsideWateredArea || settings?.wateringEnabled === false || settings?.mode !== 'manual' || !irrigation?.deviceOnline || !irrigation?.tankReadingFresh || irrigation?.lockout))} />
              <Toggle id="manual-backup" checked={Boolean(settings?.manualSolenoid)} onChange={() => setPendingToggle('backup')} label="Backup water line" disabled={settingsLoading || changing || (!settings?.manualSolenoid && (probeOutsideWateredArea || settings?.wateringEnabled === false || settings?.mode !== 'manual' || !irrigation?.deviceOnline || !irrigation?.tankReadingFresh || irrigation?.lockout))} />
              {manualActive && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>Manual controls turn off after five minutes. They also stop if the ESP32 loses its local connection.</p>{settings?.manualControlExpiresAt && <p className="mt-1">This command ends at {formatDateTime(settings.manualControlExpiresAt)}.</p>}{!probeOutsideWateredArea && <Button className="mt-2" size="sm" variant="outline" onClick={() => applySettingsPatch({ manualPump: Boolean(settings.manualPump), manualSolenoid: Boolean(settings.manualSolenoid) })} disabled={changing || !irrigation?.deviceOnline}>Extend for five minutes</Button>}</div>}
              {settings?.mode !== 'manual' && <p className="text-sm text-text-secondary">Choose Manual mode to use these controls.</p>}
            </div>
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><i className="ti ti-alert-triangle mr-1" aria-hidden="true" />In Manual mode, the pump follows your switch even when the tank reads low. The backup water line opens only when you turn it on. Check that the pump has water before starting it.</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex h-full flex-col">
            <h2 className="text-lg font-semibold text-text-primary">Watering at a glance</h2>
            <p className="mt-1 text-sm text-text-secondary">Check the soil wetness and tank before changing the settings.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-bg-secondary p-4"><div className="text-sm text-text-secondary">Soil wetness</div><div className="mt-1 text-2xl font-semibold">{summary?.soilMoisture?.value ?? '—'}{summary?.soilMoisture?.value != null ? '%' : ''}</div></div>
              <div className="rounded-xl border border-border bg-bg-secondary p-4"><div className="text-sm text-text-secondary">Water tank</div><div className="mt-1 text-2xl font-semibold">{summary?.waterTank?.percent != null ? `${summary.waterTank.percent}%` : summary?.waterTank?.tankStatus3Info?.label || '—'}</div></div>
            </div>
            <p className="mt-auto pt-5 text-sm text-text-secondary">{stateLabel}{irrigation?.deviceOnline && irrigation?.timeRemainingSec > 0 ? ` · ${irrigation.timeRemainingSec} seconds left` : ''}{irrigation?.deviceOnline && irrigation?.cycle > 0 ? ` · cycle ${irrigation.cycle}` : ''}</p>
          </CardBody>
        </Card>
      </div>

      <details className="rounded-xl border border-border bg-bg-primary">
        <summary className="min-h-12 cursor-pointer px-4 py-3 font-semibold text-text-primary">Advanced settings</summary>
        <div className="grid grid-cols-1 gap-4 border-t border-border p-4 lg:grid-cols-2">
          <div><h2 className="font-semibold text-text-primary">Auto watering levels</h2><p className="mb-4 mt-1 text-sm text-text-secondary">Used only in Auto mode. Keep the start level lower than the stop level.</p><RangeInput label="Start watering below this soil wetness" min={10} max={80} unit="%" value={dryThreshold} onChange={setDryThreshold} /><RangeInput label="Stop watering when soil reaches" min={20} max={100} unit="%" value={wetThreshold} onChange={setWetThreshold} /></div>
          <div><h2 className="font-semibold text-text-primary">Watering and rest times</h2><p className="mb-4 mt-1 text-sm text-text-secondary">Short watering periods give water time to soak in before the next check.</p><RangeInput label="Water for this long at a time" min={5} max={600} unit=" seconds" value={pumpOnTimeSec} onChange={setPumpOnTimeSec} /><RangeInput label="Wait this long before checking again" min={30} max={3600} unit=" seconds" value={soakTimeSec} onChange={setSoakTimeSec} /></div>
          <div className="lg:col-span-2"><Button variant="primary" className="w-full sm:w-auto" onClick={saveAdvanced} disabled={saving}>{saving ? 'Saving…' : 'Save advanced settings'}</Button>{saved && <span className="ml-3 text-sm font-medium text-green-800" role="status">Settings saved.</span>}</div>
        </div>
      </details>

      <Card>
        <CardBody>
          <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-text-primary">Watering history</h2><p className="text-sm text-text-secondary">See when water ran and how the soil changed after an Auto cycle.</p></div><Button variant="ghost" size="sm" icon="ti-refresh" aria-label="Refresh watering history" onClick={refetchLogs}>Refresh</Button></div>
          {logs?.length ? <div className="divide-y divide-border">{logs.map(item => <div key={item._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium text-text-primary">{item.source === 'PUMP' ? 'Water pump' : 'Backup water line'} · {item.action === 'ON' ? 'On' : 'Off'}</div><div className="text-sm text-text-secondary">{formatDateTime(item.occurredAt)}{item.durationSec != null && item.action === 'OFF' ? ` · ran for ${item.durationSec} seconds` : ''}{item.monitoringLocation ? ` · ${item.monitoringLocation}` : ''}</div>{item.source === 'PUMP' && item.action === 'OFF' && (item.moistureBefore != null || item.moistureAfterRun != null) && <p className="mt-1 text-sm text-text-primary">Soil wetness: {item.moistureBefore ?? '—'}% before → {item.moistureAfterRun != null ? `${item.moistureAfterRun}% after Auto cycle` : 'waiting for the Auto cycle to finish'}</p>}{item.wateringResult && <p className="mt-1 text-sm font-medium text-green-800" role="status">{item.wateringResult === 'target_reached' ? 'The soil reached the stop level.' : item.wateringResult === 'improved' ? 'The soil became wetter after watering.' : 'The reading did not change after watering; check the probe and water flow.'}</p>}</div><div className="flex flex-wrap gap-2"><Badge variant={item.action === 'ON' ? 'ok' : 'default'}>{item.action === 'ON' ? 'On' : 'Off'}</Badge><Badge variant={item.reason === 'safety_tank_empty' ? 'warning' : 'default'}>{reasonLabel[item.reason] || 'Manual'}</Badge></div></div>)}</div> : <p className="py-5 text-sm text-text-secondary">No watering activity yet. New activity will appear here.</p>}
        </CardBody>
      </Card>

      <ConfirmDialog open={pendingWateringEnabled !== null} title={pendingWateringEnabled ? 'Turn watering back on?' : 'Stop all watering?'} message={pendingWateringEnabled ? 'The ESP32 may resume automatic watering if the soil needs it. Manual outputs remain off.' : 'This shuts off the pump and backup water line in both Auto and Manual modes. The ESP32 keeps watering disabled after a restart until you turn it back on.'} confirmLabel={pendingWateringEnabled ? 'Turn watering on' : 'Stop watering'} onConfirm={confirmWateringEnabledChange} onCancel={() => setPendingWateringEnabled(null)} variant={pendingWateringEnabled ? 'primary' : 'danger'} />
      <ConfirmDialog open={Boolean(pendingToggle)} title={pendingToggle === 'pump' ? `${settings?.manualPump ? 'Turn off' : 'Turn on'} the water pump?` : `${settings?.manualSolenoid ? 'Close' : 'Open'} the backup water line?`} message={pendingToggle === 'pump' ? 'The pump may run even when the tank reads low. Check that it has water before turning it on. Manual watering stops after five minutes or if the ESP32 loses its local connection.' : 'The backup water line may open as soon as you confirm. Manual watering stops after five minutes or if the ESP32 loses its local connection.'} confirmLabel="Confirm change" onConfirm={confirmToggle} onCancel={() => setPendingToggle(null)} variant="primary" />
      <ConfirmDialog open={Boolean(pendingMode)} title={`Change to ${pendingMode === 'auto' ? 'Auto' : 'Manual'} mode?`} message={pendingMode === 'auto' ? 'Auto mode may start watering as soon as the soil reading calls for it.' : 'Manual mode lets you control the water pump and backup water line yourself.'} confirmLabel="Change mode" onConfirm={() => { applySettingsPatch({ mode: pendingMode }); setPendingMode(null); }} onCancel={() => setPendingMode(null)} variant="primary" />
      <ConfirmDialog open={pendingLockoutReset} title="Reset the watering safety pause?" message="Only reset after the soil and tank readings are fresh and you have checked the cause. The ESP32 will confirm the reset." confirmLabel="Reset safety pause" onConfirm={requestLockoutReset} onCancel={() => setPendingLockoutReset(false)} variant="danger" />
    </div>
  );
};

export default IrrigationPage;
