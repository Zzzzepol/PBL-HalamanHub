// ============================================================
// HalamanHub — Chart Components (Chart.js via react-chartjs-2)
// ============================================================
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// Color tokens (resolved to static hex since Chart.js canvas can't read CSS vars reliably)
const COLORS = {
  green:  '#27a85a',
  greenDark: '#1a6b3a',
  blue:   '#1a5fb4',
  amber:  '#c4960f',
  red:    '#e03535',
  grid:   'rgba(120,120,120,0.12)',
  tick:   '#8a9199',
};

const baseOptions = (yLabel, yMin, yMax, formatY) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1f2937',
      titleFont: { size: 11 },
      bodyFont: { size: 11 },
      padding: 8,
      cornerRadius: 6,
    },
  },
  scales: {
    x: {
      grid: { color: COLORS.grid, drawTicks: false },
      ticks: { color: COLORS.tick, font: { size: 10 } },
      border: { display: false },
    },
    y: {
      min: yMin,
      max: yMax,
      grid: { color: COLORS.grid, drawTicks: false },
      ticks: {
        color: COLORS.tick,
        font: { size: 10 },
        callback: formatY || undefined,
      },
      border: { display: false },
      title: yLabel ? { display: true, text: yLabel, color: COLORS.tick, font: { size: 10 } } : undefined,
    },
  },
});

const lineDataset = (label, data, color, fill = false) => ({
  label,
  data,
  borderColor: color,
  backgroundColor: fill ? `${color}33` : 'transparent',
  tension: 0.4,
  fill,
  borderWidth: 2,
  pointRadius: 2,
  pointHoverRadius: 4,
  pointBackgroundColor: color,
});

const barDataset = (label, data, color) => ({
  label,
  data,
  backgroundColor: `${color}99`,
  borderColor: color,
  borderWidth: 1.5,
  borderRadius: 4,
  maxBarThickness: 28,
});

/* ── Soil Moisture Trend (dashboard) ── */
export const MoistureTrendChart = ({ labels, zoneA, zoneB, height = 160 }) => (
  <div style={{ height, position: 'relative' }}>
    <Line
      data={{
        labels,
        datasets: [
          lineDataset('Zone A', zoneA, COLORS.green, true),
          lineDataset('Zone B', zoneB, COLORS.blue),
        ],
      }}
      options={{
        ...baseOptions(null, 40, 90, v => v + '%'),
        plugins: {
          ...baseOptions().plugins,
          legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 }, color: COLORS.tick } },
        },
      }}
    />
  </div>
);

/* ── pH Trend ── */
export const PHTrendChart = ({ labels, values, height = 110 }) => (
  <div style={{ height, position: 'relative' }}>
    <Line
      data={{ labels, datasets: [lineDataset('pH', values, COLORS.green, true)] }}
      options={baseOptions('pH', 5, 8)}
    />
  </div>
);

/* ── EC Trend ── */
export const ECTrendChart = ({ labels, values, height = 110 }) => (
  <div style={{ height, position: 'relative' }}>
    <Line
      data={{ labels, datasets: [lineDataset('EC', values, COLORS.blue, true)] }}
      options={baseOptions('mS/cm', 0, 3)}
    />
  </div>
);

/* ── Water Usage (Bar) ── */
export const WaterUsageChart = ({ labels, values, height = 110 }) => (
  <div style={{ height, position: 'relative' }}>
    <Bar
      data={{ labels, datasets: [barDataset('Litres', values, COLORS.green)] }}
      options={baseOptions('L', 0, undefined)}
    />
  </div>
);

/* ── NPK Trend (multi-line) ── */
export const NPKTrendChart = ({ labels, nitrogen, phosphorus, potassium, height = 160 }) => (
  <div style={{ height, position: 'relative' }}>
    <Line
      data={{
        labels,
        datasets: [
          lineDataset('Nitrogen (N)', nitrogen, COLORS.green),
          lineDataset('Phosphorus (P)', phosphorus, COLORS.blue),
          lineDataset('Potassium (K)', potassium, COLORS.amber),
        ],
      }}
      options={{
        ...baseOptions('mg/kg'),
        plugins: {
          ...baseOptions().plugins,
          legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 }, color: COLORS.tick } },
        },
      }}
    />
  </div>
);

/* ── Irrigation History (grouped bar) ── */
export const IrrigationHistoryChart = ({ labels, zoneA, zoneB, height = 160 }) => (
  <div style={{ height, position: 'relative' }}>
    <Bar
      data={{
        labels,
        datasets: [
          barDataset('Zone A', zoneA, COLORS.greenDark),
          barDataset('Zone B', zoneB, COLORS.blue),
        ],
      }}
      options={{
        ...baseOptions('minutes'),
        plugins: {
          ...baseOptions().plugins,
          legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 }, color: COLORS.tick } },
        },
      }}
    />
  </div>
);

/* ── Temperature & Humidity (dual line) ── */
export const TempHumidityChart = ({ labels, temperature, humidity, height = 160 }) => (
  <div style={{ height, position: 'relative' }}>
    <Line
      data={{
        labels,
        datasets: [
          lineDataset('Temperature (°C)', temperature, COLORS.red),
          lineDataset('Humidity (%)', humidity, COLORS.blue),
        ],
      }}
      options={{
        ...baseOptions(),
        plugins: {
          ...baseOptions().plugins,
          legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 }, color: COLORS.tick } },
        },
      }}
    />
  </div>
);

/* ── Rainwater Collection Forecast (Bar) ── */
export const RainForecastChart = ({ labels, values, forecast, height = 130 }) => (
  <div style={{ height, position: 'relative' }}>
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Litres collected',
          data: values,
          backgroundColor: forecast.map(f => f ? `${COLORS.blue}55` : `${COLORS.blue}AA`),
          borderColor: COLORS.blue,
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 28,
        }],
      }}
      options={{
        ...baseOptions('L'),
        plugins: {
          ...baseOptions().plugins,
          tooltip: {
            ...baseOptions().plugins.tooltip,
            callbacks: {
              label: ctx => forecast[ctx.dataIndex]
                ? `Forecast: ${ctx.raw} L (estimated)`
                : `Collected: ${ctx.raw} L`,
            },
          },
        },
      }}
    />
  </div>
);
