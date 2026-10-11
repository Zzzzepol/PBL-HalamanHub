import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, Button, SearchBar, Select, FormField, Input, ErrorState, EmptyState } from '../components/ui/UI';
import { useApiData } from '../hooks/useApiData';
import { logsApi } from '../api/client';
import * as ps from './pageStyles';

const categoryBadge = {
  auth:       { variant: 'blue',    label: 'Auth'       },
  products:   { variant: 'ok',      label: 'Products'   },
  orders:     { variant: 'warning', label: 'Orders'     },
  users:      { variant: 'purple',  label: 'Users'      },
  irrigation: { variant: 'blue',    label: 'Watering' },
  settings:   { variant: 'default', label: 'Settings'   },
  sensors:    { variant: 'default', label: 'Sensors'    },
};

const statusBadge = {
  success: { variant: 'ok',    label: 'Success' },
  failed:  { variant: 'error', label: 'Failed'  },
};

const formatDate = (iso) => new Date(iso).toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
});

const PAGE_SIZE = 25;

const LogsPage = () => {
  const { data: logs, loading, error, refetch } = useApiData(logsApi.getAll, [], 10000);

  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const list = useMemo(() => logs || [], [logs]);

  const filtered = useMemo(() => list.filter(l => {
    // search filter
    const matchSearch = `${l.user} ${l.action} ${l.details}`
      .toLowerCase()
      .includes(search.toLowerCase());

    // category filter
    const matchCat = catFilter === 'all' || l.category === catFilter;

    // date filters
    const logDate = new Date(l.createdAt);

    const matchFrom = fromDate
      ? logDate >= new Date(fromDate + 'T00:00:00')
      : true;

    const matchTo = toDate
      ? logDate <= new Date(toDate + 'T23:59:59')
      : true;

    return matchSearch && matchCat && matchFrom && matchTo;
  }), [list, search, catFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedLogs = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, catFilter, fromDate, toDate]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearch('');
    setCatFilter('all');
    setFromDate('');
    setToDate('');
  };

  const hasFilters = search || catFilter !== 'all' || fromDate || toDate;

  return (
    <div>
      {error && (
        <div className="mb-4"><ErrorState title="Activity history is not loading" description="Check your connection, then try again." onRetry={refetch} /></div>
      )}

      {/* Filters */}
      <div className={ps.filterBar}>
        <div className={ps.filterSearch}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by user or action…"
          />
        </div>

        <Select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">All categories</option>
          <option value="auth">Auth</option>
          <option value="products">Products</option>
          <option value="orders">Orders</option>
          <option value="users">Users</option>
          <option value="irrigation">Irrigation</option>
          <option value="settings">Settings</option>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <FormField label="" id="from-date">
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </FormField>
          <span className="text-text-secondary text-sm">to</span>
          <FormField label="" id="to-date">
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </FormField>
        </div>

        {/* Clear filters button — only shows when filters are active */}
        {hasFilters && (
          <Button icon="ti-x" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <Card className={ps.lastCard}>
        <CardHeader
          title="Activity history"
          subtitle={loading ? 'Loading…' : `${Math.min(filtered.length, startIndex + paginatedLogs.length)} of ${filtered.length} entries`}
        />
        <div className="hidden xl:block"><Table headers={['Date & time', 'User', 'Action', 'Category', 'Status']}>
          {paginatedLogs.map(l => {
            const cb = categoryBadge[l.category] || categoryBadge.auth;
            const sb = statusBadge[l.status]     || statusBadge.success;
            return (
              <tr key={l._id}>
                <td className="whitespace-nowrap">{formatDate(l.createdAt)}</td>
                <td>{l.user}</td>
                <td>{l.action}</td>
                <td><Badge variant={cb.variant}>{cb.label}</Badge></td>
                <td><Badge variant={sb.variant}>{sb.label}</Badge></td>
              </tr>
            );
          })}
          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-text-secondary py-6">
                No logs found{hasFilters ? ' — try adjusting your filters' : ''}.
              </td>
            </tr>
          )}
        </Table></div>
        <div className="grid gap-3 p-3 xl:hidden">
          {paginatedLogs.map(log => {
            const cb = categoryBadge[log.category] || categoryBadge.auth;
            const sb = statusBadge[log.status] || statusBadge.success;
            return <article key={log._id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-text-primary">{log.action}</h3><p className="text-sm text-text-secondary">{log.user}</p></div><Badge variant={sb.variant}>{sb.label}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={cb.variant}>{cb.label}</Badge><time className="text-sm text-text-secondary">{formatDate(log.createdAt)}</time></div><p className="mt-2 break-words text-sm text-text-secondary">{log.details}</p></article>;
          })}
          {!loading && filtered.length === 0 && <EmptyState icon="ti-clipboard-list" title="No activity found" description={hasFilters ? 'Try changing or clearing your filters.' : 'Recent changes will appear here.'} />}
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-3 border-t border-border-subtle">
            <div className="text-sm text-text-secondary">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button size="sm" variant="default" type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default LogsPage;
