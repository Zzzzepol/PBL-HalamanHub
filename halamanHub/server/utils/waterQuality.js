// HalamanHub Server — Water quality helpers (TDS / pH / 3-state tank)
//
// This mirrors src/utils/waterQuality.js on the client, the same way
// soilRecommendations.js is duplicated between server and client — the
// server copy powers Online Mode (via /api/dashboard/summary), the client
// copy powers Offline Mode (computed straight from the live socket
// reading, no database involved).
//
// IMPORTANT: keep both copies in sync — thresholds/labels changed here
// must be changed in src/utils/waterQuality.js too, or online and offline
// mode will disagree about the same reading.

function getWaterQualityCategory(tds) {
  if (tds == null) return { label: 'No data', tone: 'default' };
  if (tds <= 300) return { label: 'Good', tone: 'ok' };
  if (tds <= 600) return { label: 'Fair', tone: 'warning' };
  return { label: 'Poor / Unsafe', tone: 'error' };
}

function getPhStatus(ph) {
  if (ph == null) return { label: 'No data', tone: 'default' };
  if (ph >= 6.5 && ph <= 7.5) return { label: 'Optimal', tone: 'ok' };
  return { label: 'Needs Adjustment', tone: 'error' };
}

function getTankStatusInfo(tankStatus) {
  switch (tankStatus) {
    case 'Full':   return { label: 'Full',   tone: 'ok',      step: 3 };
    case 'Medium': return { label: 'Medium', tone: 'warning', step: 2 };
    case 'Low':    return { label: 'Low',    tone: 'error',   step: 1 };
    default:       return { label: 'No data', tone: 'default', step: 0 };
  }
}

module.exports = { getWaterQualityCategory, getPhStatus, getTankStatusInfo };