import {SWITZERLAND_RECTANGLE} from './constants.js';

import UrlTemplateImageryProvider from 'cesium/Source/Scene/UrlTemplateImageryProvider';
import ImageryLayer from 'cesium/Source/Scene/ImageryLayer';
import Credit from 'cesium/Source/Core/Credit';

const layerUrlTemplate = 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}';

/**
 * @param {string} layer Layer identifier
 * @param {import('cesium/Source/Core/Rectangle').default} [rectangle]
 * @return {Promise<ImageryLayer>}
 */
export function getSwisstopoImagery(layer, rectangle = SWITZERLAND_RECTANGLE) {
  return new Promise((resolve, reject) => {
    getLayersConfig().then(layersConfig => {
      const config = layersConfig[layer];
      if (config) {
        if (config.type === 'wmts') {
          const url = layerUrlTemplate
            .replace('{layer}', config.serverLayerName)
            .replace('{timestamp}', config.timestamps[0])
            .replace('{format}', config.format);

          const imageryProvider = new UrlTemplateImageryProvider({
            url: url,
            rectangle: rectangle,
            credit: new Credit(config.attribution)
          });
          const imageryLayer = new ImageryLayer(imageryProvider, {
            alpha: config.opacity
          });

          resolve(imageryLayer);
        } else {
          reject(`unsupported layer type: ${config.type}`);
        }
      } else {
        reject(`layer not found: ${layer}`);
      }
    });
  });
}

/**
 * @param {import('cesium/Source/Scene/ImageryLayerCollection').default} collection
 * @param {import('cesium/Source/Scene/ImageryLayer').default} imageryLayer
 * @return {boolean}
 */
export function containsSwisstopoImagery(collection, imageryLayer) {
  const url = imageryLayer.imageryProvider.url;
  for (let i = 0, ii = collection.length; i < ii; i++) {
    const layer = collection.get(i);
    if (layer.imageryProvider.url === url) {
      return true;
    }
  }
  return false;
}


let layersConfigPromise;

/**
 * @return {Promise<Object>}
 */
export function getLayersConfig() {
  if (!layersConfigPromise) {
    layersConfigPromise = fetch('https://map.geo.admin.ch/configs/en/layersConfig.json')
      .then(response => response.json());
  }
  return layersConfigPromise;
}

/**
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 * @param {string} layer
 * @param {'png' | 'jpeg'} format
 * @param {string} timestamp
 * @return {ImageryLayer}
 */
export function addSwisstopoLayer(viewer, layer, format, timestamp = 'current') {
  const url = layerUrlTemplate
    .replace('{layer}', layer)
    .replace('{timestamp}', timestamp)
    .replace('{format}', format);

  const imageryLayer = new ImageryLayer(
    new UrlTemplateImageryProvider({
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit('swisstopo'),
      url: url
    }), {
      show: false
    });
  viewer.scene.imageryLayers.add(imageryLayer);

  return imageryLayer;
}
