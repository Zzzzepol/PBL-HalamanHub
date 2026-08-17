import React, { useState } from 'react';
import {
  Card, CardHeader, CardBody, Button, FormField, Input, Select,
} from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { reportsApi, ApiError } from '../api/client';
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
    } catch (err) {
      setGenError(
        err instanceof ApiError ? err.message : 'Failed to generate report.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const generate = (e) => {
    e.preventDefault();

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      setGenError('The "From date" cannot be later than the "To date".');
      return;
    }

    runReport(dataType, format, fromDate, toDate);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleCardKeyDown = (e, type, fmt, from, to) => {
    if ((e.key === 'Enter' || e.key === ' ') && !generating) {
      runReport(type, fmt, from, to);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Quick export cards */}
      <div className={ps.grid.threeCol}>
        <Card>
          <div
            className={ps.reportCard}
            onClick={() => !generating && runReport('All sensor data', 'PDF', todayStr, todayStr)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleCardKeyDown(e, 'All sensor data', 'PDF', todayStr, todayStr)}
          >
            <div className={`${ps.reportIcon} bg-red-50 text-red-800`}>
              <i className="ti ti-file-text" aria-hidden="true" />
            </div>

            <div className={ps.reportTitle}>Daily crop report</div>
            <div className={ps.reportDesc}>
              Today's sensor readings in a formatted PDF report
            </div>

            <Button size="sm" icon="ti-file-download" disabled={generating}>
              Export PDF
            </Button>
          </div>
        </Card>

        <Card>
          <div
            className={ps.reportCard}
            onClick={() => !generating && runReport('All sensor data', 'Excel (.xlsx)')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleCardKeyDown(e, 'All sensor data', 'Excel (.xlsx)')}
          >
            <div className={`${ps.reportIcon} bg-green-50 text-green-800`}>
              <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            </div>

            <div className={ps.reportTitle}>Sensor data report</div>
            <div className={ps.reportDesc}>
              Last 30 days of sensor readings in a formatted Excel report
            </div>

            <Button size="sm" icon="ti-file-download" disabled={generating}>
              Export Excel
            </Button>
          </div>
        </Card>

        <Card>
          <div
            className={ps.reportCard}
            onClick={() => !generating && runReport('Orders & sales', 'PDF')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleCardKeyDown(e, 'Orders & sales', 'PDF')}
          >
            <div className={`${ps.reportIcon} bg-blue-50 text-blue-700`}>
              <i className="ti ti-chart-bar" aria-hidden="true" />
            </div>

            <div className={ps.reportTitle}>Sales report</div>
            <div className={ps.reportDesc}>
              Orders and sales data in a professional PDF report
            </div>

            <Button size="sm" icon="ti-file-download" disabled={generating}>
              Export Sales PDF
            </Button>
          </div>
        </Card>
      </div>

      {/* Custom report */}
      <Card className={ps.lastCard}>
        <CardHeader
          title="Custom report"
          subtitle="Generate a professional report from your live MongoDB data for any period"
        />

        <CardBody>
          <form onSubmit={generate}>
            <div className={ps.grid.formRow}>
              <FormField label="From date" id="from-date">
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </FormField>

              <FormField label="To date" id="to-date">
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
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
                  <option>Soil moisture only</option>
                  <option>pH & EC trends</option>
                  <option>NPK nutrient levels</option>
                  <option>Irrigation history</option>
                  <option>Rainwater harvesting</option>
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