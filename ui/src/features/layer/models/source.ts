export type LayerSource =
  | LayerSourceForCesiumIon
  | LayerSourceForUrl
  | LayerSourceForS3
  | LayerSourceForOgc;

export enum LayerSourceType {
  CesiumIon = 'CesiumIon',
  Url = 'Url',
  S3 = 'S3',
  Ogc = 'Ogc',
}

export interface LayerSourceForCesiumIon {
  type: LayerSourceType.CesiumIon;
  assetId: number;

  /**
   * A custom access token.
   * If left out, the default public access token will be used.
   */
  accessToken?: string;
}

export interface LayerSourceForUrl {
  type: LayerSourceType.Url;
  url: string;
}

export interface LayerSourceForS3 {
  type: LayerSourceType.S3;
  bucket: string;
  key: string;
}

export enum OgcSourceType {
  Gst = 'gst',
  Stac = 'stac',
  Fdsn = 'fdsn',
  Wms = 'wms',
}

interface OgcTypeForGst {
  type: OgcSourceType.Gst;
  /**
   * The id of the collection representing the layer.
   */
  id: number;

  /**
   * The id of the style with which the layer should be rendered.
   * If left out, the collection's default download is used.
   */
  styleId?: number;
}

interface OgcTypeForStac {
  type: OgcSourceType.Stac;
  collection: string;
}

interface OgcTypeForWms {
  type: OgcSourceType.Wms;
}

interface OgcTypeForFdsn {
  type: OgcSourceType.Fdsn;
  minMagnitude?: number;
  /**
   * Relative time offset from now.
   * Examples: "3 months", "90 days", "1 year"
   */
  startTime?: string;
}

export type OgcSource =
  OgcTypeForGst | OgcTypeForStac | OgcTypeForFdsn | OgcTypeForWms;

export interface LayerSourceForOgc {
  type: LayerSourceType.Ogc;

  ogcSource: OgcSource;
  /**
   * An optional source that will be used when displaying the layer.
   * When this is set, the OGC API will only be used for layer exports.
   */
  displaySource?: LayerSource;
}
