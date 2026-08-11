// rule-based soil health recommendations, derived from commonly accepted
// agronomic ranges for most vegetable/ornamental crops. general guidance,
// not crop-specific — the system doesn't track which crop is planted.

function getSoilRecommendations({ ph, ec, nitrogen, phosphorus, potassium, temperature, humidity }) {
  const recs = [];

  // ph
  if (ph != null) {
    if (ph < 5.5) {
      recs.push({ category: 'pH', severity: 'high', message: `Soil is acidic (pH ${ph}). Consider applying agricultural lime to raise pH toward the 6.0–7.0 range most crops prefer.` });
    } else if (ph > 7.5) {
      recs.push({ category: 'pH', severity: 'high', message: `Soil is alkaline (pH ${ph}). Consider adding elemental sulfur or organic matter (compost) to lower pH toward 6.0–7.0.` });
    } else if (ph < 6.0 || ph > 7.0) {
      recs.push({ category: 'pH', severity: 'medium', message: `pH is slightly outside the ideal 6.0–7.0 range (currently ${ph}). Monitor — most crops still tolerate this but growth may be reduced.` });
    }
  }

  // ec (salinity)
  if (ec != null) {
    if (ec > 2000) {
      recs.push({ category: 'EC', severity: 'high', message: `EC is high (${ec} uS/cm), indicating salt buildup. Flush soil with clean water and reduce fertilizer application until levels normalize.` });
    } else if (ec < 200) {
      recs.push({ category: 'EC', severity: 'medium', message: `EC is low (${ec} uS/cm), suggesting nutrient-poor soil. Consider applying a balanced fertilizer.` });
    }
  }

  // nitrogen
  if (nitrogen != null) {
    if (nitrogen < 20) {
      recs.push({ category: 'Nitrogen', severity: 'high', message: `Nitrogen is low (${nitrogen} mg/kg). Apply a nitrogen-rich fertilizer such as urea or ammonium sulfate.` });
    } else if (nitrogen > 80) {
      recs.push({ category: 'Nitrogen', severity: 'medium', message: `Nitrogen is very high (${nitrogen} mg/kg). Excess nitrogen can cause lush but weak growth and higher pest susceptibility — reduce nitrogen fertilizer.` });
    }
  }

  // phosphorus
  if (phosphorus != null) {
    if (phosphorus < 10) {
      recs.push({ category: 'Phosphorus', severity: 'high', message: `Phosphorus is low (${phosphorus} mg/kg). Apply a phosphate fertilizer (e.g. superphosphate or rock phosphate) to support root development.` });
    }
  }

  // potassium
  if (potassium != null) {
    if (potassium < 100) {
      recs.push({ category: 'Potassium', severity: 'high', message: `Potassium is low (${potassium} mg/kg). Apply potassium fertilizer (e.g. muriate of potash) to improve fruiting and disease resistance.` });
    }
  }

  // temperature
  if (temperature != null) {
    if (temperature > 35) {
      recs.push({ category: 'Temperature', severity: 'medium', message: `Air temperature is high (${temperature}°C). Consider shading and more frequent irrigation to reduce heat stress.` });
    } else if (temperature < 18) {
      recs.push({ category: 'Temperature', severity: 'medium', message: `Air temperature is low (${temperature}°C). Cold-sensitive crops may benefit from row covers or moving to a warmer area.` });
    }
  }

  // humidity
  if (humidity != null) {
    if (humidity > 85) {
      recs.push({ category: 'Humidity', severity: 'medium', message: `Humidity is high (${humidity}%). Improve airflow/ventilation to reduce fungal disease risk.` });
    } else if (humidity < 40) {
      recs.push({ category: 'Humidity', severity: 'low', message: `Humidity is low (${humidity}%). Consider misting or increasing watering frequency, especially for humidity-loving plants.` });
    }
  }

  if (recs.length === 0) {
    recs.push({ category: 'General', severity: 'ok', message: 'All measured soil and environmental readings are within healthy ranges. No action needed right now.' });
  }

  return recs;
}

module.exports = { getSoilRecommendations };