import proj4 from 'proj4';
import CMath from 'cesium/Source/Core/Math';

proj4.defs('EPSG:2056', '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs');

/**
 * @param {Array<number>} coordinates
 * @return {Array<number>}
 */
export function degreesToLv95(coordinates) {
  return proj4('EPSG:4326', 'EPSG:2056', coordinates.slice());
}

/**
 * @param {Array<number>} coordinates
 * @return {Array<number>}
 */
export function radiansToLv95(coordinates) {
  const coordinatesInDegrees = coordinates.map(coord => CMath.toDegrees(coord));
  return proj4('EPSG:4326', 'EPSG:2056', coordinatesInDegrees.slice());
}

/**
 * @param {Array<number>} coordinates
 * @return {Array<number>}
 */
export function lv95ToDegrees(coordinates) {
  return proj4('EPSG:2056', 'EPSG:4326', coordinates);
}

/**
 * @param {Array<number>} coordinates
 * @return {Array<number>}
 */
export function round(coordinates) {
  return coordinates.map(Math.round);
}

const swissIntegerFormat = new Intl.NumberFormat('de-CH', {
  maximumFractionDigits: 0
});

/**
 * @param {import('cesium/Source/Core/Cartographic').default} carto
 * @return {string}
 */
export function formatCartographicAs2DLv95(carto) {
  return proj4('EPSG:4326', 'EPSG:2056', [
    carto.longitude * 180 / Math.PI,
    carto.latitude * 180 / Math.PI,
  ]).map(Math.round).map(swissIntegerFormat.format).join(', ');
}
