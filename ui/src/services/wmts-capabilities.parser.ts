import {
  LayerType,
  WmtsLayer,
  WmtsLayerSource,
  WmtsLayerTimes,
} from 'src/features/layer';
import { makeId } from 'src/models/id.model';

export function parseWmsCapabilities(
  xml: Document,
  service: string,
): WmtsLayer[] {
  const configs: WmtsLayer[] = [];
  const layers = xml.querySelectorAll('Layer');
  const format = resolvePreferredWmsGetMapFormat(xml);
  const serviceUrl = resolveWmsGetMapUrl(xml);

  for (const layer of layers.values()) {
    const layerTitle = layer.querySelector('Title')?.textContent;
    const layerName = layer.querySelector('Name')?.textContent;
    if (!layerName) {
      continue;
    }

    const defaultTimestamp =
      layer.querySelector('Dimension')?.getAttribute('default') ?? null;

    const timestamps =
      layer.querySelector('Dimension')?.textContent?.split(',') || [];

    configs.push({
      type: LayerType.Wmts,
      id: makeId(`${layerName}`),
      label: layerTitle ?? null,
      source: WmtsLayerSource.WMS,
      service,
      serviceUrl,
      opacity: 1,
      canUpdateOpacity: true,
      isVisible: true,
      geocatId: null,
      downloadUrl: null,
      maxLevel: null,
      infoBox: null,
      format,
      credit: layerName.split('.')[1],
      times: makeTimes(defaultTimestamp, timestamps),
      customProperties: {},
      ogcSource: null,
    });
  }

  return configs;
}

export function parseWmtsCapabilities(
  xml: Document,
  service: string,
): WmtsLayer[] {
  const configs: WmtsLayer[] = [];
  const layers = xml.querySelectorAll('Layer');
  const getTileBaseUrl = resolveWmtsGetTileBaseUrl(xml);

  for (const layer of layers.values()) {
    const layerName = getDirectChildText(layer, 'Identifier');
    if (layerName === null) {
      continue;
    }
    const title = getDirectChildText(layer, 'Title');
    const defaultTimestamp =
      layer.querySelector('Dimension > Default')?.textContent ?? null;
    const format = getDirectChildText(layer, 'Format');
    const tileMatrixSet = resolveWmtsTileMatrixSet(layer);
    const style = resolveWmtsStyle(layer, layerName);
    if (!format) {
      continue;
    }

    const timestamps = Array.from(
      layer.querySelectorAll('Dimension > Value'),
    ).map((time) => time.textContent);

    const tileTemplate = resolveWmtsTileTemplate({
      layer,
      getTileBaseUrl,
      layerName,
      format,
      style,
      tileMatrixSet: tileMatrixSet ?? undefined,
      hasTimeDimension: timestamps.length > 0,
    });

    configs.push({
      type: LayerType.Wmts,
      id: makeId(`${layerName}`),
      source: WmtsLayerSource.WMTS,
      service,
      serviceUrl: tileTemplate,
      label: title ?? layerName,
      opacity: 1,
      canUpdateOpacity: true,
      isVisible: true,
      geocatId: null,
      downloadUrl: null,
      maxLevel: resolveMaxLevel(tileMatrixSet),
      infoBox: null,
      format,
      credit: resolveCredit(layerName),
      times: makeTimes(defaultTimestamp, timestamps),
      customProperties: {
        wmtsStyle: style,
        tileMatrixSet: tileMatrixSet ?? 'EPSG:3857',
      },
      ogcSource: null,
    });
  }

  return configs;
}

function resolvePreferredWmsGetMapFormat(xml: Document): string {
  const getMap = findRequestOperation(xml, 'GetMap');
  const formats = getDirectChildTexts(getMap, 'Format');
  const preferred = formats.find(
    (value) => value.toLowerCase() === 'image/png',
  );
  return preferred ?? formats[0] ?? 'image/png';
}

function resolveWmsGetMapUrl(xml: Document): string | null {
  const getMap = findRequestOperation(xml, 'GetMap');
  const candidate = getMap?.getElementsByTagNameNS('*', 'OnlineResource')[0];
  return getHref(candidate);
}

function resolveWmtsGetTileBaseUrl(xml: Document): string | null {
  const getTileOperation = Array.from(
    xml.getElementsByTagNameNS('*', 'Operation'),
  ).find((operation) => operation.getAttribute('name') === 'GetTile');
  const get =
    Array.from(getTileOperation?.children ?? [])
      .find((child) => child.localName === 'DCP')
      ?.getElementsByTagNameNS('*', 'Get')?.[0] ?? null;
  return getHref(get);
}

