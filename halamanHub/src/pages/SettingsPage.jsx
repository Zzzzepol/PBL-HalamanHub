import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Button, Toggle, FormField, Input, Select } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { settingsApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const SettingsPage = () => {
  const { token } = useAuth();
  const { data: settings, loading, error, refetch } = useApiData(settingsApi.get);

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
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  const [thresholds, setThresholds] = useState({ minSoilMoisture: 30, phRange: '6.0 – 7.0', maxEC: 2.5 });
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdsSaved, setThresholdsSaved] = useState(false);

  // Populate local form state once settings load
  useEffect(() => {
    if (settings) {
      setFarmName(settings.farmName);
      setLocation(settings.location);
      setTimezone(settings.timezone);
      setNotifs(settings.notifications);
      setThresholds({
        minSoilMoisture: settings.thresholds.minSoilMoisture,
        phRange: settings.thresholds.phRange,
        maxEC: settings.thresholds.maxEC,
      });
    }
  }, [settings]);

  const toggleNotif = async (key) => {
    const updated = { ...notifs, [key]: !notifs[key] };
    setNotifs(updated);
    setSavingNotifs(true);
    try {
      await settingsApi.update({ notifications: updated }, token);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to save notification preference.');
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
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to save farm configuration.');
    } finally {
      setSavingFarm(false);
    }
  };

  const saveThresholds = async (e) => {
    e.preventDefault();
    setSavingThresholds(true);
    setThresholdsSaved(false);
    try {
      await settingsApi.update({
        thresholds: {
          minSoilMoisture: Number(thresholds.minSoilMoisture),
          phRange: thresholds.phRange,
          maxEC: Number(thresholds.maxEC),
        },
      }, token);
      setThresholdsSaved(true);
      refetch();
      setTimeout(() => setThresholdsSaved(false), 2000);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to save thresholds.');
    } finally {
      setSavingThresholds(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load settings. {error instanceof ApiError ? error.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={refetch}>Retry</button>
        </div>
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
                <FormField label="Timezone" id="timezone">
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
              <Toggle id="notif-moisture" checked={notifs.lowMoisture} onChange={() => toggleNotif('lowMoisture')} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Low soil moisture alerts</span>
                <span className={ps.toggleRowDesc}>Alert when soil moisture drops below threshold</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-tank" checked={notifs.waterTank} onChange={() => toggleNotif('waterTank')} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Water tank alerts</span>
                <span className={ps.toggleRowDesc}>Alert when tank level falls below 20%</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-sensor" checked={notifs.sensorFailure} onChange={() => toggleNotif('sensorFailure')} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Sensor failure alerts</span>
                <span className={ps.toggleRowDesc}>Alert when any sensor goes offline</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-irrigation" checked={notifs.irrigation} onChange={() => toggleNotif('irrigation')} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Irrigation notifications</span>
                <span className={ps.toggleRowDesc}>Notify when irrigation starts or completes</span>
              </div>
            </div>
            <div className={ps.toggleRow}>
              <Toggle id="notif-orders" checked={notifs.orders} onChange={() => toggleNotif('orders')} />
              <div className={ps.toggleRowText}>
                <span className={ps.toggleRowTitle}>Order notifications</span>
                <span className={ps.toggleRowDesc}>New orders and payment status updates</span>
              </div>
            </div>
            {savingNotifs && <div className="text-xs text-text-secondary mt-1">Saving…</div>}
          </CardBody>
        </Card>
      </div>

      {/* Sensor thresholds */}
      <Card className={ps.lastCard}>
        <CardHeader title="System thresholds" subtitle="Default warning levels for sensor readings" />
        <CardBody>
          <form onSubmit={saveThresholds}>
            <div className={`${ps.grid.threeCol} !mb-0`}>
              <FormField label="Min soil moisture (%)" id="th-moisture">
                <Input id="th-moisture" type="number" value={thresholds.minSoilMoisture} onChange={e => setThresholds({ ...thresholds, minSoilMoisture: e.target.value })} disabled={loading} />
              </FormField>
              <FormField label="Optimal pH range" id="th-ph">
                <Input id="th-ph" value={thresholds.phRange} onChange={e => setThresholds({ ...thresholds, phRange: e.target.value })} disabled={loading} />
              </FormField>
              <FormField label="Max EC level (mS/cm)" id="th-ec">
                <Input id="th-ec" type="number" step="0.1" value={thresholds.maxEC} onChange={e => setThresholds({ ...thresholds, maxEC: e.target.value })} disabled={loading} />
              </FormField>
            </div>
            <div className="mt-3.5 flex items-center gap-2.5">
              <Button variant="primary" type="submit" disabled={loading || savingThresholds}>
                {savingThresholds ? 'Saving…' : 'Save thresholds'}
              </Button>
              {thresholdsSaved && (
                <span className="text-sm text-green-800">
                  <i className="ti ti-check" aria-hidden="true" /> Saved
                </span>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default SettingsPage;
