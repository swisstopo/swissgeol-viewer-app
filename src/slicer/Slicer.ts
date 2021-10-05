import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {executeForAllPrimitives} from '../utils.ts';
import SlicingBox from './SlicingBox.ts';
import SlicingLine from './SlicingLine.ts';
import SlicingToolBase from './SlicingToolBase.ts';

/**
 * @typedef {object} BoxSliceInfo
 * @property {'box'|'view-box'} type - slice type
 * @property {Cartesian3[]} slicePoints - box corner positions
 * @property {Number} lowerLimit - lower limit of the box
 * @property {Number} height - height of the box
 */

/**
 * @callback SyncBoxPlanesCallback
 * @param {BoxSliceInfo} sliceInfo
 */

/**
 * @typedef {object} SliceOptions
 * @property {'box'|'view-box'|'line'|'view-line'} type - slice type
 * @property [{Cartesian3[]} slicePoints - points for line slicing. Required with 'line' type]
 * @property [{boolean} negate - slice direction for line slicing]
 * @property [{number} lowerLimit - lower limit for box slicing]
 * @property [{number} height - box height for box slicing]
 * @property [{boolean} showBox - box and arrows visibility]
 * @property [{function} deactivationCallback - calls on slicing deactivation]
 * @property [{function} activationCallback - calls on slicing activation]
 * @property [{SyncBoxPlanesCallback} syncBoxPlanesCallback - calls on synchronization of box planes]
 */


const DEFAULT_SLICE_OPTIONS = {
  type: undefined,
  slicePoints: [],
  negate: false,
  activationCallback: () => {
  },
  deactivationCallback: () => {
  },
  syncBoxPlanesCallback: () => {
  }
};

export default class Slicer {
  /**
   * @param {Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    /**
     * @type {SliceOptions}
     */
    this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};

    this.slicerDataSource = new CustomDataSource('slicer');
    this.viewer.dataSources.add(this.slicerDataSource);
    this.sliceActive = false;
    this.slicingBox = new SlicingBox(this.viewer, this.slicerDataSource);
    this.slicingLine = new SlicingLine(this.viewer);
    this.slicingTool = null;
  }

  get active() {
    return this.sliceActive;
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      this.slicingTool = this.getSlicingTool();
      if (!(this.slicingTool instanceof SlicingToolBase))
        throw new Error('Slicing tools should extend SlicingToolBase');

      this.sliceActive = true;
      this.slicingTool.activate(this.sliceOptions);
      if (this.sliceOptions.activationCallback)
        this.sliceOptions.activationCallback();
    } else {
      this.sliceActive = false;
      if (this.sliceOptions.deactivationCallback)
        this.sliceOptions.deactivationCallback();
      this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};
      this.slicerDataSource.entities.removeAll();
      if (this.slicingTool)
        this.slicingTool.deactivate();

      if (globe.clippingPlanes) {
        globe.clippingPlanes.enabled = false;
        globe.clippingPlanes = undefined;
      }


      executeForAllPrimitives(this.viewer, (primitive) => {
        if (!primitive.clippingPlanes) return;
        primitive.clippingPlanes.enabled = false;
        primitive.clippingPlanes = undefined;
      });
    }
    this.viewer.scene.requestRender();
  }

  getSlicingTool() {
    switch (this.sliceOptions.type) {
      case 'view-box':
      case 'box':
        return this.slicingBox;
      case 'view-line':
      case 'line':
        return this.slicingLine;
      default:
        throw new Error('Incorrect slicing type');
    }
  }

  set options(options) {
    this.sliceOptions = options;
  }

  get options() {
    return this.sliceOptions;
  }


  applyClippingPlanesToTileset(tileset) {
    if (tileset.readyPromise) {
      tileset.readyPromise.then(primitive => {
        if (!primitive.clippingPlanes) {
          this.slicingTool.addClippingPlanes(primitive);
        }
      });
    }
  }

  toggleBoxVisibility(show) {
    if (!this.slicingBox) return;
    this.slicingBox.toggleBoxVisibility(show);
  }


}