function resolveWmtsStyle(layer: Element, layerName: string): string {
  const styles = Array.from(layer.getElementsByTagNameNS('*', 'Style'));
  const identifiers = styles
    .map((style) => ({
      node: style,
      identifier: getDirectChildText(style, 'Identifier') ?? '',
    }))
    .filter((entry) => entry.identifier.length > 0);

  // Prefer a style whose identifier matches the layer name exactly.
  // This is the named/thematic style (e.g. 'swisstopo:gc_bedrock' for layer 'swisstopo:gc_bedrock'),
  // and is more reliable than isDefault=true which may point to a generic style (e.g. 'polygon', '_empty').
  const namedMatch = identifiers.find(
    ({ identifier }) => identifier === layerName,
  );
  if (namedMatch != null) {
    return namedMatch.identifier;
  }

  const preferred = identifiers.find(
    ({ node }) => node.getAttribute('isDefault') === 'true',
  );
  const selected = preferred ?? identifiers[0] ?? null;
  return selected?.identifier ?? 'default';
}

function resolveWmtsTileMatrixSet(layer: Element): string | null {
  const matrixSets = Array.from(
    layer.getElementsByTagNameNS('*', 'TileMatrixSet'),
  )
    .map((node) => (node.textContent ?? '').trim())
    .filter((value) => value.length > 0);
  const preferred =
    matrixSets.find((value) => value === 'EPSG:3857') ??
    matrixSets.find((value) => value === 'EPSG:900913');
  return preferred ?? matrixSets[0] ?? null;
}

function resolveMaxLevel(tileMatrixSet: string | null): number | null {
  if (tileMatrixSet === null) {
    return null;
  }
  const bySuffix = Number(tileMatrixSet.split('_')[1] ?? Number.NaN);
  return Number.isNaN(bySuffix) ? null : bySuffix;
}

function resolveWmtsTileTemplate(options: {
  layer: Element;
  getTileBaseUrl: string | null;
  layerName: string;
  format: string;
  style: string;
  tileMatrixSet: string | undefined;
  hasTimeDimension: boolean;
}): string | null {
  const resourceUrl = options.layer
    .querySelector('ResourceURL[resourceType="tile"]')
    ?.getAttribute('template');
  if (resourceUrl && resourceUrl.length > 0) {
    return resourceUrl;
  }
  if (options.getTileBaseUrl === null) {
    return null;
  }

  const params = [
    ['SERVICE', 'WMTS'],
    ['REQUEST', 'GetTile'],
    ['VERSION', '1.0.0'],
    ['LAYER', options.layerName],
    ['STYLE', options.style],
    ['TILEMATRIXSET', options.tileMatrixSet ?? 'EPSG:3857'],
    ['TILEMATRIX', '{TileMatrix}'],
    ['TILEROW', '{TileRow}'],
    ['TILECOL', '{TileCol}'],
    ['FORMAT', options.format],
  ];

  if (options.hasTimeDimension) {
    params.push(['TIME', '{Time}']);
  }

  const query = params.map(([key, value]) => `${key}=${value}`).join('&');
  return options.getTileBaseUrl.includes('?')
    ? `${options.getTileBaseUrl}&${query}`
    : `${options.getTileBaseUrl}?${query}`;
}

function findRequestOperation(
  xml: Document,
  operationName: string,
): Element | null {
  const request = xml.getElementsByTagNameNS('*', 'Request')[0];
  if (!request) {
    return null;
  }
  return (
    Array.from(request.children).find(
      (child) => child.localName === operationName,
    ) ?? null
  );
}

function getDirectChildTexts(
  node: Element | null,
  childName: string,
): string[] {
  if (node === null) {
    return [];
  }
  return Array.from(node.children)
    .filter((child) => child.localName === childName)
    .map((child) => (child.textContent ?? '').trim())
    .filter((value) => value.length > 0);
}

function getDirectChildText(
  node: Element | null,
  childName: string,
): string | null {
  return getDirectChildTexts(node, childName)[0] ?? null;
}

function getHref(node: Element | null | undefined): string | null {
  if (node == null) {
    return null;
  }
  const href =
    node.getAttribute('xlink:href') ??
    node.getAttribute('href') ??
    node.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
    null;
  return href === '' ? null : href;
}

function resolveCredit(layerName: string): string {
  const dotted = layerName.split('.')[1]?.trim();
  if (dotted) {
    return dotted;
  }
  const namespaced = layerName.split(':')[0]?.trim();
  if (namespaced) {
    return namespaced;
  }
  return layerName;
}

function makeTimes(
  current: string | null,
  all: string[] | null,
): WmtsLayerTimes | null {
  const isDefaultCurrent = current === null || current === 'current';
  const isDefaultAll =
    all === null ||
    all.length === 0 ||
    (all.length === 1 && all[0] === 'current');
  if (isDefaultAll && isDefaultCurrent) {
    return null;
  }
  const currentValue = current ?? all?.[0] ?? 'current';
  return {
    current: currentValue,
    all: all ?? [currentValue],
  };
}
