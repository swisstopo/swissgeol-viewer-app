import Cartographic from 'cesium/Source/Core/Cartographic';
import {radiansToLv95} from '../projection';

const getIdentifyUrl = ({geom2056, lang, layers}) =>
  `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${geom2056}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=0,0,100,100&imageDisplay=100,100,100&lang=${lang}&layers=all:${layers}&limit=1&returnGeometry=true&sr=2056&tolerance=50`;
const getPopupUrl = ({layerBodId, featureId, lang}) =>
  `https://api3.geo.admin.ch/rest/services/api/MapServer/${layerBodId}/${featureId}/htmlPopup?lang=${lang}`;


export default class SwisstopoIdentify {

  /**
   * @param {import ('cesium/Source/Core/Cartesian3.js').default} position
   * @param {string} layers
   * @param {string} lang
   * @return {Promise<Object>} the popup text
   */
  async identify(position, layers, lang) {
    const carto = Cartographic.fromCartesian(position);
    const geom2056 = radiansToLv95([carto.longitude, carto.latitude]);
    const url = getIdentifyUrl({geom2056, lang, layers});
    return fetch(url)
      .then(response => response.json())
      .then(data => data.results)
      .then(data => data && data[0]);
  }

  /**
   * @param {string} layerBodId
   * @param {string} featureId
   * @param {string} lang
   * @return {Promise<string>} the popup text
   */
  async getPopupForFeature(layerBodId, featureId, lang) {
    const url = getPopupUrl({layerBodId, featureId, lang});
    return fetch(url)
      .then(response => response.text());
  }
}
