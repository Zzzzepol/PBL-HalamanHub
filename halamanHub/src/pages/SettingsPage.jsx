import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody, Button, Toggle, FormField, Input, Select, ErrorState } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { settingsApi } from '../api/client';
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
    lowStock: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Populate local form state once settings load
  useEffect(() => {
    if (settings) {
      setFarmName(settings.farmName);
      setLocation(settings.location);
      setTimezone(settings.timezone);
      setNotifs(settings.notifications);
    }
  }, [settings]);

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
