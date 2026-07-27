const SensorReading = require('../models/SensorReading');
const IrrigationLog = require('../models/IrrigationLog');
const ShopOrder = require('../models/ShopOrder');

function dateRange(from, to) {
  const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000) : new Date(); // include the whole "to" day
  return { start, end };
}

async function buildReportData(dataType, from, to) {
  const { start, end } = dateRange(from, to);

  switch (dataType) {
    case 'Soil moisture only': {
      const rows = await SensorReading.find({ recordedAt: { $gte: start, $lt: end } }).sort({ recordedAt: 1 });
      return { columns: ['Date/Time', 'Soil moisture (%)'], rows: rows.map(r => [r.recordedAt.toISOString(), r.soilMoisture]) };
    }
    case 'pH & EC trends': {
      const rows = await SensorReading.find({ recordedAt: { $gte: start, $lt: end } }).sort({ recordedAt: 1 });
      return { columns: ['Date/Time', 'pH', 'EC (uS/cm)'], rows: rows.map(r => [r.recordedAt.toISOString(), r.ph, r.ec]) };
    }
    case 'NPK nutrient levels': {
      const rows = await SensorReading.find({ recordedAt: { $gte: start, $lt: end } }).sort({ recordedAt: 1 });
      return {
        columns: ['Date/Time', 'Nitrogen (mg/kg)', 'Phosphorus (mg/kg)', 'Potassium (mg/kg)'],
        rows: rows.map(r => [r.recordedAt.toISOString(), r.nitrogen, r.phosphorus, r.potassium]),
      };
    }
    case 'Irrigation history': {
      const rows = await IrrigationLog.find({ occurredAt: { $gte: start, $lt: end } }).sort({ occurredAt: 1 });
      return {
        columns: ['Date/Time', 'Source', 'Action', 'Reason', 'Moisture at event (%)'],
        rows: rows.map(r => [r.occurredAt.toISOString(), r.source, r.action, r.reason, r.moistureAtEvent]),
      };
    }
    case 'Rainwater harvesting': {
      const rows = await SensorReading.find({ recordedAt: { $gte: start, $lt: end } }).sort({ recordedAt: 1 });
      return {
        columns: ['Date/Time', 'Distance (cm)', 'Fill level (%)', 'Water available'],
        rows: rows.map(r => [r.recordedAt.toISOString(), r.distanceCm, r.levelPercent, r.waterAvailable ? 'Yes' : 'No']),
      };
    }
    case 'Orders & sales': {
      const rows = await ShopOrder.find({ orderDate: { $gte: start, $lt: end } }).sort({ orderDate: 1 });
      return {
        columns: ['Order #', 'Customer', 'Amount (₱)', 'Payment', 'Status', 'Date'],
        rows: rows.map(r => [r.orderNumber, r.customer, r.amount, r.payment, r.status, r.orderDate.toISOString()]),
      };
    }
    case 'All sensor data':
    default: {
      const rows = await SensorReading.find({ recordedAt: { $gte: start, $lt: end } }).sort({ recordedAt: 1 });
      return {
        columns: ['Date/Time', 'Soil moisture (%)', 'Soil temp (°C)', 'EC (uS/cm)', 'pH', 'N', 'P', 'K', 'Air temp (°C)', 'Humidity (%)', 'Tank fill (%)', 'Pump', 'Solenoid'],
        rows: rows.map(r => [
          r.recordedAt.toISOString(), r.soilMoisture, r.soilTemp, r.ec, r.ph,
          r.nitrogen, r.phosphorus, r.potassium, r.airTemp, r.airHumidity,
          r.levelPercent, r.pumpActive ? 'ON' : 'OFF', r.solenoidActive ? 'ON' : 'OFF',
        ]),
      };
    }
  }
}

module.exports = { buildReportData };