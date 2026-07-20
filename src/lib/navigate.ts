/**
 * Deep links to open turn-by-turn navigation to a house, from its WGS84
 * coordinate. Waze is the most common in Israel; Google Maps as an alternative.
 */
export function wazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
