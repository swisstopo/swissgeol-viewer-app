import DataSource from 'cesium/Source/DataSources/DataSource';
import Primitive from 'cesium/Source/Scene/Primitive';
import Viewer from 'cesium/Source/Widgets/Viewer/Viewer';

/**
 * Base class for slicing tools.
 */
export default class SlicingToolBase {
  viewer: Viewer;
  dataSource: DataSource;

  constructor(viewer, dataSource) {
    this.viewer = viewer;
    this.dataSource = dataSource;
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
