import type { Cartesian3 } from 'cesium';
import { Cartographic } from 'cesium';
import { radiansToLv95 } from '../projection';
import type { IdentifyResult } from './types';

const getIdentifyUrl = (
  geom2056: number[],
  lang: string,
  layer: string,
  tolerance: number,
): string =>
  `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${geom2056}&geometryFormat=geojson&geometryType=esriGeometryPoint&mapExtent=0,0,100,100&imageDisplay=100,100,100&lang=${lang}&layers=all:${layer}&returnGeometry=true&sr=2056&tolerance=${tolerance}`;
const getPopupUrl = ({ layerBodId, featureId, lang }) =>
  `https://api3.geo.admin.ch/rest/services/api/MapServer/${layerBodId}/${featureId}/htmlPopup?lang=${lang}`;

const getTolerance = (distance: number) => {
  if (distance > 100000) {
    return 300;
  }
  if (distance < 2500) {
    return 20;
  } else {
    return 100;
  }
};

export default class SwisstopoIdentify {
  async identify(
    position: Cartesian3,
    distance: number,
    layers: Array<string>,
    lang: string,
  ): Promise<IdentifyResult[]> {
    const carto = Cartographic.fromCartesian(position);
    const geom2056 = radiansToLv95([carto.longitude, carto.latitude]);
    const tolerance = getTolerance(distance);
    const results: IdentifyResult[][] = await Promise.all(
      layers.map(async (layer) => {
        const response = await fetch(
          getIdentifyUrl(geom2056, lang, layer, tolerance),
        );
        const data = await response.json();
        return data.results?.length > 0 ? data.results : [];
      }),
    );
    let mergedResults: IdentifyResult[] = [];
    results.forEach((r) => (mergedResults = mergedResults.concat(r)));
    return mergedResults;
  }

  async getPopupForFeature(
    layerBodId: string,
    featureId: string,
    lang: string,
  ): Promise<string> {
    const url = getPopupUrl({ layerBodId, featureId, lang });
    return fetch(url).then((response) => response.text());
  }
}
