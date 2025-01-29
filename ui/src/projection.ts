import proj4 from 'proj4';
import type { Cartesian3 } from 'cesium';
import { Cartographic, Math as CMath } from 'cesium';

proj4.defs(
  'EPSG:2056',
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs',
);

export function degreesToLv95(coordinates: Array<number>): Array<number> {
  return proj4('EPSG:4326', 'EPSG:2056', coordinates.slice());
}

export function radiansToLv95(coordinates: Array<number>): Array<number> {
  const coordinatesInDegrees = coordinates.map((coord) =>
    CMath.toDegrees(coord),
  );
  return proj4('EPSG:4326', 'EPSG:2056', coordinatesInDegrees.slice());
}

export function cartesianToLv95(position: Cartesian3): Array<number> {
  return degreesToLv95(cartesianToDegrees(position));
}

export function cartesianToDegrees(position: Cartesian3): Array<number> {
  const cartographicPosition = Cartographic.fromCartesian(position);
  const lon = CMath.toDegrees(cartographicPosition.longitude);
  const lat = CMath.toDegrees(cartographicPosition.latitude);
  return [lon, lat, cartographicPosition.height];
}

export function lv95ToDegrees(coordinates: Array<number>): Array<number> {
  return proj4('EPSG:2056', 'EPSG:4326', coordinates);
}

export function round(coordinates: Array<number>): Array<number> {
  return coordinates.map(Math.round);
}

const swissIntegerFormat = new Intl.NumberFormat('de-CH', {
  maximumFractionDigits: 1,
});

export function formatCartographicAs2DLv95(carto: Cartographic): Array<string> {
  return proj4('EPSG:4326', 'EPSG:2056', [
    (carto.longitude * 180) / Math.PI,
    (carto.latitude * 180) / Math.PI,
  ])
    .map((num: number) => num.toFixed(1))
    .map(swissIntegerFormat.format);
}

export const radToDeg = (rad) =>
  (Math.round((100000 * rad * 180) / Math.PI) / 100000).toFixed(5);

export function formatCartesian3AsLv95(position: Cartesian3): Array<string> {
  return cartesianToLv95(position)
    .map((c: number) => Number(c.toFixed(1)))
    .map(swissIntegerFormat.format);
}
