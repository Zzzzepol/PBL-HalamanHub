// The ultrasonic probe measures the gap from its face down to the water.
export const formatTankDistance = (distanceCm) => {
  if (distanceCm == null) return null;
  const distance = Number(distanceCm);
  return Number.isFinite(distance) && distance > 0 ? `${distance.toFixed(1)} cm` : null;
};
