import { LayerInfoAttribute } from 'src/features/layer/info/layer-info.model';
import {
  getTranslationKeyForLayerAttributeName,
  WmtsLayer,
  WmtsLayerSource,
} from 'src/features/layer';
import {
  DEFAULT_WMTS_SERVICE,
  WMTS_CAPABILITIES_BY_SERVICE,
} from 'src/constants';
import { isLexicTermUrl } from 'src/features/lexic/lexic-url';

const DEFAULT_GEO_ADMIN_API_URL = 'https://api3.geo.admin.ch';
const FEATURE_INFO_WIDTH = 101;
const FEATURE_INFO_HEIGHT = 101;
const FEATURE_INFO_BBOX_DELTA = 5;
const URL_PATTERN = /^https?:\/\//i;

const WMTS_ENDPOINT_SUFFIXES = [
  '/gwc/service/wmts',
  '/service/wmts',
  '/wmts',
  '/wms',
];

export interface IdentifyResult {
  layerBodId: string;
  featureId: string;
  geometry?: IdentifiedGeometry | null;
}

export interface IdentifiedGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface ServiceFeatureInfoFeature {
  properties?: Record<string, unknown> | null;
  geometry?: IdentifiedGeometry | null;
}

interface ServiceFeatureInfoResponse {
  features?: ServiceFeatureInfoFeature[];
}

type WmtsLayerForInfo = Pick<
  WmtsLayer,
  'id' | 'type' | 'serviceUrl' | 'source' | 'service'
>;

/**
 * Facade used by the WMTS picker.
 *
 * Why this exists:
 * - geo.admin uses ArcGIS-style endpoints (`identify`, `htmlPopup`)
 * - external services use WMS `GetFeatureInfo`
 *
 * The picker does not need to know protocol details; it calls this facade.
 */
export class LayerInfoPickerForWmtsService {
  private readonly geoAdminClient: GeoAdminWmtsInfoClient;
  private readonly externalClient: ExternalWmtsInfoClient;

  constructor(layer: WmtsLayerForInfo) {
    this.geoAdminClient = new GeoAdminWmtsInfoClient(layer);
    this.externalClient = new ExternalWmtsInfoClient(layer);
  }

  shouldUseGeoAdminIdentify(): boolean {
    return this.geoAdminClient.shouldUseIdentify();
  }

  async fetchIdentifyResults(
    geom2056: [number, number],
    tolerance: number,
    lang: string,
  ): Promise<IdentifyResult[] | null> {
    return this.geoAdminClient.fetchIdentifyResults(geom2056, tolerance, lang);
  }

  async fetchHtmlPopup(result: IdentifyResult, lang: string): Promise<string> {
    return this.geoAdminClient.fetchHtmlPopup(result, lang);
  }

  async fetchServiceFeatureInfo(
    geom2056: [number, number],
    lang: string,
  ): Promise<ServiceFeatureInfoFeature[] | null> {
    return this.externalClient.fetchServiceFeatureInfo(geom2056, lang);
  }

  mapFeaturePropertiesToAttributes(
    properties: Record<string, unknown> | null | undefined,
  ): LayerInfoAttribute[] {
    return this.externalClient.mapFeaturePropertiesToAttributes(properties);
  }

  extractPopupAttributes(html: string): LayerInfoAttribute[] {
    return this.geoAdminClient.extractPopupAttributes(html);
  }
}

class GeoAdminWmtsInfoClient {
  constructor(private readonly layer: WmtsLayerForInfo) {}

  /**
   * Identify is only reliable for geo.admin-like hosts.
   * For unknown/external hosts, the caller should use WMS GetFeatureInfo instead.
   */
  shouldUseIdentify(): boolean {
    const { serviceUrl } = this.layer;
    if (serviceUrl === null) {
      return true;
    }

    try {
      const hostname = new URL(serviceUrl).hostname.toLowerCase();
      return hostname.endsWith('geo.admin.ch') || hostname.startsWith('api3.');
    } catch {
      return true;
    }
  }

  async fetchIdentifyResults(
    geom2056: [number, number],
    tolerance: number,
    lang: string,
  ): Promise<IdentifyResult[] | null> {
    // Try the layer-derived base first, then the default api3 host.
    for (const baseUrl of this.buildRestApiBaseUrls()) {
      const identifyUrl = this.buildIdentifyUrl(
        geom2056,
        tolerance,
        lang,
        baseUrl,
      );
      try {
        const response = await fetch(identifyUrl);
        if (!response.ok) {
          continue;
        }

        const body = await response.text();
        const parsed = JSON.parse(body) as { results?: IdentifyResult[] };
        if (parsed.results !== undefined) {
          return parsed.results;
        }
      } catch (e) {
        console.warn(
          `[LayerInfoPickerForWmtsService] identify failed for ${baseUrl}:`,
          e,
        );
      }
    }

    return null;
  }

