import {SWITZERLAND_RECTANGLE} from './constants';

import {UrlTemplateImageryProvider, ImageryLayer, Credit, WebMapServiceImageryProvider} from 'cesium';
import i18next from 'i18next';

const wmtsLayerUrlTemplate = 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}';

/**
 * @param {string} layer Layer identifier
 * @param {number} [maximumLevel]
 * @param {import('cesium/Source/Core/Rectangle').default} [rectangle]
 * @return {Promise<ImageryLayer>}
 */
export function getSwisstopoImagery(layer, maximumLevel = 16, rectangle = SWITZERLAND_RECTANGLE) {
  return new Promise((resolve, reject) => {
    getLayersConfig().then(layersConfig => {
      const config = layersConfig[layer];
      if (config) {
        let imageryProvider;
        switch (config.type) {
          case 'wmts': {
            const url = wmtsLayerUrlTemplate
              .replace('{layer}', config.serverLayerName)
              .replace('{timestamp}', config.timestamps[0])
              .replace('{format}', config.format);
            imageryProvider = new UrlTemplateImageryProvider({
              url: url,
              maximumLevel: maximumLevel,
              rectangle: rectangle,
              credit: new Credit(config.attribution)
            });
            break;
          }
          case 'wms': {
            const url = 'https://wms{s}.geo.admin.ch?version=1.3.0';
            imageryProvider = new WebMapServiceImageryProvider({
              url: url,
              parameters: {
                FORMAT: config.format,
                TRANSPARENT: true,
                LANG: i18next.language,
              },
              subdomains: '0123',
              layers: config.serverLayerName,
              maximumLevel: maximumLevel,
              rectangle: rectangle,
              credit: new Credit(config.attribution)
            });
            break;
          }
          default:
            reject(`unsupported layer type: ${config.type}`);
        }
        const imageryLayer = new ImageryLayer(imageryProvider, {
          alpha: config.opacity
        });
        resolve(imageryLayer);
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
 * @param {number} maximumLevel
 * @param {string} timestamp
 * @return {ImageryLayer}
 */
export function addSwisstopoLayer(viewer, layer, format, maximumLevel, timestamp = 'current') {
  const url = wmtsLayerUrlTemplate
    .replace('{layer}', layer)
    .replace('{timestamp}', timestamp)
    .replace('{format}', format);

  const imageryLayer = new ImageryLayer(
    new UrlTemplateImageryProvider({
      rectangle: SWITZERLAND_RECTANGLE,
      maximumLevel: maximumLevel,
      credit: new Credit('swisstopo'),
      url: url
    }), {
    show: false
  });
  viewer.scene.imageryLayers.add(imageryLayer);
  viewer.scene.imageryLayers.lowerToBottom(imageryLayer);

  return imageryLayer;
}
