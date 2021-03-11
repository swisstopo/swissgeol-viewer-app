/**
 * Interface for slicing tools.
 */
export default class SlicingToolBase {
  constructor(viewer, dataSource) {
    this.viewer = viewer;
    this.dataSource = dataSource;
  }

  activate() {
    throw new Error('This method is required for slicing tools.');
  }

  deactivate() {
    throw new Error('This method is required for slicing tools.');
  }

  addClippingPlanes() {
    throw new Error('This method is required for slicing tools.');
  }
}
