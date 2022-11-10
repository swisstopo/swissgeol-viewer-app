import {Cartographic} from 'cesium';
import type {Cartesian3} from 'cesium';
import {radiansToLv95} from '../projection';

const getIdentifyUrl = (geom2056: number[], lang: string, layer: string, tolerance: number): string =>
  `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${geom2056}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=0,0,100,100&imageDisplay=100,100,100&lang=${lang}&layers=all:${layer}&limit=1&returnGeometry=true&sr=2056&tolerance=${tolerance}`;
const getPopupUrl = ({layerBodId, featureId, lang}) =>
  `https://api3.geo.admin.ch/rest/services/api/MapServer/${layerBodId}/${featureId}/htmlPopup?lang=${lang}`;

const getTolerance = (distance: number) => {
  if (distance > 100000) {
    return 600;
  } if (distance < 2500) {
    return 20;
  } else {
    return 200;
  }
};


export interface IdentifyResult {
  layerBodId: string;
  featureId: string;
}

export default class SwisstopoIdentify {

  /**
   * @param {Cartesian3} position
   * @param {number} distance
   * @param {Array<string>} layers
   * @param {string} lang
   * @return {Promise<IdentifyResult | void>} the popup text
   */
  async identify(position: Cartesian3, distance: number, layers: Array<string>, lang: string): Promise<IdentifyResult | void> {
    const carto = Cartographic.fromCartesian(position);
    const geom2056 = radiansToLv95([carto.longitude, carto.latitude]);
    const tolerance = getTolerance(distance);
    const results = await Promise.all(layers.map(async layer => {
      const response = await fetch(getIdentifyUrl(geom2056, lang, layer, tolerance));
      const data = await response.json();
      if (data.results?.length > 0) {
        return data.results[0];
      }
    }));
    return results.find(result => result !== undefined);
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
