import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, Button, SearchBar, Select, FormField, Input } from '../components/ui/UI';
import { useApiData } from '../hooks/useApiData';
import { logsApi } from '../api/client';
import * as ps from './pageStyles';

const categoryBadge = {
  auth:       { variant: 'blue',    label: 'Auth'       },
  products:   { variant: 'ok',      label: 'Products'   },
  orders:     { variant: 'warning', label: 'Orders'     },
  users:      { variant: 'purple',  label: 'Users'      },
  irrigation: { variant: 'blue',    label: 'Irrigation' },
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

  const list = logs || [];

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
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load logs. <button className="underline" onClick={refetch}>Retry</button>
        </div>
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
          title="Activity logs"
          subtitle={loading ? 'Loading…' : `${Math.min(filtered.length, startIndex + paginatedLogs.length)} of ${filtered.length} entries`}
        />
        <Table headers={['Date & time', 'User', 'Action', 'Category', 'Status']}>
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
        </Table>

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
