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

  // generalized soil recommendation block
  if (ph != null) {
    if (ph < 6.0) {
      recs.push({
        category: 'Soil pH',
        severity: 'high',
        reading: `pH ${ph}`,
        message: `Current pH ${ph} is below the target soil pH range.`,
        fix: 'Apply a pH balancing amendment such as lime and retest after a few days.',
        diyTip: 'Mix in crushed eggshells or compost to gently raise soil pH over time.',
      });
    } else if (ph > 7.2) {
      recs.push({
        category: 'Soil pH',
        severity: 'high',
        reading: `pH ${ph}`,
        message: `Current pH ${ph} is above the target soil pH range.`,
        fix: 'Apply a sulfur-rich or acidifying amendment, then retest the soil pH.',
        diyTip: 'Use coffee grounds or composted organic material to lower pH gradually.',
      });
    } else {
      recs.push({ category: 'Soil pH', severity: 'ok', reading: `pH ${ph}`, message: `pH ${ph} is in the normal target soil pH range.` });
    }
  }

  if (ec != null) {
    if (ec > 1050) {
      recs.push({
        category: 'Soil EC',
        severity: 'high',
        reading: `${ec} uS/cm`,
        message: `EC ${ec} uS/cm is above the normal soil salinity range.`,
        fix: 'Flush the soil with clean water and reduce fertilizer salts until the reading drops.',
        diyTip: 'A controlled water flush and compost-rich soil blend helps reduce salt stress naturally.',
      });
    } else if (ec < 750) {
      recs.push({
        category: 'Soil EC',
        severity: 'medium',
        reading: `${ec} uS/cm`,
        message: `EC ${ec} uS/cm is below the normal soil salinity range.`,
        fix: 'Re-apply a balanced nutrient solution or fertilizer with low salt load.',
        diyTip: 'Use compost tea or a mild nutrient solution to rebuild available salts.',
      });
    } else {
      recs.push({ category: 'Soil EC', severity: 'ok', reading: `${ec} uS/cm`, message: `EC ${ec} uS/cm is aligned with the normal soil salinity range.` });
    }
  }

  if (nitrogen != null) {
    if (nitrogen < 30) {
      recs.push({
        category: 'Nitrogen (N)',
        severity: 'high',
        reading: `${nitrogen} mg/kg`,
        message: `Nitrogen ${nitrogen} mg/kg is below the recommended soil nitrogen range.`,
        fix: 'Apply a nitrogen source such as urea or ammonium sulfate according to label rates.',
        diyTip: 'Add coffee grounds, fresh grass clippings, or composted organic matter to raise nitrogen slowly.',
      });
    } else if (nitrogen > 70) {
      recs.push({
        category: 'Nitrogen (N)',
        severity: 'medium',
        reading: `${nitrogen} mg/kg`,
        message: `Nitrogen ${nitrogen} mg/kg is above the recommended soil nitrogen range.`,
        fix: 'Pause nitrogen fertilizer and retest before applying more.',
        diyTip: 'Mix in dry straw or dry leaves to soak up excess nitrogen and improve balance.',
      });
    } else {
      recs.push({ category: 'Nitrogen (N)', severity: 'ok', reading: `${nitrogen} mg/kg`, message: `Nitrogen ${nitrogen} mg/kg is within the recommended soil nitrogen range.` });
    }
  }

  if (phosphorus != null) {
    if (phosphorus < 20) {
      recs.push({
        category: 'Phosphorus (P)',
        severity: 'high',
        reading: `${phosphorus} mg/kg`,
        message: `Phosphorus ${phosphorus} mg/kg is below the recommended soil phosphorus range.`,
        fix: 'Apply a phosphate fertilizer like superphosphate or rock phosphate.',
        diyTip: 'Bury dried crushed banana peels or compost near the roots to release phosphorus gradually.',
      });
    } else if (phosphorus > 40) {
      recs.push({
        category: 'Phosphorus (P)',
        severity: 'medium',
        reading: `${phosphorus} mg/kg`,
        message: `Phosphorus ${phosphorus} mg/kg is above the recommended soil phosphorus range.`,
        fix: 'Pause phosphorus fertilizer until the next reading stabilizes.',
        diyTip: 'Use compost and mulch to buffer the root zone without adding fertilizers.',
      });
    } else {
      recs.push({ category: 'Phosphorus (P)', severity: 'ok', reading: `${phosphorus} mg/kg`, message: `Phosphorus ${phosphorus} mg/kg is within the recommended soil phosphorus range.` });
    }
  }

  if (potassium != null) {
    if (potassium < 100) {
      recs.push({
        category: 'Potassium (K)',
        severity: 'high',
        reading: `${potassium} mg/kg`,
        message: `Potassium ${potassium} mg/kg is below the recommended soil potassium range.`,
        fix: 'Apply a potassium feed like muriate of potash or a balanced crop fertilizer.',
        diyTip: 'Place banana peels or wood ash in a compost heap and compost them into the root zone.',
      });
    } else if (potassium > 180) {
      recs.push({
        category: 'Potassium (K)',
        severity: 'medium',
        reading: `${potassium} mg/kg`,
        message: `Potassium ${potassium} mg/kg is above the recommended soil potassium range.`,
        fix: 'Pause extra potassium fertilizer and observe the next reading.',
        diyTip: 'Use composted organic washouts and reduce mineral potash feeding until the soil settles.',
      });
    } else {
      recs.push({ category: 'Potassium (K)', severity: 'ok', reading: `${potassium} mg/kg`, message: `Potassium ${potassium} mg/kg is within the recommended soil potassium range.` });
    }
  }

  if (recs.length === 0) {
    recs.push({ category: 'General', severity: 'ok', message: 'No sensor readings are available yet.' });
  }

  return recs;
}

