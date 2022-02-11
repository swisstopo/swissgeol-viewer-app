import type Primitive from 'cesium/Source/Scene/Primitive';
import type Viewer from 'cesium/Source/Widgets/Viewer/Viewer';

/**
 * Base class for slicing tools.
 */
export default class SlicingToolBase {
  viewer: Viewer;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  activate(_options) {
    throw new Error('This method is required for slicing tools.');
  }

  deactivate() {
    throw new Error('This method is required for slicing tools.');
  }

  addClippingPlanes(_primitive: Primitive) {
    throw new Error('This method is required for slicing tools.');
  }
}
