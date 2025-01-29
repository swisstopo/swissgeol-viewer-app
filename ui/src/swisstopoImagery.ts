import { SWITZERLAND_RECTANGLE, WEB_MERCATOR_TILING_SCHEME } from './constants';

import {
  Credit,
  ImageryLayer,
  UrlTemplateImageryProvider,
  Viewer,
  WebMapServiceImageryProvider,
} from 'cesium';
import i18next from 'i18next';
import { getURLSearchParams } from './utils';
import { LayerConfig } from './layertree';

export type SwisstopoImageryLayer = {
  format: string;
  type: 'wmts' | 'wms';
  attribution: string;
  title: string;
  timestamps?: string[];
  defaultTimestamp?: string;
  sr?: number;
  maximumLevel?: number;
};

export type SwisstopoImageryLayersConfig = Record<
  string,
  SwisstopoImageryLayer
>;

const wmtsLayerUrlTemplate =
  'https://wmts.geo.admin.ch/1.0.0/{layer}/default/{timestamp}/3857/{z}/{x}/{y}.{format}';

let layerConfigs: SwisstopoImageryLayersConfig | undefined;

/**
 * @param localConfig
 * @param {number} [maximumLevel]
 * @param {import('cesium/Source/Core/Rectangle').default} [rectangle]
 * @return {Promise<ImageryLayer>}
 */
export function getSwisstopoImagery(
  localConfig: LayerConfig,
): Promise<ImageryLayer> {
  return new Promise((resolve, reject) => {
    getLayersConfig().then(async (layersConfig) => {
      const swisstopoConfig = layersConfig[localConfig.layer!];
      if (swisstopoConfig) {
        let imageryProvider:
          | UrlTemplateImageryProvider
          | WebMapServiceImageryProvider;
        localConfig.label = swisstopoConfig.title;
        if (swisstopoConfig.type === 'wmts') {
          localConfig.wmtsTimes = swisstopoConfig.timestamps;
          if (!localConfig.wmtsCurrentTime) {
            localConfig.wmtsCurrentTime = swisstopoConfig.defaultTimestamp;
          }
          const url = wmtsLayerUrlTemplate
            .replace('{layer}', localConfig.layer!)
            .replace('{format}', swisstopoConfig.format);
          imageryProvider = new UrlTemplateImageryProvider({
            url: url,
            maximumLevel:
              localConfig.maximumLevel ?? swisstopoConfig.maximumLevel,
            rectangle: SWITZERLAND_RECTANGLE,
            credit: new Credit(swisstopoConfig.attribution),
            customTags: {
              timestamp: () => {
                return localConfig.wmtsCurrentTime;
              },
            },
          });
        } else if (swisstopoConfig.type === 'wms') {
          const url = 'https://wms{s}.geo.admin.ch?version=1.3.0';
          imageryProvider = new WebMapServiceImageryProvider({
            url: url,
            crs: 'EPSG:4326',
            parameters: {
              FORMAT: swisstopoConfig.format,
              TRANSPARENT: true,
              LANG: i18next.language,
            },
            subdomains: '0123',
            tilingScheme: WEB_MERCATOR_TILING_SCHEME,
            layers: localConfig.layer!,
            maximumLevel: localConfig.maximumLevel,
            rectangle: SWITZERLAND_RECTANGLE,
            credit: new Credit(swisstopoConfig.attribution),
          });
        } else {
          reject(`unsupported layer type: ${swisstopoConfig.type}`);
          return;
        }
        const imageryLayer = new ImageryLayer(imageryProvider, {
          alpha: localConfig.opacity ?? 1,
        });
        resolve(imageryLayer);
      } else {
        reject(`layer not found: ${localConfig.layer}`);
      }
    });
  });
}

export function addSwisstopoLayer(
  viewer: Viewer,
  layer: string,
  format: 'png' | 'jpeg',
  maximumLevel: number,
  timestamp = 'current',
): ImageryLayer {
  const url = wmtsLayerUrlTemplate
    .replace('{layer}', layer)
    .replace('{timestamp}', timestamp)
    .replace('{format}', format);

  const imageryLayer = new ImageryLayer(
    new UrlTemplateImageryProvider({
      rectangle: SWITZERLAND_RECTANGLE,
      maximumLevel: maximumLevel,
      credit: new Credit('swisstopo'),
      url: url,
    }),
    {
      show: false,
    },
  );
  viewer.scene.imageryLayers.add(imageryLayer);
  viewer.scene.imageryLayers.lowerToBottom(imageryLayer);

  return imageryLayer;
}