function normalizePlantTargets(soilTargets = {}) {
  const useDefault = soilTargets.useDefault !== false;
  const targets = {
    ph: useDefault ? 6.5 : soilTargets.ph ?? null,
    ec: useDefault ? 900 : soilTargets.ec ?? null,
    npk: {
      nitrogen: useDefault ? 50 : soilTargets.npk?.nitrogen ?? null,
      phosphorus: useDefault ? 30 : soilTargets.npk?.phosphorus ?? null,
      potassium: useDefault ? 140 : soilTargets.npk?.potassium ?? null,
    },
  };

  return { useDefault, targets };
}

function getPlantRecommendations({ ph, ec, nitrogen, phosphorus, potassium, soilTargets = {} }) {
  const recs = [];
  const targetMap = normalizePlantTargets(soilTargets);

  // pH target
  if (ph != null && targetMap.targets.ph != null) {
    if (ph < targetMap.targets.ph - 0.3) {
      recs.push({
        category: 'Soil pH',
        severity: 'high',
        reading: `pH ${ph}`,
        message: `Current pH ${ph} is below the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.ph}.`,
        fix: 'Apply a pH balancing amendment such as lime and retest after a few days.',
        diyTip: 'Mix in crushed eggshells or compost to gently raise soil pH over time.',
      });
    } else if (ph > targetMap.targets.ph + 0.3) {
      recs.push({
        category: 'Soil pH',
        severity: 'high',
        reading: `pH ${ph}`,
        message: `Current pH ${ph} is above the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.ph}.`,
        fix: 'Apply a sulfur-rich or acidifying amendment, then retest the soil pH.',
        diyTip: 'Use coffee grounds or composted organic material to lower pH gradually.',
      });
    } else {
      recs.push({ category: 'Soil pH', severity: 'ok', reading: `pH ${ph}`, message: `pH ${ph} is aligned with the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.ph}.` });
    }
  }

  // EC target
  if (ec != null && targetMap.targets.ec != null) {
    if (ec > targetMap.targets.ec + 150) {
      recs.push({
        category: 'Soil Salinity (EC)',
        severity: 'high',
        reading: `${ec} uS/cm`,
        message: `EC ${ec} uS/cm is above the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.ec} uS/cm.`,
        fix: 'Flush the soil with clean water and reduce fertilizer salts until the reading drops.',
        diyTip: 'A controlled water flush and compost-rich soil blend helps reduce salt stress naturally.',
      });
    } else if (ec < targetMap.targets.ec - 150) {
      recs.push({
        category: 'Soil Salinity (EC)',
        severity: 'medium',
        reading: `${ec} uS/cm`,
        message: `EC ${ec} uS/cm is below the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.ec} uS/cm.`,
        fix: 'Re-apply a balanced nutrient solution or fertilizer with low salt load.',
        diyTip: 'Use compost tea or a mild nutrient solution to rebuild available salts.',
      });
    } else {
      recs.push({ category: 'Soil Salinity (EC)', severity: 'ok', reading: `${ec} uS/cm`, message: `EC ${ec} uS/cm is aligned with the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.ec} uS/cm.` });
    }
  }

  // Nitrogen target
  if (nitrogen != null && targetMap.targets.npk.nitrogen != null) {
    if (nitrogen < targetMap.targets.npk.nitrogen - 10) {
      recs.push({
        category: 'Nitrogen (N)',
        severity: 'high',
        reading: `${nitrogen} mg/kg`,
        message: `Nitrogen ${nitrogen} mg/kg is below the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.nitrogen} mg/kg.`,
        fix: 'Apply a nitrogen source such as urea or ammonium sulfate according to label rates.',
        diyTip: 'Add coffee grounds, fresh grass clippings, or composted organic matter to raise nitrogen slowly.',
      });
    } else if (nitrogen > targetMap.targets.npk.nitrogen + 10) {
      recs.push({
        category: 'Nitrogen (N)',
        severity: 'medium',
        reading: `${nitrogen} mg/kg`,
        message: `Nitrogen ${nitrogen} mg/kg is above the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.nitrogen} mg/kg.`,
        fix: 'Pause nitrogen fertilizer and retest before applying more.',
        diyTip: 'Mix in dry straw or dry leaves to soak up excess nitrogen and improve balance.',
      });
    } else {
      recs.push({ category: 'Nitrogen (N)', severity: 'ok', reading: `${nitrogen} mg/kg`, message: `Nitrogen ${nitrogen} mg/kg matches the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.nitrogen} mg/kg.` });
    }
  }

  // Phosphorus target
  if (phosphorus != null && targetMap.targets.npk.phosphorus != null) {
    if (phosphorus < targetMap.targets.npk.phosphorus - 10) {
      recs.push({
        category: 'Phosphorus (P)',
        severity: 'high',
        reading: `${phosphorus} mg/kg`,
        message: `Phosphorus ${phosphorus} mg/kg is below the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.phosphorus} mg/kg.`,
        fix: 'Apply a phosphate fertilizer like superphosphate or rock phosphate.',
        diyTip: 'Bury dried crushed banana peels or compost near the roots to release phosphorus gradually.',
      });
    } else if (phosphorus > targetMap.targets.npk.phosphorus + 10) {
      recs.push({
        category: 'Phosphorus (P)',
        severity: 'medium',
        reading: `${phosphorus} mg/kg`,
        message: `Phosphorus ${phosphorus} mg/kg is above the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.phosphorus} mg/kg.`,
        fix: 'Pause phosphorus fertilizer until the next reading stabilizes.',
        diyTip: 'Use compost and mulch to buffer the root zone without adding fertilizers.',
      });
    } else {
      recs.push({ category: 'Phosphorus (P)', severity: 'ok', reading: `${phosphorus} mg/kg`, message: `Phosphorus ${phosphorus} mg/kg matches the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.phosphorus} mg/kg.` });
    }
  }

  // Potassium target
  if (potassium != null && targetMap.targets.npk.potassium != null) {
    if (potassium < targetMap.targets.npk.potassium - 20) {
      recs.push({
        category: 'Potassium (K)',
        severity: 'high',
        reading: `${potassium} mg/kg`,
        message: `Potassium ${potassium} mg/kg is below the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.potassium} mg/kg.`,
        fix: 'Apply a potassium feed like muriate of potash or a balanced crop fertilizer.',
        diyTip: 'Place banana peels or wood ash in a compost heap and compost them into the root zone.',
      });
    } else if (potassium > targetMap.targets.npk.potassium + 20) {
      recs.push({
        category: 'Potassium (K)',
        severity: 'medium',
        reading: `${potassium} mg/kg`,
        message: `Potassium ${potassium} mg/kg is above the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.potassium} mg/kg.`,
        fix: 'Pause extra potassium fertilizer and observe the next reading.',
        diyTip: 'Use composted organic washouts and reduce mineral potash feeding until the soil settles.',
      });
    } else {
      recs.push({ category: 'Potassium (K)', severity: 'ok', reading: `${potassium} mg/kg`, message: `Potassium ${potassium} mg/kg matches the ${targetMap.useDefault ? 'default' : 'configured'} target ${targetMap.targets.npk.potassium} mg/kg.` });
    }
  }

  if (recs.length === 0) {
    recs.push({ category: 'General', severity: 'ok', message: 'No plant target readings are available yet.' });
  }

  return recs;
}

module.exports = { getSoilRecommendations, getPlantRecommendations };