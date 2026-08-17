// rule-based soil health recommendations, derived from commonly accepted
// agronomic ranges for most vegetable/ornamental crops. general guidance,
// not crop-specific — the system doesn't track which crop is planted.
//
// each recommendation is split into three short, plain-language parts so a
// farmer, admin, or owner can scan it at a glance:
//   message  — what's happening, in one simple sentence
//   fix      — the store-bought / standard fix
//   diyTip   — an easy at-home / organic alternative (eggshells, banana
//              peels, coffee grounds, etc.) where one genuinely helps
// "ok" readings only ever get a message — there's nothing to fix.

function getSoilRecommendations({ ph, ec, nitrogen, phosphorus, potassium, temperature, humidity }) {
  const recs = [];

  // ph
  if (ph != null) {
    if (ph < 5.5) {
      recs.push({
        category: 'Soil pH',
        severity: 'high',
        reading: `pH ${ph}`,
        message: 'Your soil is too sour (acidic). Plants struggle to absorb nutrients like this.',
        fix: 'Add a little agricultural lime, mix it in, then retest in a few days. Aim for pH 6.0–7.0.',
        diyTip: 'Crushed eggshells or wood ash work too — sprinkle a handful over the soil, mix in, and water lightly.',
      });
    } else if (ph > 7.5) {
      recs.push({
        category: 'Soil pH',
        severity: 'high',
        reading: `pH ${ph}`,
        message: 'Your soil is too alkaline (sweet). Nutrients get "locked up" so plants can\'t use them.',
        fix: 'Add a little elemental sulfur or compost, mix it in, then retest. Aim for pH 6.0–7.0.',
        diyTip: 'Used coffee grounds mixed into the topsoil can gently lower pH over time.',
      });
    } else if (ph < 6.0 || ph > 7.0) {
      recs.push({ category: 'Soil pH', severity: 'medium', reading: `pH ${ph}`, message: 'A little off the ideal range, but most crops still grow fine here. Just keep watching future readings.' });
    } else {
      recs.push({ category: 'Soil pH', severity: 'ok', reading: `pH ${ph}`, message: 'Good — your soil pH is right in the ideal 6.0–7.0 range.' });
    }
  }

  // ec (salinity)
  if (ec != null) {
    if (ec > 2000) {
      recs.push({
        category: 'Soil Salinity (EC)',
        severity: 'high',
        reading: `${ec} uS/cm`,
        message: 'Too much salt has built up in the soil. This can burn roots and stress plants.',
        fix: 'Water the area well to flush the salt out, and pause fertilizer until the reading drops.',
        diyTip: 'Rainwater flushes salt out best, since it has no added salts of its own.',
      });
    } else if (ec < 200) {
      recs.push({
        category: 'Soil Salinity (EC)',
        severity: 'medium',
        reading: `${ec} uS/cm`,
        message: 'There aren\'t many nutrients available in the soil right now.',
        fix: 'Apply a balanced fertilizer following the product label, then retest in a few days.',
        diyTip: 'Compost tea — compost or manure soaked in water for a day or two — gives soil a gentle nutrient boost.',
      });
    } else {
      recs.push({ category: 'Soil Salinity (EC)', severity: 'ok', reading: `${ec} uS/cm`, message: 'Good — nutrient levels in the soil are well balanced.' });
    }
  }

  // nitrogen
  if (nitrogen != null) {
    if (nitrogen < 20) {
      recs.push({
        category: 'Nitrogen (N)',
        severity: 'high',
        reading: `${nitrogen} mg/kg`,
        message: 'Nitrogen is low. This slows down leaf and stem growth.',
        fix: 'Apply a nitrogen fertilizer like urea or ammonium sulfate, following the label.',
        diyTip: 'Used coffee grounds or fresh grass clippings mixed into the topsoil are natural nitrogen boosters.',
      });
    } else if (nitrogen > 80) {
      recs.push({
        category: 'Nitrogen (N)',
        severity: 'medium',
        reading: `${nitrogen} mg/kg`,
        message: 'Nitrogen is too high. Plants may grow lots of leaves but weak fruit or flowers.',
        fix: 'Stop nitrogen fertilizer for now and watch the next few readings.',
        diyTip: 'Mixing in dry leaves, straw, or sawdust helps soak up the extra nitrogen.',
      });
    } else {
      recs.push({ category: 'Nitrogen (N)', severity: 'ok', reading: `${nitrogen} mg/kg`, message: 'Good — nitrogen is in the healthy 20–80 mg/kg range.' });
    }
  }

  // phosphorus
  if (phosphorus != null) {
    if (phosphorus < 10) {
      recs.push({
        category: 'Phosphorus (P)',
        severity: 'high',
        reading: `${phosphorus} mg/kg`,
        message: 'Phosphorus is low. This can hold back root growth.',
        fix: 'Apply a phosphate fertilizer like superphosphate or rock phosphate, following the label.',
        diyTip: 'Dried, crushed banana peels buried near the roots break down slowly and release phosphorus and potassium.',
      });
    } else {
      recs.push({ category: 'Phosphorus (P)', severity: 'ok', reading: `${phosphorus} mg/kg`, message: 'Good — phosphorus is healthy, so root growth shouldn\'t be held back.' });
    }
  }

  // potassium
  if (potassium != null) {
    if (potassium < 100) {
      recs.push({
        category: 'Potassium (K)',
        severity: 'high',
        reading: `${potassium} mg/kg`,
        message: 'Potassium is low. This weakens fruiting and makes plants less able to handle stress.',
        fix: 'Apply a potassium fertilizer like muriate of potash, following the label.',
        diyTip: 'Banana peels or a light sprinkle of wood ash are natural sources of potassium — bury peels near the roots.',
      });
    } else {
      recs.push({ category: 'Potassium (K)', severity: 'ok', reading: `${potassium} mg/kg`, message: 'Good — potassium is healthy, supporting fruiting and stress resistance.' });
    }
  }

  // temperature
  if (temperature != null) {
    if (temperature > 35) {
      recs.push({
        category: 'Temperature',
        severity: 'medium',
        reading: `${temperature}°C`,
        message: 'It\'s hot enough to stress plants.',
        fix: 'Provide shade if you can, and check soil moisture more often before watering more.',
        diyTip: 'A thick layer of mulch (dry leaves, straw, or grass clippings) around the base keeps roots cooler.',
      });
    } else if (temperature < 18) {
      recs.push({
        category: 'Temperature',
        severity: 'medium',
        reading: `${temperature}°C`,
        message: 'It\'s cool enough to slow down cold-sensitive crops.',
        fix: 'Use row covers, or move potted plants somewhere warmer.',
        diyTip: 'A thick layer of mulch or dry straw insulates the soil and roots from the cold.',
      });
    } else {
      recs.push({ category: 'Temperature', severity: 'ok', reading: `${temperature}°C`, message: 'Good — a comfortable temperature for most crops.' });
    }
  }

  // humidity
  if (humidity != null) {
    if (humidity > 85) {
      recs.push({
        category: 'Humidity',
        severity: 'medium',
        reading: `${humidity}%`,
        message: 'The air is very humid, which raises the risk of fungal disease.',
        fix: 'Space plants out a bit more and improve airflow around them.',
        diyTip: 'Trimming a few crowded lower leaves also helps air move through the plant.',
      });
    } else if (humidity < 40) {
      recs.push({
        category: 'Humidity',
        severity: 'low',
        reading: `${humidity}%`,
        message: 'The air is quite dry.',
        fix: 'Keep an eye on soil moisture, and mist plants that prefer humid air.',
        diyTip: 'A layer of mulch around the base holds moisture in the soil and raises humidity near the roots.',
      });
    } else {
      recs.push({ category: 'Humidity', severity: 'ok', reading: `${humidity}%`, message: 'Good — a comfortable 40–85% range.' });
    }
  }

  if (recs.length === 0) {
    recs.push({ category: 'General', severity: 'ok', message: 'No sensor readings are available yet.' });
  }

  return recs;
}

module.exports = { getSoilRecommendations };