const parser = new DOMParser();
const owsNamespace = 'http://www.opengis.net/ows/1.1';
async function parseWMTSCapabilities(
  wmtsCapabilities: Document,
): Promise<SwisstopoImageryLayersConfig> {
  const configs: SwisstopoImageryLayersConfig = {};
  const layers = wmtsCapabilities.querySelectorAll('Layer');
  for (const layer of layers.values()) {
    const identifiers = layer.getElementsByTagNameNS(
      owsNamespace,
      'Identifier',
    );
    const titles = layer.getElementsByTagNameNS(owsNamespace, 'Title');
    Array.from(identifiers).forEach((identifier) => {
      // check for ch. to exclude Time identifier
      if (identifier?.textContent?.includes('ch.')) {
        const layerName = identifier.textContent;
        const defaultTimestamp = layer.querySelector(
          'Dimension > Default',
        )?.textContent;
        const format = layer.querySelector('Format')?.textContent;
        const tileMatrixSet = layer
          .querySelector('TileMatrixSet')
          ?.textContent?.split('_');
        if (format) {
          configs[identifier.textContent] = {
            attribution: layerName.split('.')[1],
            format: format.split('/')[1],
            type: 'wmts',
            timestamps: [],
            defaultTimestamp: defaultTimestamp ?? undefined,
            sr: tileMatrixSet && Number(tileMatrixSet[0]),
            maximumLevel: tileMatrixSet && Number(tileMatrixSet[1]),
            title:
              titles && titles[0]?.textContent
                ? titles[0].textContent
                : layerName,
          };
          const times = layer.querySelectorAll('Dimension > Value');
          times.forEach((time) => {
            if (time.textContent) {
              configs[identifier.textContent!].timestamps!.push(
                time.textContent,
              );
            }
          });
        }
      }
    });
  }
  return configs;
}

async function parseWMSCapabilities(
  wmsCapabilities: Document,
): Promise<SwisstopoImageryLayersConfig> {
  const configs: SwisstopoImageryLayersConfig = {};
  const layers = wmsCapabilities.querySelectorAll('Layer');
  for (const layer of layers.values()) {
    const layerName = layer.querySelector('Name')?.textContent;
    const layerTitle = layer.querySelector('Title')?.textContent;
    if (layerName) {
      const defaultTimestamp = layer
        .querySelector('Dimension')
        ?.getAttribute('default');
      const format = layer.querySelector('LegendURL > Format')?.textContent;
      if (format) {
        configs[layerName] = {
          attribution: layerName.split('.')[1],
          format: format,
          type: 'wms',
          timestamps: [],
          defaultTimestamp: defaultTimestamp ?? undefined,
          title: layerTitle ?? layerName,
        };
        configs[layerName].timestamps =
          layer.querySelector('Dimension')?.textContent?.split(',') || [];
      }
    }
  }
  return configs;
}

const wmtsCapabilitiesUrl =
  'https://wmts.geo.admin.ch/EPSG/3857/1.0.0/WMTSCapabilities.xml';
const wmsCapabilitiesUrl =
  'https://wms.geo.admin.ch/?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0';

async function fetchWMTSCapabilities(lang: string) {
  try {
    const wmtsCapabilitiesResponse = await fetch(
      `${wmtsCapabilitiesUrl}?lang=${lang}`,
    );
    const wmtsCapabilities = parser.parseFromString(
      await wmtsCapabilitiesResponse.text(),
      'text/xml',
    );
    return await parseWMTSCapabilities(wmtsCapabilities);
  } catch (e) {
    console.error(`Can't fetch WMTS Capabilities: ${e}`);
    return {};
  }
}

async function fetchWMSCapabilities(lang: string) {
  try {
    const wmsCapabilitiesResponse = await fetch(
      `${wmsCapabilitiesUrl}&lang=${lang}`,
    );
    const wmsCapabilities = parser.parseFromString(
      await wmsCapabilitiesResponse.text(),
      'text/xml',
    );
    return await parseWMSCapabilities(wmsCapabilities);
  } catch (e) {
    console.error(`Can't fetch WMS Capabilities: ${e}`);
    return {};
  }
}

export async function getLayersConfig(): Promise<SwisstopoImageryLayersConfig> {
  if (!layerConfigs) {
    const params = getURLSearchParams();
    const lang = params.get('lang') ?? 'en';
    const wmsConfig = await fetchWMSCapabilities(lang);
    const wmtsConfig = await fetchWMTSCapabilities(lang);
    layerConfigs = { ...wmsConfig, ...wmtsConfig };
  }
  return layerConfigs;
}