  async fetchHtmlPopup(result: IdentifyResult, lang: string): Promise<string> {
    // Use the same endpoint fallback order as identify.
    for (const baseUrl of this.buildRestApiBaseUrls()) {
      const popupUrl = this.buildHtmlPopupUrl(result, lang, baseUrl);
      try {
        const response = await fetch(popupUrl);
        if (!response.ok) {
          continue;
        }

        return await response.text();
      } catch (e) {
        console.warn(
          `[LayerInfoPickerForWmtsService] htmlPopup failed for ${baseUrl}:`,
          e,
        );
      }
    }

    return '';
  }

  extractPopupAttributes(html: string): LayerInfoAttribute[] {
    // htmlPopup returns an HTML table; we flatten it to key/value pairs for the info box.
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('.htmlpopup-content table tr')];

    let savedTitle: string | null = null;
    return rows.reduce((attributes, row) => {
      const [key, val, addition] = row.querySelectorAll('td');
      const keyValue = key.textContent?.trim();

      if (val === undefined) {
        if (keyValue) {
          savedTitle = keyValue;
        }
        return attributes;
      }

      if (
        !keyValue?.length &&
        !val.textContent?.trim().length &&
        addition !== undefined
      ) {
        attributes.push({
          key: savedTitle ?? '',
          value: this.extractTextOrLink(addition),
        });
        return attributes;
      }

      attributes.push({
        key: keyValue ?? '',
        value: this.extractTextOrLink(val),
      });
      return attributes;
    }, [] as LayerInfoAttribute[]);
  }

  private buildRestApiBaseUrls(): string[] {
    const primary = this.deriveRestApiBaseUrl();
    const normalizedDefault = `${DEFAULT_GEO_ADMIN_API_URL}/`;
    if (
      primary === normalizedDefault ||
      primary === DEFAULT_GEO_ADMIN_API_URL
    ) {
      return [normalizedDefault];
    }
    return [primary, normalizedDefault];
  }

  private buildIdentifyUrl(
    geom2056: [number, number],
    tolerance: number,
    lang: string,
    baseUrl: string,
  ): string {
    const url = new URL('rest/services/all/MapServer/identify', baseUrl);
    url.searchParams.set('geometry', geom2056.join(','));
    url.searchParams.set('geometryFormat', 'geojson');
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('mapExtent', '0,0,100,100');
    url.searchParams.set('imageDisplay', '100,100,100');
    url.searchParams.set('lang', lang);
    url.searchParams.set('layers', `all:${this.layer.id}`);
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('sr', '2056');
    url.searchParams.set('tolerance', String(tolerance));
    return url.toString();
  }

  private buildHtmlPopupUrl(
    result: IdentifyResult,
    lang: string,
    baseUrl: string,
  ): string {
    const url = new URL(
      `rest/services/api/MapServer/${result.layerBodId}/${result.featureId}/htmlPopup`,
      baseUrl,
    );
    url.searchParams.set('lang', lang);
    return url.toString();
  }

  private deriveRestApiBaseUrl(): string {
    const { serviceUrl, source } = this.layer;
    if (
      serviceUrl === null ||
      (source !== WmtsLayerSource.WMS && source !== WmtsLayerSource.WMTS)
    ) {
      return `${DEFAULT_GEO_ADMIN_API_URL}/`;
    }

    try {
      const parsed = new URL(serviceUrl);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname.startsWith('api3.')) {
        return `${parsed.origin}/`;
      }

      const convertedHost = hostname.replace(/^(?:wms|wmts)[^.]*\./, 'api3.');
      if (convertedHost !== hostname) {
        return `${parsed.protocol}//${convertedHost}/`;
      }

      let strippedPathname = parsed.pathname.replace(/\/+$/, '');
      const lowerPathname = strippedPathname.toLowerCase();
      for (const suffix of WMTS_ENDPOINT_SUFFIXES) {
        if (lowerPathname.endsWith(suffix)) {
          strippedPathname = strippedPathname.slice(
            0,
            strippedPathname.length - suffix.length,
          );
          break;
        }
      }

      const normalizedPrefix =
        strippedPathname.length > 0 ? `${strippedPathname}/` : '/';
      return `${parsed.origin}${normalizedPrefix}`;
    } catch {
      return `${DEFAULT_GEO_ADMIN_API_URL}/`;
    }
  }

  private extractTextOrLink(element: HTMLElement): LayerInfoAttribute['value'] {
    if (
      element.childElementCount === 1 &&
      element.children[0].tagName === 'A'
    ) {
      const anchor = element.children[0] as HTMLAnchorElement;
      return { url: anchor.href, name: anchor.text };
    }
    return element.textContent?.trim() ?? '';
  }
}

class ExternalWmtsInfoClient {
  constructor(private readonly layer: WmtsLayerForInfo) {}

