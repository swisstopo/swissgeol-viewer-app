import type {Cartesian3, Color} from 'cesium';

export interface SwissforagesModalOptions {
  name: string | undefined;
  id: string | undefined;
  position: undefined;
  onLoggedIn: void | undefined;
  onSwissforagesBoreholeCreated: void | undefined;
  show: boolean
}

export interface AreasCounter {
  line: number;
  point: number;
  rectangle: number;
  polygon: number;
}

export type GeometryTypes = 'point' | 'line' | 'rectangle' | 'polygon'

export interface NgmGeometry {
  id?: string;
  name?: string;
  show?: boolean;
  positions: Array<Cartesian3>;
  area?: string | number;
  perimeter?: string | number;
  sidesLength?: Array<string | number>;
  numberOfSegments?: number;
  type: GeometryTypes;
  description?: string;
  image?: string;
  website?: string;
  pointSymbol?: string;
  color?: Color;
  clampPoint?: boolean;
  showSlicingBox?: boolean;
  volumeShowed?: boolean;
  volumeHeightLimits?: { lowerLimit: number, height: number };
  swissforagesId?: string;
  depth?: number;
  editable?: boolean;
  copyable?: boolean;
  fromTopic?: boolean;
}
