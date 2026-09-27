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

// Proper-PPM-for-gardening guidance, in the same { category, severity,
// reading, message, fix, diyTip } shape as getSoilRecommendations(), so it
// can be dropped straight into the same recommendation-card UI.
export function getWaterQualityRecommendation(tds) {
  if (tds == null) {
    return {
      category: 'Water Quality (TDS)',
      severity: 'low',
      message: 'No TDS reading yet — a gardening-use recommendation will appear once the sensor reports a value.',
    };
  }
  if (tds <= 300) {
    return {
      category: 'Water Quality (TDS)',
      severity: 'ok',
      reading: `${Math.round(tds)} ppm`,
      message: 'Safe for gardening use. TDS is within the ideal 0–300 ppm range for watering most plants, including salt-sensitive ones like seedlings and orchids.',
    };
  }
  if (tds <= 600) {
    return {
      category: 'Water Quality (TDS)',
      severity: 'medium',
      reading: `${Math.round(tds)} ppm`,
      message: 'Usable for general garden irrigation, but on the high side. Most established plants tolerate this, though salt-sensitive ones may show stress over time.',
      fix: 'Flush the soil with plain water every few waterings to stop salts from building up, and avoid using this water on seedlings or potted, salt-sensitive plants.',
      diyTip: 'Mixing this water half-and-half with fresher rainwater brings the effective TDS down before watering.',
    };
  }
  return {
    category: 'Water Quality (TDS)',
    severity: 'high',
    reading: `${Math.round(tds)} ppm`,
    message: 'Too concentrated for gardening use. Watering with this can cause salt buildup and nutrient lockout, stunting or damaging plants.',
    fix: 'Avoid irrigating with this water directly — let the tank dilute with fresh rain, or filter/treat the water before using it on plants.',
    diyTip: 'A simple sand-and-charcoal filter, or letting sediment settle for a day, can lower TDS a little — but at very high readings, treat it as unsafe for plants until it drops.',
  };
}