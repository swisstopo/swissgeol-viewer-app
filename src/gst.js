const boreholeBaseUrl = 'https://viewer.geomol.ch/webgui/createBoreholeWithOverviewMap.php';
const boreholeParams = 'csRootElement=0&csRootScale=-1&intersectionGeometry=multipoint%20z%20(({coordinates}))&legendTemplateFile=&maxBoreDepth={depth}&outputType={outputType}&projectZ=true&scale=-1&secret=SAS2019@ngm&srs=18&subtreeRootElement=4660&templateFile=02-BH_swisstopo_Map_2019a.svg&title={title}&user=NGM&crs=EPSG:2056';

const verticalCrossSectionBaseUrl = 'https://viewer.geomol.ch/webgui/createCrossSectionWithOverviewMap.php';
const verticalCrossSectionParams = 'csRootElement=0&csRootScale=-1&depthRangeMax=3.40282e%2B38&depthRangeMin=-3.40282e%2B38&errorImageName=&geometryFileType=SFSP&intersectionGeometry=multilinestring%20z%20(({coordinates}))&legendTemplateFile=&outputType={outputType}&overviewMap=&pointProjectionDistance=0&propertySelection=&secret=SAS2019@ngm&srs=18&subtreeRootElement=4660&templateFile=03-CS_swisstopo_Map_2019.svg&title={title}&user=NGM&crs=EPSG:2056';

const horizontalCrossSectionBaseUrl = 'https://viewer.geomol.ch/webgui/createHorizontalSectionWithOverviewMap.php';
const horizontalSectionParams = 'boxWidth={width}&colorMapId=&csRootElement=0&csRootScale=-1&depth={depth}&direction={direction}&errorImageName=&geometryFileType=SFSP&intersectionGeometry=multilinestring%20z%20(({coordinates}))&legendTemplateFile=&outputType={outputType}&overviewMap=&propertySelection=&scale=-1&secret=SAS2019@ngm&srs=18&subtreeRootElement=4660&templateFile=04-HS_swisstopo_Map_2019.svg&title={title}&user=NGM&crs=EPSG:2056';


/**
 * @param {Array<Array<number>>} coordinates
 * @param {AbortSignal} signal
 * @param {number} [depth=5000] depth in meters
 * @param {'PDF' | 'PNG'} outputType
 * @param {string} [title=''] output title
 * @return {Promise}
 */
export function borehole(coordinates, signal, outputType = 'PDF', depth = 5000, title = '') {
  const url = `${boreholeBaseUrl}?${boreholeParams}`
    .replace('{coordinates}', coordinates.map(coordinate => coordinate.join(' ')).join(','))
    .replace('{depth}', depth)
    .replace('{outputType}', outputType)
    .replace('{title}', title);

  return fetch(url, {signal}).then(response => response.json());
}


/**
 * @param {Array<Array<number>>} coordinates
 * @param {AbortSignal} signal
 * @param {'PDF' | 'PNG'} outputType
 * @param {string} [title=''] output title
 * @return {Promise}
 */
export function verticalCrossSection(coordinates, signal, outputType = 'PDF', title = '') {
  const url = `${verticalCrossSectionBaseUrl}?${verticalCrossSectionParams}`
    .replace('{coordinates}', coordinates.map(coordinate => coordinate.join(' ')).join(','))
    .replace('{outputType}', outputType)
    .replace('{title}', title);


  return fetch(url, {signal}).then(response => response.json());
}


/**
 * @param {Array<Array<number>>} coordinates
 * @param {AbortSignal} signal
 * @param {number} [depth=-2500] depth in meters
 * @param {'PDF' | 'PNG'} outputType
 * @param {string} [title=''] output title
 * @return {Promise}
 */
export function horizontalCrossSection(coordinates, signal, depth = -2500, outputType = 'PDF', title = '') {
  // 'coordinates' parameter is the rectangle:
  // 0 ---------- 3
  // |            |
  // |            |
  // 1 ---------- 2
  // line from index 0 to 1 is the 'coordinates' parameter.
  // distance from 3 to 0 is the 'width' parameter.

  // vector from point 3 to point 0
  const v30x = coordinates[0][0] - coordinates[3][0];
  const v30y = coordinates[0][1] - coordinates[3][1];
  const magnitude = Math.sqrt(v30x * v30x + v30y * v30y);

  const direction = isLeft(coordinates[0], coordinates[1], coordinates[3]) ? 'left' : 'right';

  const side = [coordinates[0], coordinates[1]];
  const url = `${horizontalCrossSectionBaseUrl}?${horizontalSectionParams}`
    .replace('{coordinates}', side.map(coordinate => coordinate.join(' ')).join(', ')) // space after comma is required for overview map
    .replace('{direction}', direction)
    .replace('{width}', magnitude)
    .replace('{depth}', depth)
    .replace('{outputType}', outputType)
    .replace('{title}', title);

  return fetch(url, {signal}).then(response => response.json());
}


/**
 * @param {Array<number>} a point on the line
 * @param {Array<number>} b point on the line
 * @param {Array<number>} c point to test
 * @return {boolean} point 'c' is on the left side of the line passing by 'a' and 'b'
 */
function isLeft(a, b, c) {
  return ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 0;
}
