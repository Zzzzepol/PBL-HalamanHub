// rule-based soil health recommendations, derived from commonly accepted
// agronomic ranges for most vegetable/ornamental crops. general guidance,
// not crop-specific — the system doesn't track which crop is planted.

function getSoilRecommendations({ ph, ec, nitrogen, phosphorus, potassium, temperature, humidity }) {
  const recs = [];

  // ph
  if (ph != null) {
    if (ph < 5.5) {
      recs.push({ category: 'pH', severity: 'high', reading: `pH ${ph}`, message: 'Acidic soil can limit nutrient uptake. Apply agricultural lime gradually and retest; aim for pH 6.0–7.0.' });
    } else if (ph > 7.5) {
      recs.push({ category: 'pH', severity: 'high', reading: `pH ${ph}`, message: 'Alkaline soil can lock up nutrients. Add elemental sulfur or compost gradually and retest; aim for pH 6.0–7.0.' });
    } else if (ph < 6.0 || ph > 7.0) {
      recs.push({ category: 'pH', severity: 'medium', reading: `pH ${ph}`, message: 'Slightly outside the 6.0–7.0 target. Monitor it; most crops tolerate this, but growth may slow.' });
    } else {
      recs.push({ category: 'pH', severity: 'ok', reading: `pH ${ph}`, message: 'Within the optimal 6.0–7.0 range. No action needed.' });
    }
  }

  // ec (salinity)
  if (ec != null) {
    if (ec > 2000) {
      recs.push({ category: 'EC', severity: 'high', reading: `${ec} uS/cm`, message: 'High EC can indicate salt buildup. Flush with clean water and pause or reduce fertilizer until the level drops.' });
    } else if (ec < 200) {
      recs.push({ category: 'EC', severity: 'medium', reading: `${ec} uS/cm`, message: 'Low EC suggests few available nutrients. Apply a balanced fertilizer according to its label, then retest.' });
    } else {
      recs.push({ category: 'EC', severity: 'ok', reading: `${ec} uS/cm`, message: 'Within the optimal range — nutrient availability looks balanced.' });
    }
  }

  // nitrogen
  if (nitrogen != null) {
    if (nitrogen < 20) {
      recs.push({ category: 'Nitrogen', severity: 'high', reading: `${nitrogen} mg/kg`, message: 'Low nitrogen can slow leafy growth. Apply a nitrogen-rich fertilizer, such as urea or ammonium sulfate, at the label rate.' });
    } else if (nitrogen > 80) {
      recs.push({ category: 'Nitrogen', severity: 'medium', reading: `${nitrogen} mg/kg`, message: 'Too much nitrogen can cause weak, leafy growth. Stop or reduce nitrogen fertilizer and monitor the next reading.' });
    } else {
      recs.push({ category: 'Nitrogen', severity: 'ok', reading: `${nitrogen} mg/kg`, message: 'Within the optimal 20–80 mg/kg range. No action needed.' });
    }
  }

  // phosphorus
  if (phosphorus != null) {
    if (phosphorus < 10) {
      recs.push({ category: 'Phosphorus', severity: 'high', reading: `${phosphorus} mg/kg`, message: 'Low phosphorus can limit root development. Apply a phosphate fertilizer, such as superphosphate or rock phosphate, at the label rate.' });
    } else {
      recs.push({ category: 'Phosphorus', severity: 'ok', reading: `${phosphorus} mg/kg`, message: 'Within a healthy range — root development should not be limited.' });
    }
  }

  // potassium
  if (potassium != null) {
    if (potassium < 100) {
      recs.push({ category: 'Potassium', severity: 'high', reading: `${potassium} mg/kg`, message: 'Low potassium can affect fruiting and resilience. Apply a potassium fertilizer, such as muriate of potash, at the label rate.' });
    } else {
      recs.push({ category: 'Potassium', severity: 'ok', reading: `${potassium} mg/kg`, message: 'Within a healthy range — fruiting and stress resilience should be supported.' });
    }
  }

  // temperature
  if (temperature != null) {
    if (temperature > 35) {
      recs.push({ category: 'Temperature', severity: 'medium', reading: `${temperature}°C`, message: 'Heat stress is possible. Provide shade and check soil moisture more often before increasing irrigation.' });
    } else if (temperature < 18) {
      recs.push({ category: 'Temperature', severity: 'medium', reading: `${temperature}°C`, message: 'Cold-sensitive crops may need protection. Use row covers or move containers to a warmer area.' });
    } else {
      recs.push({ category: 'Temperature', severity: 'ok', reading: `${temperature}°C`, message: 'Within a comfortable range for most crops. No action needed.' });
    }
  }

  // humidity
  if (humidity != null) {
    if (humidity > 85) {
      recs.push({ category: 'Humidity', severity: 'medium', reading: `${humidity}%`, message: 'High humidity increases fungal disease risk. Improve spacing and airflow around plants.' });
    } else if (humidity < 40) {
      recs.push({ category: 'Humidity', severity: 'low', reading: `${humidity}%`, message: 'Dry air can stress humidity-loving plants. Check soil moisture and consider misting where appropriate.' });
    } else {
      recs.push({ category: 'Humidity', severity: 'ok', reading: `${humidity}%`, message: 'Within a comfortable 40–85% range. No action needed.' });
    }
  }

  if (recs.length === 0) {
    recs.push({ category: 'General', severity: 'ok', message: 'No sensor readings are available yet.' });
  }

  return recs;
}

module.exports = { getSoilRecommendations };
