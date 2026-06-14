import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, StatCard, SearchBar, Select } from '../components/ui/UI';
import { useApiData } from '../hooks/useApiData';
import { sensorsApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const statusBadge = {
  ok: { variant: 'ok', label: 'Online' },
  warning: { variant: 'warning', label: 'Warning' },
  offline: { variant: 'error', label: 'Offline' },
};

const formatTime = (iso) => {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

const SensorsPage = () => {
  const { data: sensors, loading, error, refetch } = useApiData(sensorsApi.getAll);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All zones');
  const [statusFilter, setStatusFilter] = useState('All statuses');

  const list = useMemo(() => sensors || [], [sensors]);

  const zones = ['All zones', ...new Set(list.map(s => s.zone))];
  const statuses = ['All statuses', 'Online', 'Warning', 'Offline'];

  const filtered = useMemo(() => {
    return list.filter(s => {
      const matchesSearch = `${s.sensorId} ${s.type} ${s.zone} ${s.device}`.toLowerCase().includes(search.toLowerCase());
      const matchesZone = zoneFilter === 'All zones' || s.zone === zoneFilter;
      const matchesStatus = statusFilter === 'All statuses' || statusBadge[s.status]?.label === statusFilter;
      return matchesSearch && matchesZone && matchesStatus;
    });
  }, [list, search, zoneFilter, statusFilter]);

  const counts = useMemo(() => ({
    online: list.filter(s => s.status === 'ok').length,
    warning: list.filter(s => s.status === 'warning').length,
    offline: list.filter(s => s.status === 'offline').length,
    total: list.length,
  }), [list]);

  return (
    <div>
      {/* Summary stats */}
      <div className={ps.grid.stats4}>
        <StatCard icon="ti-circle-check" iconVariant="green" value={counts.online} label="Online" />
        <StatCard icon="ti-alert-triangle" iconVariant="amber" value={counts.warning} label="Warning" />
        <StatCard icon="ti-wifi-off" iconVariant="red" value={counts.offline} label="Offline" />
        <StatCard icon="ti-device-floppy" iconVariant="blue" value={counts.total} label="Total sensors" />
      </div>

      {error && (
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load sensors. {error instanceof ApiError ? error.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={refetch}>Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className={ps.filterBar}>
        <div className={ps.filterSearch}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by ID, type, zone, device…" />
        </div>
        <Select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
          {zones.map(z => <option key={z} value={z}>{z}</option>)}
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {/* Table */}
      <Card className={ps.lastCard}>
        <CardHeader title="All sensors" subtitle={loading ? 'Loading…' : `${filtered.length} of ${list.length} sensors`} />
        <Table headers={['Sensor ID', 'Type', 'Zone', 'Current value', 'Status', 'Last update', 'Device']}>
          {filtered.map(s => {
            const badge = statusBadge[s.status] || statusBadge.ok;
            return (
              <tr key={s._id}>
                <td>{s.sensorId}</td>
                <td>{s.type}</td>
                <td>{s.zone}</td>
                <td>{s.value}</td>
                <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                <td>{formatTime(s.lastReadingAt)}</td>
                <td>{s.device}</td>
              </tr>
            );
          })}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={7} className="text-center text-text-secondary py-6">
              No sensors match your filters.
            </td></tr>
          )}
        </Table>
      </Card>
    </div>
  );
};

export default SensorsPage;