  /**
   * External WMTS/WMS fallback:
   * call WMS GetFeatureInfo and return raw features, if present.
   */
  async fetchServiceFeatureInfo(
    geom2056: [number, number],
    lang: string,
  ): Promise<ServiceFeatureInfoFeature[] | null> {
    const infoUrl = this.buildServiceFeatureInfoUrl(geom2056, lang);
    if (infoUrl === null) {
      return null;
    }

    try {
      const response = await fetch(infoUrl);
      if (!response.ok) {
        return null;
      }

      const body = await response.text();
      const parsed = JSON.parse(body) as Partial<ServiceFeatureInfoResponse>;
      if (Array.isArray(parsed.features)) {
        return parsed.features;
      }
    } catch (e) {
      console.warn(
        `[LayerInfoPickerForWmtsService] GetFeatureInfo failed for ${infoUrl}:`,
        e,
      );
    }

    return null;
  }

  mapFeaturePropertiesToAttributes(
    properties: Record<string, unknown> | null | undefined,
  ): LayerInfoAttribute[] {
    // External payload keys/values are normalized for readability in the info box.
    if (properties == null) {
      return [];
    }

    return Object.entries(properties).map(([key, rawValue]) => ({
      key: getTranslationKeyForLayerAttributeName(this.layer, key),
      value: this.normalizeAttributeValue(rawValue),
    }));
  }

  private buildServiceFeatureInfoUrl(
    geom2056: [number, number],
    lang: string,
  ): string | null {
    const base = this.resolveExternalWmsBaseUrl();
    if (base === null) {
      return null;
    }

    base.pathname = base.pathname
      .replace(/\/gwc\/service\/wmts\/?$/i, '/wms')
      .replace(/\/service\/wmts\/?$/i, '/wms')
      .replace(/\/wmts\/?$/i, '/wms');
    base.search = '';
    base.hash = '';

    const [x, y] = geom2056;

    base.searchParams.set('SERVICE', 'WMS');
    base.searchParams.set('VERSION', '1.3.0');
    base.searchParams.set('REQUEST', 'GetFeatureInfo');
    base.searchParams.set('LAYERS', String(this.layer.id));
    base.searchParams.set('QUERY_LAYERS', String(this.layer.id));
    base.searchParams.set('STYLES', '');
    base.searchParams.set('CRS', 'EPSG:2056');
    base.searchParams.set(
      'BBOX',
      `${x - FEATURE_INFO_BBOX_DELTA},${y - FEATURE_INFO_BBOX_DELTA},${x + FEATURE_INFO_BBOX_DELTA},${y + FEATURE_INFO_BBOX_DELTA}`,
    );
    base.searchParams.set('WIDTH', String(FEATURE_INFO_WIDTH));
    base.searchParams.set('HEIGHT', String(FEATURE_INFO_HEIGHT));
    base.searchParams.set('I', String(Math.floor(FEATURE_INFO_WIDTH / 2)));
    base.searchParams.set('J', String(Math.floor(FEATURE_INFO_HEIGHT / 2)));
    base.searchParams.set('INFO_FORMAT', 'application/json');
    base.searchParams.set('FEATURE_COUNT', '10');
    base.searchParams.set('LANG', lang);

    return base.toString();
  }

  private resolveExternalWmsBaseUrl(): URL | null {
    const serviceName = this.layer.service ?? DEFAULT_WMTS_SERVICE;
    const mappedService =
      WMTS_CAPABILITIES_BY_SERVICE[serviceName] ??
      WMTS_CAPABILITIES_BY_SERVICE[DEFAULT_WMTS_SERVICE];

    if (mappedService?.wms != null) {
      try {
        const fromMap = new URL(mappedService.wms);
        fromMap.search = '';
        fromMap.hash = '';
        return fromMap;
      } catch {
        // fall through to serviceUrl-based fallback
      }
    }

    const { serviceUrl } = this.layer;
    if (serviceUrl === null) {
      return null;
    }
    try {
      const fallback = new URL(serviceUrl);
      fallback.pathname = fallback.pathname
        .replace(/\/gwc\/service\/wmts\/rest\/.*$/i, '/wms')
        .replace(/\/gwc\/service\/wmts\/?$/i, '/wms')
        .replace(/\/service\/wmts\/?$/i, '/wms')
        .replace(/\/wmts\/?$/i, '/wms');
      fallback.search = '';
      fallback.hash = '';
      return fallback;
    } catch {
      return null;
    }
  }

  private normalizeAttributeValue(value: unknown): LayerInfoAttribute['value'] {
    if (typeof value === 'string') {
      if (isLexicTermUrl(value)) {
        return { type: 'lexic-term', termUrl: value };
      }
      if (URL_PATTERN.test(value)) {
        return { url: value, name: 'Link' };
      }
      return value;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return String(value);
    }

    if (value === null || value === undefined) {
      return '';
    }

    try {
      return JSON.stringify(value);
    } catch {
      if (typeof value === 'object') {
        return '[Unserializable object]';
      }

      if (typeof value === 'symbol') {
        return value.description ? `Symbol(${value.description})` : 'Symbol';
      }

      if (typeof value === 'bigint') {
        return value.toString();
      }

      if (typeof value === 'function') {
        return '[Function]';
      }

      return '[Unsupported value]';
    }
  }
}
