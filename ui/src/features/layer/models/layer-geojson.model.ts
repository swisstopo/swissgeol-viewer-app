import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';

export interface GeoJsonLayer extends BaseLayer {
  type: LayerType.GeoJson;

  source: LayerSource;

  /**
   * The source for the layer's terrain.
   * If this is `null`, the GeoJson is draped directly onto the default terrain.
   */
  terrain: LayerSource | null;

  /**
   * Whether the GeoJson's data should be clamped to the ground during loading.
   */
  shouldClampToGround: boolean;

  canUpdateOpacity: true;

  /**
   * The order in which the layer's properties are sorted when displayed.
   * Keys that are left out will be sorted below any sorted ones, in default order.
   */
  orderOfProperties: string[];

  layerStyle: LayerStyle | null;
}

export interface PointLayerStyleValues {
  geomType: 'point';
  value: string | number;
  vectorOptions: PointVectorOptions;
}

export interface LineLayerStyleValues {
  geomType: 'line';
  value: string | number;
  vectorOptions: LineVectorOptions;
}

export interface PolygonLayerStyleValues {
  geomType: 'polygon';
  value: string | number;
  vectorOptions: PolygonVectorOptions;
}

export type LayerStyleValues =
  PointLayerStyleValues | LineLayerStyleValues | PolygonLayerStyleValues;

export type LayerStyleGeomType = LayerStyleValues['geomType'];

export interface FillStyle {
  color?: string;
}

export interface StrokeStyle {
  color?: string;
  width?: number;
}

export type ShapePointType = 'circle' | 'triangle' | 'square';
export interface ShapePointVectorOptions {
  type?: ShapePointType;
  radius?: number;
  rotation?: number;
  fill?: FillStyle;
  stroke?: StrokeStyle;
}

interface IconPointVectorOptions {
  type: 'icon';
  src: string;
}

export type PointVectorOptions =
  ShapePointVectorOptions | IconPointVectorOptions;

export interface LineVectorOptions {
  stroke?: StrokeStyle;
}

export interface PolygonVectorOptions {
  fill?: FillStyle;
  stroke?: StrokeStyle;
}

export interface LayerStyle {
  property: string;
  values: LayerStyleValues[];
}
