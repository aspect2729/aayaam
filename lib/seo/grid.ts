export function gridRadiusKm(archetype: string) {
  if (archetype === "gym_fitness") return 3;
  if (archetype === "interior_design" || archetype === "service_projects") return 15;
  return 5;
}

export function rankGrid(center: { lat: number; lng: number }, radiusKm: number, size = 5) {
  const points: Array<{ lat: number; lng: number }> = [];
  const step = size === 1 ? 0 : (radiusKm * 2) / (size - 1);
  const latKm = 111;
  const lngKm = Math.max(Math.cos((center.lat * Math.PI) / 180) * 111, 1);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const north = -radiusKm + row * step;
      const east = -radiusKm + col * step;
      points.push({
        lat: Math.round((center.lat + north / latKm) * 1e6) / 1e6,
        lng: Math.round((center.lng + east / lngKm) * 1e6) / 1e6,
      });
    }
  }
  return points;
}
