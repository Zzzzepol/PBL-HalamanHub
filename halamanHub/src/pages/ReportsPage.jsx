import React, { useState } from 'react';
import { Card, CardHeader, CardBody, Button, FormField, Input, Select } from '../components/ui/UI';
import * as ps from './pageStyles';

const ReportsPage = () => {
  const [fromDate, setFromDate] = useState('2026-06-01');
  const [toDate, setToDate] = useState('2026-06-11');
  const [dataType, setDataType] = useState('All sensor data');
  const [format, setFormat] = useState('PDF');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const generate = (e) => {
    e.preventDefault();
    setGenerating(true);
    setDone(false);
    setTimeout(() => { setGenerating(false); setDone(true); }, 1200);
  };

  return (
    <div>
      {/* Quick export cards */}
      <div className={ps.grid.threeCol}>
        <Card>
          <div className={ps.reportCard} onClick={() => alert('Generating daily crop report (PDF)…')}>
            <div className={`${ps.reportIcon} bg-red-50 text-red-800`}>
              <i className="ti ti-file-text" aria-hidden="true" />
            </div>
            <div className={ps.reportTitle}>Daily crop report</div>
            <div className={ps.reportDesc}>Sensors, irrigation, and alerts summary</div>
            <Button size="sm" icon="ti-file-download">Export PDF</Button>
          </div>
        </Card>
        <Card>
          <div className={ps.reportCard} onClick={() => alert('Generating sensor data export (Excel)…')}>
            <div className={`${ps.reportIcon} bg-green-50 text-green-800`}>
              <i className="ti ti-file-spreadsheet" aria-hidden="true" />
            </div>
            <div className={ps.reportTitle}>Sensor data export</div>
            <div className={ps.reportDesc}>Raw readings across all zones</div>
            <Button size="sm" icon="ti-file-download">Export Excel</Button>
          </div>
        </Card>
        <Card>
          <div className={ps.reportCard} onClick={() => window.print()}>
            <div className={`${ps.reportIcon} bg-blue-50 text-blue-700`}>
              <i className="ti ti-printer" aria-hidden="true" />
            </div>
            <div className={ps.reportTitle}>Print report</div>
            <div className={ps.reportDesc}>Formatted for A4 / Letter paper</div>
            <Button size="sm" icon="ti-printer">Print</Button>
          </div>
        </Card>
      </div>

      {/* Custom date range */}
      <Card>
        <CardHeader title="Custom date range report" subtitle="Generate historical reports for any period" />
        <CardBody>
          <form onSubmit={generate}>
            <div className={ps.grid.formRow}>
              <FormField label="From date" id="from-date">
                <Input id="from-date" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </FormField>
              <FormField label="To date" id="to-date">
                <Input id="to-date" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </FormField>
            </div>
            <div className={ps.grid.formRow}>
              <FormField label="Data type" id="data-type">
                <Select id="data-type" value={dataType} onChange={e => setDataType(e.target.value)}>
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
                <Select id="export-format" value={format} onChange={e => setFormat(e.target.value)}>
                  <option>PDF</option>
                  <option>Excel (.xlsx)</option>
                  <option>CSV</option>
                </Select>
              </FormField>
            </div>
            <Button variant="primary" type="submit" icon="ti-download" disabled={generating}>
              {generating ? 'Generating…' : 'Generate report'}
            </Button>
            {done && (
              <div className="mt-2.5 text-sm text-green-800 flex items-center gap-1.5">
                <i className="ti ti-check" aria-hidden="true" />
                Report generated: {dataType} ({format}), {fromDate} to {toDate}
              </div>
            )}
          </form>
        </CardBody>
      </Card>

      {/* Recent reports */}
      <Card className={ps.lastCard}>
        <CardHeader title="Recent reports" subtitle="Previously generated exports" />
        <CardBody>
          {[
            { name: 'Weekly sensor summary', date: 'Jun 8 – Jun 11, 2026', format: 'PDF', icon: 'ti-file-text', color: 'text-red-800' },
            { name: 'Irrigation history — Zone A', date: 'Jun 1 – Jun 11, 2026', format: 'Excel', icon: 'ti-file-spreadsheet', color: 'text-green-800' },
            { name: 'Monthly sales report', date: 'May 2026', format: 'PDF', icon: 'ti-file-text', color: 'text-red-800' },
          ].map((r, i) => (
            <div key={i} className={`flex items-center gap-3 py-2.5 ${i < 2 ? 'border-b-[0.5px] border-border' : ''}`}>
              <i className={`ti ${r.icon} text-lg ${r.color}`} aria-hidden="true" />
              <div className="flex-1">
                <div className="text-base">{r.name}</div>
                <div className="text-xs text-text-secondary">{r.date} · {r.format}</div>
              </div>
              <Button size="sm" icon="ti-download">Download</Button>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
};

export default ReportsPage;
