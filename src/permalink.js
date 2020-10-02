import Math from 'cesium/Source/Core/Math';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';

import {getURLSearchParams, setURLSearchParams} from './utils.js';
import {
  LAYERS_TRANSPARENCY_URL_PARAM,
  LAYERS_URL_PARAM,
  LAYERS_VISIBILITY_URL_PARAM,
  ASSET_IDS_URL_PARAM,
  MAP_URL_PARAM,
  MAP_TRANSPARENCY_URL_PARAM,
  ATTRIBUTE_KEY_PARAM, ATTRIBUTE_VALUE_PARAM, ZOOM_TO_PARAM
} from './constants.js';

export function getCameraView() {
  let destination;
  let orientation;

  const params = getURLSearchParams();

  const lon = params.get('lon');
  const lat = params.get('lat');
  const elevation = params.get('elevation');
  if (lon !== null && lat !== null && elevation !== null) {
    destination = Cartesian3.fromDegrees(parseFloat(lon), parseFloat(lat), parseFloat(elevation));
  }
  const heading = params.get('heading');
  const pitch = params.get('pitch');
  if (heading !== null && pitch !== null) {
    orientation = {
      heading: Math.toRadians(parseFloat(heading)),
      pitch: Math.toRadians(parseFloat(pitch)),
      roll: 0
    };
  }
  return {destination, orientation};
}


export function syncCamera(camera) {
  const params = getURLSearchParams();
  const position = camera.positionCartographic;
  params.set('lon', Math.toDegrees(position.longitude).toFixed(5));
  params.set('lat', Math.toDegrees(position.latitude).toFixed(5));
  params.set('elevation', position.height.toFixed(0));
  params.set('heading', Math.toDegrees(camera.heading).toFixed(0));
  params.set('pitch', Math.toDegrees(camera.pitch).toFixed(0));
  setURLSearchParams(params);
}

function safeSplit(str) {
  return str ? str.split(',') : [];
}

/**
 * Parses the URL and returns an array of layer configs.
 */
export function getLayerParams() {
  const params = getURLSearchParams();
  const layersTransparency = safeSplit(params.get(LAYERS_TRANSPARENCY_URL_PARAM));
  const layersVisibility = safeSplit(params.get(LAYERS_VISIBILITY_URL_PARAM));
  const layers = safeSplit(params.get(LAYERS_URL_PARAM));

  return layers.map((layer, key) => {
    return {
      name: layer,
      transparency: Number(layersTransparency[key]),
      visible: layersVisibility[key] === 'true',
    };
  });
}

export function getAssetIds() {
  const params = getURLSearchParams();
  return safeSplit(params.get(ASSET_IDS_URL_PARAM));
}

export function syncLayersParam(activeLayers) {
  const params = getURLSearchParams();
  const layerNames = [];
  const layersTransparency = [];
  const layersVisibility = [];
  activeLayers.forEach(l => {
    if (!l.customAsset) {
      layerNames.push(l.layer);
      layersTransparency.push(isNaN(l.transparency) ? 1 : l.transparency);
      layersVisibility.push(l.visible);
    }
  });

  if (layerNames.length) {
    params.set(LAYERS_URL_PARAM, layerNames.join(','));
    params.set(LAYERS_VISIBILITY_URL_PARAM, layersVisibility.join(','));
    params.set(LAYERS_TRANSPARENCY_URL_PARAM, layersTransparency.join(','));
  } else {
    params.delete(LAYERS_URL_PARAM);
    params.delete(LAYERS_TRANSPARENCY_URL_PARAM);
    params.delete(LAYERS_VISIBILITY_URL_PARAM);
  }

  const assetParams = getAssetIds();

  if (assetParams.length) {
    const assetIds = assetParams.filter(id => activeLayers.find(l => l.assetId === id && l.displayed));
    if (assetIds.length) {
      params.set(ASSET_IDS_URL_PARAM, assetIds.join(','));
    } else {
      params.delete(ASSET_IDS_URL_PARAM);
    }
  }

  setURLSearchParams(params);
}

export function isLabelOutlineEnabled() {
  const params = getURLSearchParams();
  return params.get('labelOutline') === 'true';
}

export function syncMapParam(layerName) {
  const params = getURLSearchParams();
  params.set(MAP_URL_PARAM, layerName);
  setURLSearchParams(params);
}

export function getMapParam() {
  const params = getURLSearchParams();
  return params.get(MAP_URL_PARAM);
}

export function syncMapTransparencyParam(transparency) {
  const params = getURLSearchParams();
  params.set(MAP_TRANSPARENCY_URL_PARAM, transparency);
  setURLSearchParams(params);
}

export function getMapTransparencyParam() {
  const params = getURLSearchParams();
  return Number(params.get(MAP_TRANSPARENCY_URL_PARAM));
}

export function getAttribute() {
  const params = getURLSearchParams();
  const attributeKey = params.get(ATTRIBUTE_KEY_PARAM);
  const attributeValue = params.get(ATTRIBUTE_VALUE_PARAM);
  if (!attributeKey || !attributeValue) {
    return undefined;
  }
  return {attributeKey, attributeValue};
}

export function getZoomToPosition() {
  const params = getURLSearchParams();
  const tilePosition = params.get(ZOOM_TO_PARAM);
  const position = safeSplit(tilePosition);
  if (!position || position.length < 3) {
    return undefined;
  }
  return {longitude: Number(position[0]), latitude: Number(position[1]), height: Number(position[2])};
}
