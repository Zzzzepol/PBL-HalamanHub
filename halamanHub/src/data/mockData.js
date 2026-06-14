// ============================================================
// HalamanHub — Chart history (mock)
// All other data (sensors, products, orders, users, irrigation,
// alerts, settings) is now served from MongoDB via /api/* routes
// — see server/models and server/routes.
//
// This file retains only the historical chart series for
// Analytics/Rainwater pages, since time-series history isn't
// yet modeled as its own collection. Replace with a real
// SensorReading time-series collection + aggregation route
// for production use.
// ============================================================

export const chartData = {
  moistureTrend: {
    labels: ['12am','2am','4am','6am','8am','10am','12pm','2pm','4pm','6pm','8pm','10pm'],
    zoneA: [58, 56, 55, 61, 67, 69, 68, 66, 64, 63, 65, 67],
    zoneB: [52, 50, 49, 54, 60, 62, 61, 59, 57, 56, 58, 60],
  },
  phTrend: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    values: [6.2, 6.3, 6.4, 6.3, 6.5, 6.4, 6.4],
  },
  ecTrend: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    values: [2.0, 1.9, 1.8, 1.8, 1.9, 1.7, 1.8],
  },
  waterUsage: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    values: [140, 180, 120, 200, 160, 90, 130],
  },
  npkTrend: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    nitrogen:   [58, 60, 60, 62, 61, 60, 60],
    phosphorus: [36, 37, 38, 38, 39, 38, 38],
    potassium:  [64, 65, 67, 68, 67, 66, 67],
  },
  irrigationHistory: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    zoneA: [25, 22, 28, 20, 24, 30, 18],
    zoneB: [20, 18, 22, 15, 20, 25, 15],
  },
  tempHumidity: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    temperature: [27, 28, 28, 29, 27, 26, 28],
    humidity:    [72, 74, 75, 76, 73, 70, 74],
  },
  rainForecast: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    values: [0, 40, 0, 120, 90, 80, 0],
    forecast: [false, false, false, true, true, true, false],
  },
};
