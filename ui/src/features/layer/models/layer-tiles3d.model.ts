import { BaseLayer, LayerSource, LayerType } from 'src/features/layer';
import { Tiles3dSliceSelection } from 'src/features/layer/slice';

export interface Tiles3dLayer extends BaseLayer {
  type: LayerType.Tiles3d;

  /**
   * The layer's source, defining where the layer is loaded from.
   */
  source: LayerSource;

  /**
   * The order in which the layer's properties are sorted when displayed.
   * Keys that are left out will be sorted below any sorted ones, in default order.
   */
  orderOfProperties: string[];

  /**
   * Whether the layer is partially transparent.
   * For partially transparent tiles, fragments that are fully white are discarded.
   */
  isPartiallyTransparent: boolean;

  /**
   * Slice selection for OGC 3D seismic volumes.
   * `null` when the layer does not support slices or metadata is not loaded yet.
   */
  sliceSelection: Tiles3dSliceSelection | null;
}
