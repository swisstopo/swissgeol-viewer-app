import Color from 'cesium/Core/Color.js';

export const EARTHQUAKE_SPHERE_SIZE_COEF = 200;

export function parseEarthquakeData(data) {
  const earthquakeArr = data.split('\n');
  const propsArr = earthquakeArr[0]
    .split('|')
    .map(propName => propName.replace(/\W/g, ''));
  const values = earthquakeArr.slice(1);
  return values.map(val => {
    const valuesArr = val.split('|');
    const earthquakeData = {};
    propsArr.forEach((prop, key) => earthquakeData[prop] = valuesArr[key]);
    return earthquakeData;
  }).filter(ed => !!ed.Latitude && ed.Latitude.length && !!ed.Longitude && ed.Longitude.length);
}


/**
 * Returns color for earthquake sphere according to magnitude.
 * From light blue (magnitude - 0.1 - rgb(0, 149, 251)) to dark blue (magnitude - 10 - rgb(0, 15, 112))
 * @param magnitude
 * @returns {Color}
 */
export function getColorForMagnitude(magnitude) {
  const colorR = 0;
  const colorG = (15 * (10 - Number(magnitude)));
  const colorB = (14 * (18 - Number(magnitude)));
  return Color.fromBytes(colorR, colorG, colorB);
}
