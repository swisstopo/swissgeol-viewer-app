import EarthquakeVisualizer from 'src/earthquakeVisualization/earthquakeVisualizer';
import {DataSource, ImageryLayer} from 'cesium';
import {PickableCesium3DTileset, PickableVoxelPrimitive} from 'src/layers/helpers';

interface BaseLayer {
  id: LayerId
  type: LayerType
  assetId: string
  ionToken: string
  label: string,
  isVisible: boolean
  isDisplayed: boolean
  isOpacityDisabled: boolean
  isPickable: boolean
  isCustom: boolean
}

export interface BackgroundLayer extends BaseLayer {
  type: LayerType.Background
}

export interface GeoJsonLayer extends BaseLayer {
  type: LayerType.GeoJson
  dataSource: DataSource
}

export interface TilesetLayer extends BaseLayer {
  type: LayerType.Tileset
  tileset: PickableCesium3DTileset
}

export interface VoxelLayer extends BaseLayer {
  type: LayerType.Voxel
  primitive: PickableVoxelPrimitive
}

export interface WebMapLayer extends BaseLayer {
  type: LayerType.WebMap
  imagery: ImageryLayer
}

export interface EarthquakeLayer extends BaseLayer {
  type: LayerType.Earthquake
  visualizer: EarthquakeVisualizer
}

export type Layer =
  | BackgroundLayer
  | GeoJsonLayer
  | TilesetLayer
  | VoxelLayer
  | WebMapLayer
  | EarthquakeLayer

enum LayerType {
  Background = 'Background',
  GeoJson = 'GeoJson',
  Earthquake = 'Earthquake',
  Tileset = 'Tileset',
  Voxel = 'Voxel',
  WebMap = 'WebMap',
}

export type LayerId = string;
