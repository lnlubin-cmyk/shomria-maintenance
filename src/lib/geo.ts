import proj4 from "proj4";

/**
 * ITM ⇄ WGS84 conversion.
 *
 * govmap works in ITM (Israeli TM Grid, EPSG:2039); we store both ITM and
 * WGS84 (WGS84 is what navigation links and mobile map SDKs need). A house
 * location is captured once on the govmap map in ITM, then converted here.
 */
const ITM =
  "+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 " +
  "+x_0=219529.584 +y_0=626907.39 +ellps=GRS80 " +
  "+towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4224 +units=m +no_defs";

const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

export function itmToWgs84(x: number, y: number): { lat: number; lng: number } {
  const [lng, lat] = proj4(ITM, WGS84, [x, y]);
  return { lat, lng };
}

export function wgs84ToItm(lat: number, lng: number): { x: number; y: number } {
  const [x, y] = proj4(WGS84, ITM, [lng, lat]);
  return { x, y };
}
