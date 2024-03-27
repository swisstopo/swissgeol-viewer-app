import {SWITZERLAND_RECTANGLE, WEB_MERCATOR_TILING_SCHEME} from './constants';

import {
  Credit,
  ImageryLayer,
  Rectangle,
  UrlTemplateImageryProvider,
  Viewer,
  WebMapServiceImageryProvider,
} from 'cesium';
import i18next from 'i18next';
import {getURLSearchParams} from './utils';

export type SwisstopoImageryLayer = {
  attribution: string
  attributionUrl: string
  background: boolean
  chargeable: boolean
  format: 'png' | 'jpeg'
  hasLegend: boolean
  highlightable: boolean
  label: string
  resolutions: number[]
  searchable: string
  serverLayerName: string
  timeEnabled: boolean
  timestamps: string[]
  tooltip:boolean
  topics: string
  type: 'wmts' | 'wms'
  updateDelay?: number
  opacity?: number
  styleUrl?: string
  geojsonUrl?: string
}

export type SwisstopoImageryLayersConfig = Record<string, SwisstopoImageryLayer>


const wmtsLayerUrlTemplate = 'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}';

let timesOfSwisstopoWMTSLayers: Record<string, string[]> | undefined;

/**
 * @param {string} layer Layer identifier
 * @param {number} [maximumLevel]
 * @param {import('cesium/Source/Core/Rectangle').default} [rectangle]
 * @return {Promise<ImageryLayer>}
 */
export function getSwisstopoImagery(layer: string, maximumLevel: number = 16, rectangle: Rectangle = SWITZERLAND_RECTANGLE): Promise<ImageryLayer> {
  return new Promise((resolve, reject) => {
    getLayersConfig().then(async layersConfig => {
      const config = layersConfig[layer];
      if (config) {
        let imageryProvider: UrlTemplateImageryProvider | WebMapServiceImageryProvider;
        if (config.type === 'wmts') {
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
        } else if (config.type === 'wms') {
          const url = 'https://wms{s}.geo.admin.ch?version=1.3.0';
          imageryProvider = new WebMapServiceImageryProvider({
            url: url,
            crs: 'EPSG:4326',
            parameters: {
              FORMAT: config.format.includes('image/') ? config.format : `image/${config.format}`,
              TRANSPARENT: true,
              LANG: i18next.language,
            },
            subdomains: '0123',
            tilingScheme: WEB_MERCATOR_TILING_SCHEME,
            layers: config.serverLayerName,
            maximumLevel: maximumLevel,
            rectangle: rectangle,
            credit: new Credit(config.attribution),
          });
        } else {
          reject(`unsupported layer type: ${config.type}`);
          return;
        }
        const imageryLayer = new ImageryLayer(imageryProvider, {
          alpha: config.opacity !== undefined ? config.opacity : 1
        });
        resolve(imageryLayer);
      } else {
        reject(`layer not found: ${layer}`);
      }
    });
  });
}


let layersConfigPromise: Promise<SwisstopoImageryLayersConfig>;

export function getLayersConfig(): Promise<SwisstopoImageryLayersConfig> {
  if (!layersConfigPromise) {
    layersConfigPromise = fetch('https://map.geo.admin.ch/configs/en/layersConfig.json')
      .then(response => response.json());
  }
  return layersConfigPromise;
}

let layerLabelPromise: Promise<string>;
export function getLayerLabel(searchLayer: string) {
  const params = getURLSearchParams();
  const lang = params.get('lang');
  layerLabelPromise = fetch(`https://map.geo.admin.ch/configs/${lang}/layersConfig.json`)
      .then(response => response.json())
      .then(data => data = data[searchLayer].label);
  return layerLabelPromise;
}

export function addSwisstopoLayer(viewer: Viewer, layer: string, format: 'png' | 'jpeg', maximumLevel: number, timestamp = 'current'): ImageryLayer {
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

const wmtsCapabilitiesUrl = 'https://wmts.geo.admin.ch/EPSG/3857/1.0.0/WMTSCapabilities.xml';
async function fetchWMTSCapabilities(): Promise<string> {
  const response = await fetch(wmtsCapabilitiesUrl);
  return await response.text();
}

let wmtsCapabilities: Document | undefined;
const parser = new DOMParser();
const owsNamespace = 'http://www.opengis.net/ows/1.1';

/**
 * Fetch WMTSCapabilities and parse time values
 */
async function fetchAndParseTimeValues(): Promise<Record<string, string[]>> {
  const timestamps: Record<string, string[]> = {};
  if (!wmtsCapabilities) {
    const text = await fetchWMTSCapabilities();
    wmtsCapabilities = parser.parseFromString(text, 'text/xml');
  }
  const layers = wmtsCapabilities.querySelectorAll('Layer');
  for (const layer of layers.values()) {
    const identifiers = layer.getElementsByTagNameNS(owsNamespace, 'Identifier');
    Array.from(identifiers).forEach(identifier => {
      // check for ch. to exclude Time identifier
      if (identifier?.textContent?.includes('ch.')) {
        timestamps[identifier.textContent] = [];
        const times = layer.querySelectorAll('Dimension > Value');
        times.forEach(time => {
          if (time.textContent) {
            timestamps[identifier.textContent!].push(time.textContent);
          }
        });
      }
    });
  }
  return timestamps;
}

export async function getLayerTimes(layerId: string): Promise<string[]> {
  if (!timesOfSwisstopoWMTSLayers) {
    timesOfSwisstopoWMTSLayers = await fetchAndParseTimeValues();
  }
  return timesOfSwisstopoWMTSLayers[layerId] || ['current'];
}