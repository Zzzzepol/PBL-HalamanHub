import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, Button, Toggle, FormField, Input, Select, ErrorState, StatusBadge } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { settingsApi, monitoringSetupApi, plantProfilesApi } from '../api/client';
import * as ps from './pageStyles';

const SettingsPage = () => {
  const { token } = useAuth();
  const { data: settings, loading, error, refetch } = useApiData(settingsApi.get);
  const { data: station, loading: stationLoading, error: stationError, refetch: refetchStation, setData: setStation } = useApiData(monitoringSetupApi.get);
  const { data: profiles } = useApiData(plantProfilesApi.getAll, [], 30000);

  const [farmName, setFarmName] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [savingFarm, setSavingFarm] = useState(false);
  const [farmSaved, setFarmSaved] = useState(false);

  const [notifs, setNotifs] = useState({
    lowMoisture: true,
    waterTank: true,
    sensorFailure: true,
    irrigation: true,
    orders: false,
    lowStock: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [stationName, setStationName] = useState('Main System');
  const [stationLocation, setStationLocation] = useState('');
  const [monitoredProfileIds, setMonitoredProfileIds] = useState([]);
  const [savingStation, setSavingStation] = useState(false);
  const [stationSaved, setStationSaved] = useState(false);
  const [stationMessage, setStationMessage] = useState('');
  const [checkNotes, setCheckNotes] = useState({});

  // Populate local form state once settings load
  useEffect(() => {
    if (settings) {
      setFarmName(settings.farmName);
      setLocation(settings.location);
      setTimezone(settings.timezone);
      setNotifs(settings.notifications);
    }
  }, [settings]);

  useEffect(() => {
    if (!station) return;
    setStationName(station.name || 'Main System');
    setStationLocation(station.location || '');
    setMonitoredProfileIds((station.plantProfileIds || []).map(id => String(id?._id || id)));
  }, [station]);

  const toggleNotif = async (key) => {
    const updated = { ...notifs, [key]: !notifs[key] };
    setNotifs(updated);
    setSavingNotifs(true);
    try {
      await settingsApi.update({ notifications: updated }, token);
    } catch {
      alert('We could not save this alert setting. Please try again.');
      setNotifs(notifs); // revert on failure
    } finally {
      setSavingNotifs(false);
    }
  };

  const saveFarm = async (e) => {
    e.preventDefault();
    setSavingFarm(true);
    setFarmSaved(false);
    try {
      await settingsApi.update({ farmName, location, timezone }, token);
      setFarmSaved(true);
      refetch();
      setTimeout(() => setFarmSaved(false), 2000);
    } catch {
      alert('We could not save these farm details. Please try again.');
    } finally {
      setSavingFarm(false);
    }
  };

  const saveMonitoringStation = async (event) => {
    event.preventDefault();
    setSavingStation(true);
    setStationSaved(false);
    setStationMessage('');
    try {
      const updated = await monitoringSetupApi.update({
        name: stationName,
        location: stationLocation,
        plantProfileIds: monitoredProfileIds,
      }, token);
      setStation(updated);
      setStationSaved(true);
      setTimeout(() => setStationSaved(false), 2500);
    } catch {
      setStationMessage('We could not save the monitoring area. Please try again.');
    } finally {
      setSavingStation(false);
    }
  };

  const completeSetupCheck = async (key) => {
    setStationMessage('');
    try {
      setStation(await monitoringSetupApi.completeCheck(key, checkNotes[key] || '', token));
      setCheckNotes(current => ({ ...current, [key]: '' }));
    } catch {
      setStationMessage('We could not save this field check. Please try again.');
    }
  };

  const toggleMonitoredPlant = (profileId) => {
    setMonitoredProfileIds(current => current.includes(profileId)
      ? current.filter(id => id !== profileId)
      : [...current, profileId]);
  };

  const setupChecks = [
    { key: 'probePlacement', title: 'Place the probe in the growing area', description: 'Put the single soil probe near the roots in the bed it represents.' },
    { key: 'readingsVerified', title: 'Check the soil readings', description: 'Compare the probe readings with its maker’s guide or a known reference. This records the check; it does not change the probe’s built-in calibration.' },
    { key: 'waterOutputsTested', title: 'Test the pump and backup line', description: 'Use Manual mode with water available. Check that each output turns on and off.' },
    { key: 'autoCycleTested', title: 'Check the Auto watering cycle', description: 'Review the start and stop wetness levels, then confirm one short watering and soak cycle.' },
  ];

  return (
    <div>
      {error && (
        <div className="mb-4"><ErrorState title="Settings are not loading" description="Check your connection, then try again." onRetry={refetch} /></div>
      )}

      <div className={ps.grid.twoCol}>
        {/* Farm configuration */}
        <Card>
          <CardHeader title="Farm configuration" subtitle="Basic information about your farm" />
          <CardBody>
            <form onSubmit={saveFarm}>
              <FormField label="Farm name" id="farm-name">
                <Input id="farm-name" value={farmName} onChange={e => setFarmName(e.target.value)} disabled={loading} />
              </FormField>
              <div className="mt-3">
                <FormField label="Location" id="farm-location">
                  <Input id="farm-location" value={location} onChange={e => setLocation(e.target.value)} disabled={loading} />
                </FormField>
              </div>
              <div className="mt-3 mb-4">
              <FormField label="Time zone" id="timezone">
                  <Select id="timezone" value={timezone} onChange={e => setTimezone(e.target.value)} disabled={loading}>
                    <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                  </Select>
                </FormField>
              </div>
              <Button variant="primary" type="submit" disabled={loading || savingFarm}>
                {savingFarm ? 'Saving…' : 'Save changes'}
              </Button>
              {farmSaved && (
                <span className="ml-2.5 text-sm text-green-800">
                  <i className="ti ti-check" aria-hidden="true" /> Saved
                </span>
              )}
            </form>
          </CardBody>
        </Card>

        {/* Notification preferences */}
        <Card>
          <CardHeader title="Notification preferences" subtitle="Choose which alerts you want to receive" />
          <CardBody>
            <div className={ps.toggleRow}>
              <Toggle id="notif-moisture" checked={notifs.lowMoisture} onChange={() => toggleNotif('lowMoisture')} disabled={savingNotifs} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Dry soil alerts</span>
                <span className={ps.toggleRowDesc}>Alert when soil wetness drops below the Auto setting.</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-tank" checked={notifs.waterTank} onChange={() => toggleNotif('waterTank')} disabled={savingNotifs} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Water tank alerts</span>
                <span className={ps.toggleRowDesc}>Alert when the water tank is running low.</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-sensor" checked={notifs.sensorFailure} onChange={() => toggleNotif('sensorFailure')} disabled={savingNotifs} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Sensor signal alerts</span>
                <span className={ps.toggleRowDesc}>Alert when a sensor has no signal.</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-irrigation" checked={notifs.irrigation} onChange={() => toggleNotif('irrigation')} disabled={savingNotifs} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Watering alerts</span>
                <span className={ps.toggleRowDesc}>Notify when the water pump or backup water line turns on.</span>
              </div>
            </div>
           <div className={ps.toggleRow}>
              <Toggle id="notif-orders" checked={notifs.orders} onChange={() => toggleNotif('orders')} disabled={savingNotifs} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Order notifications</span>
                <span className={ps.toggleRowDesc}>New orders and payment status updates</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-lowstock" checked={notifs.lowStock} onChange={() => toggleNotif('lowStock')} disabled={savingNotifs} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Low stock alerts</span>
                <span className={ps.toggleRowDesc}>Alert when a product's stock is running low or hits zero</span>
              </div>
            </div>
            {savingNotifs && <div className="text-xs text-text-secondary mt-1">Saving…</div>}
          </CardBody>
        </Card>
      </div>

      <Card className={ps.lastCard}>
        <CardHeader title="Soil monitoring setup" subtitle="Tell staff where the single soil probe is placed and which plants it represents." />
        <CardBody>
          {stationError && <div className="mb-4"><ErrorState title="Monitoring setup is not loading" description="Try again to load the saved area and field checks." onRetry={refetchStation} /></div>}
          {stationMessage && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900" role="alert">{stationMessage}</p>}
          <form onSubmit={saveMonitoringStation} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Monitoring station" id="station-name">
                <Input id="station-name" value={stationName} onChange={event => setStationName(event.target.value)} maxLength={80} disabled={stationLoading} />
              </FormField>
              <FormField label="Bed or area" id="station-location">
                <Input id="station-location" value={stationLocation} onChange={event => setStationLocation(event.target.value)} maxLength={120} placeholder="e.g. Propagation bed A" disabled={stationLoading} />
              </FormField>
            </div>
            <fieldset className="rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-text-primary">Plants represented by this probe</legend>
              <p className="mb-3 text-sm text-text-secondary">These plant profiles share one reading from this area. They do not have separate sensors.</p>
              {profiles?.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {profiles.map(profile => <label key={profile._id} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary">
                  <input type="checkbox" checked={monitoredProfileIds.includes(String(profile._id))} onChange={() => toggleMonitoredPlant(String(profile._id))} />
                  <span>{profile.name}<span className="ml-1 text-text-secondary">· {profile.category}</span></span>
                </label>)}
              </div> : <p className="text-sm text-text-secondary">Add plant profiles first, then choose the plants growing in this area.</p>}
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" type="submit" disabled={savingStation || stationLoading}>{savingStation ? 'Saving…' : 'Save monitoring area'}</Button>
              {stationSaved && <span className="text-sm font-medium text-green-800" role="status">Monitoring area saved.</span>}
              <span className="text-sm text-text-secondary">Changing the bed or selected plants clears the two soil placement checks.</span>
            </div>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <div className="mb-3"><h3 className="font-semibold text-text-primary">Field setup checks</h3><p className="mt-1 text-sm text-text-secondary">Record the checks staff complete before relying on automatic watering.</p></div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {setupChecks.map(check => {
                const savedCheck = station?.checks?.[check.key];
                return <article key={check.key} className="rounded-xl border border-border bg-bg-secondary p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h4 className="font-medium text-text-primary">{check.title}</h4><p className="mt-1 text-sm text-text-secondary">{check.description}</p></div>
                    <StatusBadge status={savedCheck?.checkedAt ? 'good' : 'check'} label={savedCheck?.checkedAt ? 'Checked' : 'To check'} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-sm text-text-secondary">{savedCheck?.checkedAt ? `Checked ${new Date(savedCheck.checkedAt).toLocaleString()}${savedCheck.checkedBy ? ` by ${savedCheck.checkedBy}` : ''}` : 'No check recorded yet'}</span>
                    <Button size="sm" variant={savedCheck?.checkedAt ? 'default' : 'primary'} onClick={() => completeSetupCheck(check.key)} disabled={stationLoading}>{savedCheck?.checkedAt ? 'Check again' : 'Mark checked'}</Button>
                  </div>
                  {savedCheck?.notes && <p className="mt-2 text-sm text-text-secondary">Last note: {savedCheck.notes}</p>}
                  <Input aria-label={`Notes for ${check.title}`} className="mt-3" value={checkNotes[check.key] ?? ''} onChange={event => setCheckNotes(current => ({ ...current, [check.key]: event.target.value }))} maxLength={500} placeholder="Optional check notes" />
                </article>;
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Where the real hardware controls actually live now */}
      <Card className={ps.lastCard}>
          <CardHeader title="Watering and tank settings" subtitle="Each setting is with the page where you use it." />
        <CardBody>
          <div className="text-sm text-text-secondary mb-3">
            Soil wetness levels and Auto/Manual mode are on <strong>Watering</strong>. Tank level setup is on{' '}
            <strong>Rain tank</strong>.
          </div>
          <div className="flex gap-2.5">
            <Link to="/irrigation"><Button variant="primary" icon="ti-droplet">Open watering</Button></Link>
            <Link to="/rainwater"><Button variant="default" icon="ti-cloud-rain">Open rain tank</Button></Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default SettingsPage;
