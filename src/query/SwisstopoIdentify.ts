import Cartographic from 'cesium/Source/Core/Cartographic';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {radiansToLv95} from '../projection';

const getIdentifyUrl = ({geom2056, lang, layers}) =>
  `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${geom2056}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=0,0,100,100&imageDisplay=100,100,100&lang=${lang}&layers=all:${layers.join()}&limit=1&returnGeometry=true&sr=2056&tolerance=100`;
const getPopupUrl = ({layerBodId, featureId, lang}) =>
  `https://api3.geo.admin.ch/rest/services/api/MapServer/${layerBodId}/${featureId}/htmlPopup?lang=${lang}`;


export interface IdentifyResult {
  layerBodId: string;
  featureId: string;
}

export default class SwisstopoIdentify {

  /**
   * @param {Cartesian3} position
   * @param {Array<string>} layers
   * @param {string} lang
   * @return {Promise<IdentifyResult | void>} the popup text
   */
  async identify(position: Cartesian3, layers: Array<string>, lang: string): Promise<IdentifyResult | void> {
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
  async getPopupForFeature(layerBodId: string, featureId: string, lang: string): Promise<string> {
    const url = getPopupUrl({layerBodId, featureId, lang});
    return fetch(url)
      .then(response => response.text());
  }
}
