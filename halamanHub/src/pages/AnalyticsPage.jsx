import React, { useState } from 'react';
import { Card, CardHeader, CardBody, Button } from '../components/ui/UI';
import {
  PHTrendChart, ECTrendChart, WaterUsageChart,
  NPKTrendChart, IrrigationHistoryChart, TempHumidityChart,
} from '../components/charts/Charts';
import { chartData } from '../data/mockData';
import * as s from './pageStyles';

const ranges = ['Daily', 'Weekly', 'Monthly'];

const AnalyticsPage = () => {
  const [range, setRange] = useState('Weekly');

  return (
    <div>
      {/* Header actions */}
      <div className={s.filterBar}>
        <div className={s.btnRow}>
          {ranges.map(r => (
            <Button key={r} size="sm" variant={range === r ? 'primary' : 'default'} onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
        </div>
        <div className={`${s.btnRow} ml-auto`}>
          <Button size="sm" icon="ti-file-text">Export PDF</Button>
          <Button size="sm" variant="primary" icon="ti-file-spreadsheet">Export Excel</Button>
        </div>
      </div>

      {/* pH / EC / Water usage */}
      <div className={s.grid.threeCol}>
        <Card>
          <CardHeader title="pH trend" subtitle="Last 7 days, Zone A" />
          <CardBody><PHTrendChart labels={chartData.phTrend.labels} values={chartData.phTrend.values} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="EC trend" subtitle="Last 7 days, Zone A" />
          <CardBody><ECTrendChart labels={chartData.ecTrend.labels} values={chartData.ecTrend.values} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Water consumption" subtitle="Litres per day" />
          <CardBody><WaterUsageChart labels={chartData.waterUsage.labels} values={chartData.waterUsage.values} /></CardBody>
        </Card>
      </div>

      {/* NPK + Irrigation history */}
      <div className={s.grid.twoCol}>
        <Card>
          <CardHeader title="NPK trends" subtitle="7-day rolling average, Zone A" />
          <CardBody>
            <NPKTrendChart
              labels={chartData.npkTrend.labels}
              nitrogen={chartData.npkTrend.nitrogen}
              phosphorus={chartData.npkTrend.phosphorus}
              potassium={chartData.npkTrend.potassium}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Irrigation history" subtitle="Session duration (minutes)" />
          <CardBody>
            <IrrigationHistoryChart
              labels={chartData.irrigationHistory.labels}
              zoneA={chartData.irrigationHistory.zoneA}
              zoneB={chartData.irrigationHistory.zoneB}
            />
          </CardBody>
        </Card>
      </div>

      {/* Temp & humidity */}
      <Card className={s.lastCard}>
        <CardHeader title="Temperature & humidity" subtitle="7-day overview, Zone A" />
        <CardBody>
          <TempHumidityChart
            labels={chartData.tempHumidity.labels}
            temperature={chartData.tempHumidity.temperature}
            humidity={chartData.tempHumidity.humidity}
          />
        </CardBody>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
