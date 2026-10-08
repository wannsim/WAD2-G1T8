// Map helpers (Member 3 + Cheyenne)

// Privacy-safe pin: round to 2 decimal places (about 1 km) so a seller's exact home is never shown.
export function approximateLocation(lat, lng) {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 }
}

// Straight-line distance in km between two points (haversine formula). Use for "distance display" + radius filter.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
