import type { Cartesian3, Color } from 'cesium';

export interface SwissforagesModalOptions {
  name: string | undefined;
  id: string | undefined;
  position: undefined;
  onLoggedIn: void | undefined;
  onSwissforagesBoreholeCreated: void | undefined;
  show: boolean;
}

export interface AreasCounter {
  line: number;
  point: number;
  rectangle: number;
  polygon: number;
}

export type GeometryTypes = 'point' | 'line' | 'rectangle' | 'polygon';

export interface NgmGeometry {
  type: GeometryTypes;
  positions: Array<Cartesian3>;
  id?: string;
  name?: string;
  show?: boolean;
  area?: string;
  perimeter?: string;
  sidesLength?: Array<number>;
  numberOfSegments?: number;
  description?: string;
  image?: string;
  website?: string;
  pointSymbol?: string;
  color?: Color;
  clampPoint?: boolean;
  showSlicingBox?: boolean;
  volumeShowed?: boolean;
  volumeHeightLimits?: { lowerLimit: number; height: number };
  swissforagesId?: string;
  depth?: number;
  diameter?: number;
  editable?: boolean;
  copyable?: boolean;
}
