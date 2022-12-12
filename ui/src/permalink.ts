import {Math, Cartesian3} from 'cesium';

import {getURLSearchParams, parseJson, setURLSearchParams} from './utils';
import {
  ASSET_IDS_URL_PARAM,
  ATTRIBUTE_KEY_PARAM,
  ATTRIBUTE_VALUE_PARAM,
  LAYERS_TRANSPARENCY_URL_PARAM,
  LAYERS_URL_PARAM,
  LAYERS_VISIBILITY_URL_PARAM,
  MAP_TRANSPARENCY_URL_PARAM,
  MAP_URL_PARAM,
  SLICE_PARAM,
  TARGET_PARAM,
  TOPIC_PARAM,
  VIEW_PARAM,
  ZOOM_TO_PARAM
} from './constants';
import type {Cartographic, Camera} from 'cesium';
import type {TopicParam} from './store/dashboard';

export function getCameraView(): {destination?: Cartesian3, orientation?: any} {
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


export function syncCamera(camera: Camera) {
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
      opacity: Number(1 - layersTransparency[key]),
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
  const layerNames: string[] = [];
  const layersTransparency: string[] = [];
  const layersVisibility: boolean[] = [];
  activeLayers.forEach(l => {
    if (!l.customAsset && !l.notSaveToPermalink) {
      layerNames.push(l.layer);
      const transparency = isNaN(l.opacity) ? 0 : (1 - l.opacity);
      layersTransparency.push(transparency.toFixed(2));
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

export function syncMapOpacityParam(opacity) {
  const params = getURLSearchParams();
  params.set(MAP_TRANSPARENCY_URL_PARAM, (1 - opacity).toFixed(2));
  setURLSearchParams(params);
}

export function getMapOpacityParam() {
  const params = getURLSearchParams();
  return 1 - Number(params.get(MAP_TRANSPARENCY_URL_PARAM));
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

export function syncSliceParam(sliceOptions?) {
  const params = getURLSearchParams();
  if (sliceOptions) {
    params.set(SLICE_PARAM, JSON.stringify(sliceOptions));
  } else {
    params.delete(SLICE_PARAM);
  }
  setURLSearchParams(params);
}

export function getSliceParam() {
  const params = getURLSearchParams();
  const sliceOptions = parseJson(params.get(SLICE_PARAM));
  if (sliceOptions && sliceOptions.slicePoints) {
    sliceOptions.slicePoints = sliceOptions.slicePoints.map(coord => new Cartesian3(coord.x, coord.y, coord.z));
  }
  return sliceOptions;
}

export function syncTargetParam(position: Cartographic | undefined) {
  const params = getURLSearchParams();
  if (position) {
    params.set(TARGET_PARAM, JSON.stringify({
      lon: Math.toDegrees(position.longitude).toFixed(5),
      lat: Math.toDegrees(position.latitude).toFixed(5),
      height: position.height
    }));
  } else {
    params.delete(TARGET_PARAM);
  }
  setURLSearchParams(params);
}

export function getTargetParam(): Cartesian3 | undefined {
  const params = getURLSearchParams();
  const position = parseJson(params.get(TARGET_PARAM));
  return position && Cartesian3.fromDegrees(Number(position.lon), Number(position.lat), Number(position.height));
}

export function getCesiumToolbarParam(): boolean {
  return getURLSearchParams().has('cesiumToolbar');
}

export function syncStoredView(stored: string, skipParams: string[] = [TARGET_PARAM, 'lon', 'lat', 'elevation', 'heading', 'pitch']) {
  const params = getURLSearchParams();
  const storedParams = new URLSearchParams(stored);
  for (const param of params.entries()) {
    if (!skipParams.includes(param[0])) params.delete(param[0]);
  }
  for (const param of storedParams.entries()) {
    if (!skipParams.includes(param[0])) params.set(param[0], param[1]);
  }
  setURLSearchParams(params);
}

export function setPermalink(permalink: string) {
  const params = new URLSearchParams(permalink);
  setURLSearchParams(params);
}

export function getTopic(): TopicParam | undefined {
  const params = getURLSearchParams();
  const topicId = params.get(TOPIC_PARAM);
  return topicId ? {topicId: topicId, viewId: params.get(VIEW_PARAM)} : undefined;
}

export function setTopic(topicId: string, viewId: string) {
  const params = getURLSearchParams();
  params.set(TOPIC_PARAM, topicId);
  viewId && params.set(VIEW_PARAM, viewId);
  setURLSearchParams(params);
}

export function removeTopic() {
  const params = getURLSearchParams();
  params.delete(TOPIC_PARAM);
  params.delete(VIEW_PARAM);
  setURLSearchParams(params);
}
