import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Color from 'cesium/Source/Core/Color';

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

export interface NgmGeometry {
  id?: string;
  name?: string;
  show?: boolean;
  positions: Array<Cartesian3>;
  area?: string | number;
  perimeter?: string | number;
  sidesLength?: Array<string | number>;
  numberOfSegments?: number;
  type: 'point' | 'line' | 'rectangle' | 'polygon';
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
  depth?: number
}
