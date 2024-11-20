import {ClientConfig} from './api/client-config';
import type {OutputFormat} from './toolbox/ngm-gst-interaction';

export class GstService {
  constructor(
    private readonly clientConfig: ClientConfig,
  ) {
  }

  borehole(options: GstRequestOptionsWithDepth): Promise<any> {
    const {coords, signal, title, outputType, depth} = {
      ...options,
      depth: options.depth ?? 5000,
      outputType: options.outputType ?? DEFAULT_GST_OUTPUT_TYPE,
      title: options.title ?? DEFAULT_GST_TITLE,
    };

    const params = new URLSearchParams({
      csRootElement: '0',
      csRootScale: '-1',
      intersectionGeometry: `multipoint z ((${joinCoordinates(coords)}))`,
      legendTemplateFile: '',
      maxBoreDepth: String(depth),
      outputType: outputType,
      projectZ: 'true',
      scale: '-1',
      secret: 'SAS2019@ngm',
      srs: '18',
      subtreeRootElement: '11510',
      templateFile: '02-BH_swisstopo_Map_2019a.svg',
      title: title,
      user: 'NGM',
      crs: 'EPSG:2056',
      verticalExageration: '-1'
    });
    const url = `${this.clientConfig.gstUrl}/webgui/createBoreholeWithOverviewMap.php?${params}`;
    return fetch(url, {signal}).then(response => response.json());
  }

  verticalCrossSection(options: GstRequestOptions): Promise<any> {
    const {coords, signal, title, outputType} = {
      ...options,
      outputType: options.outputType ?? DEFAULT_GST_OUTPUT_TYPE,
      title: options.title ?? DEFAULT_GST_TITLE,
    };

    const params = new URLSearchParams({
      csRootElement: '0',
      csRootScale: '-1',
      depthRangeMax: '3.40282e+38',
      depthRangeMin: '-3.40282e+38',
      errorImageName: '',
      geometryFileType: 'SFSP',
      intersectionGeometry: `multilinestring z ((${joinCoordinates(coords)}))`,
      legendTemplateFile: '',
      outputType: outputType,
      overviewMap: '',
      pointProjectionDistance: '0',
      propertySelection: '',
      secret: 'SAS2019@ngm',
      srs: '18',
      subtreeRootElement: '11510',
      templateFile: '03-CS_swisstopo_Map_2019.svg',
      title: title,
      user: 'NGM',
      crs: 'EPSG:2056',
      verticalExageration: '-1'
    });
    const url = `${this.clientConfig.gstUrl}/webgui/createCrossSectionWithOverviewMap.php?${params}`;
    return fetch(url, {signal}).then(response => response.json());
  }

  horizontalCrossSection(options: GstRequestOptionsWithDepth): Promise<any> {
    const {coords, signal, title, outputType, depth} = {
      ...options,
      depth: options.depth ?? -2500,
      outputType: options.outputType ?? DEFAULT_GST_OUTPUT_TYPE,
      title: options.title ?? DEFAULT_GST_TITLE,
    };

    // 'coordinates' parameter is the rectangle:
    // 0 ---------- 3
    // |            |
    // |            |
    // 1 ---------- 2
    // line from index 0 to 1 is the 'coords' parameter.
    // distance from 3 to 0 is the 'width' parameter.

    // vector from point 3 to point 0
    const v30x = coords[0][0] - coords[3][0];
    const v30y = coords[0][1] - coords[3][1];
    const magnitude = Math.sqrt(v30x * v30x + v30y * v30y);

    const direction = isLeft(coords[0], coords[1], coords[3]) ? 'left' : 'right';

    const side = [coords[0], coords[1]];

    // space after comma is required for overview map
    const geometry = joinCoordinates(side, ', ');

    const params = new URLSearchParams({
      boxWidth: String(magnitude),
      colorMapId: '',
      csRootElement: '0',
      csRootScale: '-1',
      depth: String(depth),
      direction: direction,
      errorImageName: '',
      geometryFileType: 'SFSP',
      intersectionGeometry: `multilinestring z ((${geometry}))`,
      legendTemplateFile: '',
      outputType: outputType,
      overviewMap: '',
      propertySelection: '',
      scale: '-1',
      secret: 'SAS2019@ngm',
      srs: '18',
      subtreeRootElement: '11510',
      templateFile: '04-HS_swisstopo_Map_2019.svg',
      title: title,
      user: 'NGM',
      crs: 'EPSG:2056',
      verticalExageration: '-1'
    });
    const url = `${this.clientConfig.gstUrl}/webgui/createHorizontalSectionWithOverviewMap.php?${params}`;
    return fetch(url, {signal}).then(response => response.json());
  }
}


interface GstRequestOptions {
  coords: number[][]
  signal: AbortSignal
  outputType?: OutputFormat
  title?: string
}

interface GstRequestOptionsWithDepth extends GstRequestOptions {
  depth?: number
}

const DEFAULT_GST_OUTPUT_TYPE: OutputFormat = 'pdf';
const DEFAULT_GST_TITLE: string = '';


const joinCoordinates = (coords: number[][], delimiter: string = ','): string => (
  coords.map(coordinate => coordinate.join(' ')).join(delimiter)
);

/**
 * @param a point on the line
 * @param b point on the line
 * @param c point to test
 * @return point 'c' is on the left side of the line passing by 'a' and 'b'
 */
const isLeft = (a: number[], b: number[], c: number[]): boolean => (
  ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 0
);
