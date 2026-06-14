import React, { useState } from 'react';
import { Card, CardHeader, CardBody, StatCard, Badge, Toggle } from '../components/ui/UI';
import { RainForecastChart } from '../components/charts/Charts';
import { chartData } from '../data/mockData';
import * as ps from './pageStyles';

const RainwaterPage = () => {
  const [autoSwitch, setAutoSwitch] = useState(true);

  return (
    <div>
      {/* Stats */}
      <div className={ps.grid.stats4}>
        <StatCard icon="ti-cloud-rain" iconVariant="green" value="984 L" label="Tank level" />
        <StatCard icon="ti-droplets" iconVariant="blue" value="120 L" label="Collected tonight" />
        <StatCard icon="ti-leaf" iconVariant="green" value="Rainwater" label="Active source" />
        <StatCard icon="ti-chart-pie" iconVariant="amber" value="860 L" label="Used this week" />
      </div>

      <div className={ps.grid.twoCol}>
        {/* Source control */}
        <Card>
          <CardHeader title="Water source control" subtitle="Manage which source feeds the irrigation network" />
          <CardBody>
            <div className="flex items-center gap-2.5 pb-3 mb-3 border-b-[0.5px] border-border">
              <i className="ti ti-cloud-rain text-xl text-green-600" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-base font-medium">Rainwater tank</div>
                <div className="text-sm text-text-secondary">Primary — 984 L available</div>
              </div>
              <Badge variant="ok">Active</Badge>
            </div>
            <div className="flex items-center gap-2.5">
              <i className="ti ti-droplet text-xl text-text-secondary" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-base font-medium">Municipal water</div>
                <div className="text-sm text-text-secondary">Backup source</div>
              </div>
              <Badge>Standby</Badge>
            </div>
            <div className="mt-4">
              <Toggle id="auto-switch" checked={autoSwitch} onChange={() => setAutoSwitch(!autoSwitch)} label="Auto-switch to municipal when tank below 20%" />
            </div>
          </CardBody>
        </Card>

        {/* Forecast */}
        <Card>
          <CardHeader title="Collection forecast" subtitle="Based on local weather data" />
          <CardBody>
            <RainForecastChart
              labels={chartData.rainForecast.labels}
              values={chartData.rainForecast.values}
              forecast={chartData.rainForecast.forecast}
            />
            <div className="text-sm text-text-secondary mt-2.5 flex items-start gap-1.5">
              <i className="ti ti-info-circle flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>Rain expected Thursday–Saturday. Estimated 280 L harvest based on forecast data.</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Consumption breakdown */}
      <Card className={ps.lastCard}>
        <CardHeader title="Water consumption — this week" subtitle="Source breakdown by zone" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <div className="text-sm text-text-secondary mb-2">By zone</div>
              {[
                { zone: 'Zone A', litres: 420, pct: 49 },
                { zone: 'Zone B', litres: 310, pct: 36 },
                { zone: 'Zone C', litres: 130, pct: 15 },
              ].map(z => (
                <div key={z.zone} className="mb-2.5">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{z.zone}</span>
                    <span className="font-medium">{z.litres} L</span>
                  </div>
                  <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-green-600" style={{ width: `${z.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-sm text-text-secondary mb-2">By source</div>
              {[
                { source: 'Rainwater tank', litres: 730, pct: 85, color: 'bg-green-600' },
                { source: 'Municipal water', litres: 130, pct: 15, color: 'bg-blue-700' },
              ].map(item => (
                <div key={item.source} className="mb-2.5">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.source}</span>
                    <span className="font-medium">{item.litres} L ({item.pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default RainwaterPage;
