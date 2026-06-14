import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Button, Badge, PulseDot, SectionLabel, RangeInput, Toggle, FormField, Input, Select } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { irrigationApi, settingsApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const emptyForm = { time: '', zone: 'Zone A', frequency: 'Daily', status: 'active', duration: 15 };

const IrrigationPage = () => {
  const { token } = useAuth();
  const { data: zones, error: zonesError, refetch: refetchZones, setData: setZones } = useApiData(irrigationApi.getZones);
  const { data: schedules, error: schedulesError, refetch: refetchSchedules, setData: setSchedules } = useApiData(irrigationApi.getSchedules);
  const { data: settings, refetch: refetchSettings } = useApiData(settingsApi.get);

  const [autoEnabled, setAutoEnabled] = useState(true);
  const [startThreshold, setStartThreshold] = useState(40);
  const [stopThreshold, setStopThreshold] = useState(80);
  const [maxDuration, setMaxDuration] = useState(30);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync local threshold state once settings load
  useEffect(() => {
    if (settings) {
      setAutoEnabled(settings.autoIrrigationEnabled);
      setStartThreshold(settings.thresholds.irrigationStart);
      setStopThreshold(settings.thresholds.irrigationStop);
      setMaxDuration(settings.thresholds.maxIrrigationDuration);
    }
  }, [settings]);

  const toggleZone = async (zoneId) => {
    try {
      const updated = await irrigationApi.toggleZone(zoneId, token);
      setZones((zones || []).map(z => z.zoneId === zoneId ? updated : z));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to toggle irrigation.');
    }
  };

  const saveThresholds = async () => {
    setSavingThresholds(true);
    setThresholdSaved(false);
    try {
      await settingsApi.update({
        autoIrrigationEnabled: autoEnabled,
        thresholds: {
          irrigationStart: startThreshold,
          irrigationStop: stopThreshold,
          maxIrrigationDuration: maxDuration,
        },
      }, token);
      setThresholdSaved(true);
      refetchSettings();
      setTimeout(() => setThresholdSaved(false), 2000);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to save thresholds.');
    } finally {
      setSavingThresholds(false);
    }
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setSaveError(''); setModalOpen(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({ time: item.time, zone: item.zone, frequency: item.frequency, status: item.status, duration: item.duration });
    setSaveError('');
    setModalOpen(true);
  };

  const saveSchedule = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    const payload = { ...form, duration: Number(form.duration) };
    try {
      if (editing) {
        const updated = await irrigationApi.updateSchedule(editing._id, payload, token);
        setSchedules((schedules || []).map(s => s._id === editing._id ? updated : s));
      } else {
        const created = await irrigationApi.createSchedule(payload, token);
        setSchedules([...(schedules || []), created]);
      }
      setModalOpen(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (id) => {
    try {
      await irrigationApi.deleteSchedule(id, token);
      setSchedules((schedules || []).filter(s => s._id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete schedule.');
    }
  };

  return (
    <div>
      {(zonesError || schedulesError) && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load irrigation data. Check that the backend and MongoDB are running.{' '}
          <button className="underline" onClick={() => { refetchZones(); refetchSchedules(); }}>Retry</button>
        </div>
      )}

      <div className={ps.grid.twoCol}>
        {/* Manual control */}
        <Card>
          <CardHeader title="Manual control" subtitle="Override automatic scheduling per zone" />
          <CardBody>
            {(zones || []).map((zone, i) => (
              <div key={zone.zoneId} className={i > 0 ? 'pt-3.5 mt-2 border-t-[0.5px] border-border' : ''}>
                <SectionLabel>{zone.name}</SectionLabel>
                <div className={`${ps.irrRow} !mb-1.5`}>
                  <div className={zone.status === 'active' ? ps.irrOn : ps.irrOff}>
                    <PulseDot active={zone.status === 'active'} />
                    {zone.status === 'active' ? 'Currently irrigating' : 'Idle'}
                  </div>
                  {zone.status === 'active' ? (
                    <Button variant="danger" size="sm" icon="ti-player-stop" onClick={() => toggleZone(zone.zoneId)}>Stop now</Button>
                  ) : (
                    <Button variant="primary" size="sm" icon="ti-player-play" onClick={() => toggleZone(zone.zoneId)}>Start now</Button>
                  )}
                </div>
                <div className={ps.irrMeta}>{zone.lastRunSummary}</div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Auto-trigger thresholds */}
        <Card>
          <CardHeader title="Auto-trigger thresholds" subtitle="Irrigation starts automatically when conditions are met" />
          <CardBody>
            <RangeInput
              label="Soil moisture trigger (irrigate below)"
              min={10} max={80} unit="%"
              value={startThreshold}
              onChange={setStartThreshold}
            />
            <RangeInput
              label="Stop irrigation when moisture reaches"
              min={50} max={100} unit="%"
              value={stopThreshold}
              onChange={setStopThreshold}
            />
            <RangeInput
              label="Maximum irrigation duration"
              min={5} max={90} unit="m"
              value={maxDuration}
              onChange={setMaxDuration}
            />
            <div className="flex items-center mt-1 mb-3.5">
              <Toggle id="auto-irr" checked={autoEnabled} onChange={() => setAutoEnabled(!autoEnabled)} label="Auto-irrigation enabled" />
            </div>
            <Button variant="primary" className="w-full justify-center" onClick={saveThresholds} disabled={savingThresholds}>
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

      {/* Schedule */}
      <Card className={ps.lastCard}>
        <CardHeader title="Irrigation schedule" subtitle="Configured automatic watering times" actions={<Button size="sm" variant="primary" icon="ti-plus" onClick={openAdd}>Add schedule</Button>} />
        <CardBody>
          {(schedules || []).map(item => (
            <div key={item._id} className={ps.schedItem}>
              <span className={ps.schedTime}>{item.time}</span>
              <span className={ps.schedZone}>{item.zone} · {item.frequency}</span>
              <div className={ps.schedRight}>
                <Badge variant={item.status === 'active' ? 'ok' : 'default'}>{item.status === 'active' ? 'Active' : 'Paused'}</Badge>
                <span className={ps.schedDur}>{item.duration} min</span>
                <Button size="sm" icon="ti-edit" onClick={() => openEdit(item)}>Edit</Button>
                <Button size="sm" icon="ti-trash" onClick={() => deleteSchedule(item._id)} aria-label="Delete schedule" />
              </div>
            </div>
          ))}
          {(!schedules || schedules.length === 0) && (
            <div className="text-center text-text-secondary py-6 text-sm">No schedules configured.</div>
          )}
        </CardBody>
      </Card>

      {/* Add/Edit schedule modal */}
      {modalOpen && (
        <div className={ps.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={ps.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sched-modal-title">
            <div className={ps.modalHeader}>
              <span className={ps.modalTitle} id="sched-modal-title">{editing ? 'Edit schedule' : 'Add schedule'}</span>
              <button className={ps.modalClose} onClick={() => setModalOpen(false)} aria-label="Close"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <form onSubmit={saveSchedule}>
              <div className={ps.modalBody}>
                <div className={ps.grid.formRow}>
                  <FormField label="Time" id="sc-time">
                    <Input id="sc-time" placeholder="e.g. 07:00 AM" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
                  </FormField>
                  <FormField label="Zone" id="sc-zone">
                    <Select id="sc-zone" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}>
                      <option>Zone A</option>
                      <option>Zone B</option>
                      <option>Zone C</option>
                    </Select>
                  </FormField>
                </div>
                <div className={ps.grid.formRow}>
                  <FormField label="Frequency" id="sc-freq">
                    <Input id="sc-freq" placeholder="e.g. Daily, Mon / Wed / Fri" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} required />
                  </FormField>
                  <FormField label="Duration (min)" id="sc-dur">
                    <Input id="sc-dur" type="number" min="1" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} required />
                  </FormField>
                </div>
                <FormField label="Status" id="sc-status">
                  <Select id="sc-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </Select>
                </FormField>
                {saveError && (
                  <div className="mt-3 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">{saveError}</div>
                )}
              </div>
              <div className={ps.modalFooter}>
                <Button variant="default" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add schedule'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IrrigationPage;
