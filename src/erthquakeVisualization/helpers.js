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
