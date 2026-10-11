function normalizePlantPart(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function plantIdentityKey(name, category) {
  return `${normalizePlantPart(category)}::${normalizePlantPart(name)}`;
}

module.exports = { plantIdentityKey };
