// Google Maps helpers (Cheyenne) - no API key needed.
// The map page uses Google's embed link (an <iframe>), which works without a key,
// but shows ONE place at a time: the selected shop's nearest MRT station.

// "Bishan", "bishan mrt", "Bishan MRT Station" -> "Bishan"
export function cleanMrtName(name) {
  return String(name || '')
    .replace(/\b(mrt|lrt)\b/gi, '')
    .replace(/\bstation\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// what we ask Google Maps to find for a shop: its MRT station, or (older shops) its saved area
function placeQuery(shop) {
  const station = cleanMrtName(shop?.nearestMrt)
  if (station) return `${station} MRT Station, Singapore`
  if (shop?.location?.lat) return `${shop.location.lat},${shop.location.lng}`
  return ''
}

// address for the <iframe src>; '' if the shop has no location at all
export function mapEmbedUrl(shop, zoom = 16) {
  const query = placeQuery(shop)
  return query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed` : ''
}

// opens the same place in the Google Maps app / website
export function googleMapsLink(shop) {
  const query = placeQuery(shop)
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}
