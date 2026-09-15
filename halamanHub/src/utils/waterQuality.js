// HalamanHub — Water quality helpers (TDS / pH / 3-state tank)
//
// Exact port of server/utils/waterQuality.js. Kept here so the offline
// dashboard can compute these categories directly from a LIVE sensor
// reading without any backend call — same reason src/utils/soilRecommendations.js
// exists as a client copy of server/utils/soilRecommendations.js.
//
// IMPORTANT: keep both copies in sync — see the note in the server file.

export function getWaterQualityCategory(tds) {
  if (tds == null) return { label: 'No data', tone: 'default' };
  if (tds <= 300) return { label: 'Good', tone: 'ok' };
  if (tds <= 600) return { label: 'Fair', tone: 'warning' };
  return { label: 'Poor / Unsafe', tone: 'error' };
}

export function getPhStatus(ph) {
  if (ph == null) return { label: 'No data', tone: 'default' };
  if (ph >= 6.5 && ph <= 7.5) return { label: 'Optimal', tone: 'ok' };
  return { label: 'Needs Adjustment', tone: 'error' };
}

export function getTankStatusInfo(tankStatus) {
  switch (tankStatus) {
    case 'Full':   return { label: 'Full',   tone: 'ok',      step: 3 };
    case 'Medium': return { label: 'Medium', tone: 'warning', step: 2 };
    case 'Low':    return { label: 'Low',    tone: 'error',   step: 1 };
    default:       return { label: 'No data', tone: 'default', step: 0 };
  }
}