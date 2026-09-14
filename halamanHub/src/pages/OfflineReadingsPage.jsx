// HalamanHub — Offline Readings Page
// Shown ONLY to the offline-readonly account (see ProtectedRoute.jsx).
// Pulls the last known reading from GET /api/sensor-data/live on load,
// then updates live via the 'sensor:reading' socket event — neither of
// which touches MongoDB, so this works even when the database is down.

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { socket } from '../socket';
import { getSoilRecommendations } from '../utils/soilRecommendations';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const ReadingCard = ({ icon, label, value, unit }) => (
  <div className="bg-bg-secondary rounded-md p-5">
    <div className="w-9 h-9 rounded-sm flex items-center justify-center mb-3 text-base bg-green-100 text-green-700">
      <i className={`ti ${icon}`} aria-hidden="true" />
    </div>
    <div className="text-[26px] font-medium leading-[1.1] text-text-primary">
      {value ?? '—'}
      {unit && value != null ? <span className="text-base text-text-secondary ml-1">{unit}</span> : null}
    </div>
    <div className="text-sm text-text-secondary mt-1">{label}</div>
  </div>
);

const OfflineReadingsPage = () => {
  const { logout, user } = useAuth();
  const [reading, setReading] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Initial load — last known reading, straight from memory (no DB).
  useEffect(() => {
    const token = localStorage.getItem('halamanhub_token');
    fetch(`${API_BASE}/sensor-data/live`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('No reading received yet.');
        return res.json();
      })
      .then((data) => {
        setReading(data);
        setLastUpdated(data.recordedAt);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Live updates as they stream in over USB serial / WiFi.
  useEffect(() => {
    const handleReading = (data) => {
      setReading(data);
      setLastUpdated(data.recordedAt || new Date().toISOString());
      setError(null);
    };
    socket.on('sensor:reading', handleReading);
    return () => socket.off('sensor:reading', handleReading);
  }, []);

  const soil = reading?.soil || {};
  const air = reading?.air || {};
  const watering = reading?.watering || {};

  const recommendations = useMemo(() => {
    if (!reading) return [];
    return getSoilRecommendations({
      ph: soil.ph,
      ec: soil.ec,
      nitrogen: soil.nitrogen,
      phosphorus: soil.phosphorus,
      potassium: soil.potassium,
      temperature: air.temperature,
      humidity: air.humidity,
    });
  }, [reading]); // eslint-disable-line react-hooks/exhaustive-deps

  const recTone = {
    high: 'border-red-200 bg-red-50/60',
    medium: 'border-amber-200 bg-amber-50/60',
    low: 'border-blue-200 bg-blue-50/60',
    ok: 'border-green-200 bg-green-50/60',
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-medium text-text-primary">Live Sensor Readings</h1>
            <p className="text-sm text-text-secondary mt-1">
              Offline mode — {user?.name || 'Offline Viewer'} · read-only
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md border-[0.5px] border-border"
          >
            Log out
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6 text-sm">
          <span className={`w-2 h-2 rounded-full ${reading ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-text-secondary">
            {reading
              ? `Last updated ${new Date(lastUpdated).toLocaleTimeString()}`
              : error || 'Waiting for the first reading…'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <ReadingCard icon="ti-droplet" label="Soil moisture" value={soil.moisture} unit="%" />
          <ReadingCard icon="ti-temperature" label="Soil temperature" value={soil.temperature} unit="°C" />
          <ReadingCard icon="ti-bolt" label="EC" value={soil.ec} unit="uS/cm" />
          <ReadingCard icon="ti-flask" label="pH" value={soil.ph} unit="" />
          <ReadingCard
            icon="ti-leaf"
            label="N / P / K"
            value={
              soil.nitrogen != null
                ? `${soil.nitrogen}/${soil.phosphorus}/${soil.potassium}`
                : null
            }
            unit="mg/kg"
          />
          <ReadingCard icon="ti-cloud" label="Air humidity" value={air.humidity} unit="%" />
          <ReadingCard icon="ti-thermometer" label="Air temperature" value={air.temperature} unit="°C" />
          <ReadingCard icon="ti-glass-full" label="Water tank level" value={watering.levelPercent} unit="%" />
          <ReadingCard
            icon="ti-pump"
            label="Active source"
            value={watering.pumpActive ? 'PUMP' : watering.solenoidActive ? 'SOLENOID' : 'NONE'}
            unit=""
          />
        </div>

        {recommendations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-medium text-text-primary mb-3">Soil & environment recommendations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map((rec, idx) => (
                <div key={idx} className={`border rounded-md p-3 ${recTone[rec.severity] || recTone.low}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-text-primary">{rec.category}</div>
                    {rec.reading && <div className="text-sm font-semibold text-text-primary">{rec.reading}</div>}
                  </div>
                  <div className="text-sm text-text-secondary mt-1 leading-snug">{rec.message}</div>
                  {rec.fix && (
                    <div className="text-sm mt-2 leading-snug">
                      <span className="font-medium text-text-primary">Fix: </span>
                      <span className="text-text-secondary">{rec.fix}</span>
                    </div>
                  )}
                  {rec.diyTip && (
                    <div className="text-sm mt-1.5 leading-snug bg-green-50/70 border border-green-100 rounded px-2 py-1.5">
                      <span className="font-medium text-green-800">DIY option: </span>
                      <span className="text-green-900/80">{rec.diyTip}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineReadingsPage;
