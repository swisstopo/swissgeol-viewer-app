import {Color} from 'cesium';

export const EARTHQUAKE_SPHERE_SIZE_COEF = 200;

export function parseEarthquakeData(data) {
  const earthquakeArr = data.trim().split('\n');
  const propsArr = earthquakeArr[0]
    .split('|')
    .map(propName => propName.replace(/\W/g, ''));
  const values = earthquakeArr.slice(1);
  return values.map(val => {
    const valuesArr = val.split('|');
    const earthquakeData = {};
    for (const i in propsArr) {
      switch (propsArr[i]) {
        case 'Time':
          earthquakeData[propsArr[i]] = valuesArr[i].split('.')[0].replace('T', ' ');
          break;
        case 'Magnitude':
          earthquakeData[propsArr[i]] = parseFloat(valuesArr[i]).toFixed(1) + ' MLhc';
          break;
        case 'Depthkm':
          earthquakeData[propsArr[i]] = parseFloat(valuesArr[i]).toFixed(1) + ' km';
          break;
        case 'EventLocationName':
        case 'Latitude':
        case 'Longitude':
          earthquakeData[propsArr[i]] = valuesArr[i];
          break;
        default:
          break;
      }
    }
    return earthquakeData;
  }).filter(ed => !!ed.Latitude && ed.Latitude.length && !!ed.Longitude && ed.Longitude.length && !ed.Depthkm.startsWith('NaN'));
}


/**
 * Returns color for earthquake sphere according to age.
 * From dark blue (age < 24h - rgb(24, 48, 59)), to light blue (age < 90d - rgb(130, 165, 179))
 * @param {string} datetime
 * @returns {Color}
 */
export function getColorFromTime(datetime) {
  const age_in_h = (Date.now() - Date.parse(datetime)) / 3600000;
  if (age_in_h < 24) {
    return Color.fromBytes(24, 48, 59);
  } else if (age_in_h < 72) {
    return Color.fromBytes(75, 103, 123);
  } else {
    return Color.fromBytes(130, 165, 179);
  }
}
