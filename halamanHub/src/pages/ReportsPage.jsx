import React, { useState } from 'react';
import {
  Card, CardHeader, CardBody, Button, FormField, Input, Select,
} from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../api/client';
import * as ps from './pageStyles';

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
};

const ReportsPage = () => {
  const { token } = useAuth();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateMode, setDateMode] = useState('custom'); // 'custom' | 'all'
  const [dataType, setDataType] = useState('All sensor data');
  const [format, setFormat] = useState('PDF');

  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [genError, setGenError] = useState('');

  const runReport = async (type, fmt, from = '', to = '') => {
    setGenerating(true);
    setGenError('');
    setDone(false);

    try {
      const { blob, filename } = await reportsApi.generate(
        {
          dataType: type,
          format: fmt,
          from: from || '',
          to: to || '',
        },
        token
      );

      downloadBlob(blob, filename);
      setDone(true);

      setTimeout(() => {
        setDone(false);
      }, 3000);
    } catch {
      setGenError('We could not create the report. Check the date range and try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generate = (e) => {
    e.preventDefault();

    // "All time" always sends empty dates, regardless of whatever the
    // (disabled) inputs still hold from before the tab was switched.
    const from = dateMode === 'all' ? '' : fromDate;
    const to = dateMode === 'all' ? '' : toDate;

    if (from && to && new Date(from) > new Date(to)) {
      setGenError('The "From date" cannot be later than the "To date".');
      return;
    }

    runReport(dataType, format, from, to);
  };

  return (
    <div className="space-y-3.5">
      {/* Custom report */}
      <Card className={ps.lastCard}>
        <CardHeader
          title="Custom report"
          subtitle="Create a report from readings and nursery activity for any period."
        />

        <CardBody>
          <form onSubmit={generate}>
            {/* Date range tabs */}
            <div className="text-xs font-medium text-text-secondary mb-1.5">Date range</div>
            <div className="inline-flex rounded-md border border-border overflow-hidden mb-3.5">
              <button
                type="button"
                onClick={() => setDateMode('custom')}
                className={`min-h-11 px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  dateMode === 'custom' ? 'bg-green-700 text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                Custom range
              </button>
              <button
                type="button"
                onClick={() => { setDateMode('all'); setFromDate(''); setToDate(''); }}
                className={`min-h-11 px-3.5 py-1.5 text-sm font-medium border-l border-border transition-colors ${
                  dateMode === 'all' ? 'bg-green-700 text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                All time
              </button>
            </div>

            <div className={ps.grid.formRow}>
              <FormField label="From date" id="from-date">
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={dateMode === 'all'}
                />
              </FormField>

              <FormField label="To date" id="to-date">
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={dateMode === 'all'}
                />
              </FormField>
            </div>

            <div className={ps.grid.formRow}>
              <FormField label="Report type" id="data-type">
                <Select
                  id="data-type"
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                >
                  <option>All sensor data</option>
                  <option value="Soil moisture only">Soil wetness</option>
                  <option value="pH & EC trends">Soil acidity and salt levels</option>
                  <option value="NPK nutrient levels">Plant food levels (N, P, K)</option>
                  <option>Irrigation history</option>
                  <option value="Rainwater harvesting">Rain tank readings</option>
                  <option>Orders & sales</option>
                </Select>
              </FormField>

              <FormField label="Export format" id="export-format">
                <Select
                  id="export-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option>PDF</option>
                  <option>Excel (.xlsx)</option>
                  <option>CSV</option>
                </Select>
              </FormField>
            </div>

            <Button
              variant="primary"
              type="submit"
              icon="ti-download"
              disabled={generating}
            >
              {generating ? 'Generating report…' : 'Generate report'}
            </Button>

            {done && (
              <div className="mt-2.5 text-sm text-green-800 flex items-center gap-1.5">
                <i className="ti ti-check" aria-hidden="true" />
                Report downloaded successfully.
              </div>
            )}

            {genError && (
              <div className="mt-2.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
                {genError}
              </div>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default ReportsPage;
