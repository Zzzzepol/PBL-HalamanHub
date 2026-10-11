import React, { useMemo, useState } from 'react';
import { Badge, Card, CardHeader, EmptyState, ErrorState, LoadingSkeleton, SearchBar, StatusBadge, Table } from '../components/ui/UI';
import { sensorsApi } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { useLiveRefetch } from '../hooks/useLiveRefetch';
import { timeAgo } from '../utils/timeAgo';

const sensorTypeLabel = (type = '') => {
  const labels = {
    'Soil moisture': 'Soil wetness',
    'NPK': 'Plant food levels (N, P, K)',
    'pH': 'Soil acidity (pH)',
    'EC': 'Soil salt level (EC)',
    'TDS': 'Water purity (TDS)',
    'Water level': 'Water level',
    'Temperature': 'Temperature',
    'Humidity': 'Humidity',
  };
  return labels[type] || type || 'Sensor';
};

const connectionFor = sensor => sensor.status === 'offline'
  ? { label: 'No signal', status: 'none', rank: 0 }
  : sensor.status === 'warning'
    ? { label: 'Connected · check reading', status: 'check', rank: 1 }
    : { label: 'Connected', status: 'good', rank: 1 };

const SensorsPage = () => {
  const { data: sensors, loading, error, refetch } = useApiData(sensorsApi.getAll, [], 30000, 'admin:sensors:list');
  const [search, setSearch] = useState('');

  useLiveRefetch(['sensor:reading', 'sensor:status'], refetch);

  const list = useMemo(() => sensors || [], [sensors]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return list
      .filter(sensor => !query || `${sensor.sensorId} ${sensor.type} ${sensor.zone} ${sensor.device}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const connectionOrder = connectionFor(a).rank - connectionFor(b).rank;
        if (connectionOrder !== 0) return connectionOrder;
        return new Date(a.lastReadingAt || 0) - new Date(b.lastReadingAt || 0);
      });
  }, [list, search]);

  const connectedCount = list.filter(sensor => sensor.status !== 'offline').length;
  const noSignalCount = list.length - connectedCount;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-text-primary">Sensor details and connections</h2>
        <p className="mt-1 text-sm text-text-secondary">See which devices are connected and when they last checked in.</p>
      </header>

      {error && <ErrorState title="Sensor connections are not loading" description="Check your connection, then try again." onRetry={refetch} />}

      {(!error || sensors !== null) && <>
        <section className="grid grid-cols-2 gap-3" aria-label="Connection summary">
          <Card>
            <CardHeader title="Connected" />
            <div className="px-4 pb-4 pt-1">
              {loading ? <LoadingSkeleton className="h-8 w-16" /> : <p className="text-2xl font-semibold text-text-primary">{connectedCount}</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="No signal" />
            <div className="px-4 pb-4 pt-1">
              {loading ? <LoadingSkeleton className="h-8 w-16" /> : <p className="text-2xl font-semibold text-text-primary">{noSignalCount}</p>}
            </div>
          </Card>
        </section>

        <div className="max-w-xl">
          <SearchBar value={search} onChange={setSearch} placeholder="Search sensors or areas…" />
        </div>

        <Card>
          <CardHeader title="Sensor connections" subtitle={loading ? 'Loading connections…' : `${filtered.length} of ${list.length} sensors`} />

          {loading ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map(item => <LoadingSkeleton key={item} className="h-32" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="ti-plug-connected"
              title={list.length === 0 ? 'No sensors found' : 'No matching sensors'}
              description={list.length === 0 ? 'Connected sensor details will appear here.' : 'Try another sensor name or area.'}
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table headers={['Sensor', 'Type', 'Area', 'Connection', 'Last seen', 'Device']}>
                  {filtered.map(sensor => {
                    const connection = connectionFor(sensor);
                    return (
                      <tr key={sensor._id}>
                        <td className="font-medium">{sensor.sensorId}</td>
                        <td>{sensorTypeLabel(sensor.type)}</td>
                        <td>{sensor.zone || '—'}</td>
                        <td><StatusBadge status={connection.status} label={connection.label} /></td>
                        <td>{timeAgo(sensor.lastReadingAt)}</td>
                        <td><Badge variant="default">{sensor.device || '—'}</Badge></td>
                      </tr>
                    );
                  })}
                </Table>
              </div>
              <div className="grid gap-3 p-3 lg:hidden">
                {filtered.map(sensor => {
                  const connection = connectionFor(sensor);
                  return (
                    <article key={sensor._id} className="rounded-xl border border-border bg-bg-primary p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-text-primary">{sensorTypeLabel(sensor.type)}</h3>
                          <p className="mt-1 text-sm text-text-secondary">{sensor.sensorId}{sensor.zone ? ` · ${sensor.zone}` : ''}</p>
                        </div>
                        <StatusBadge status={connection.status} label={connection.label} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-text-secondary">
                        <span>Last seen: {timeAgo(sensor.lastReadingAt)}</span>
                        <span>Device: {sensor.device || '—'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </>}
    </div>
  );
};

export default SensorsPage;
