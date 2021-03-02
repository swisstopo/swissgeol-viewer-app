import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {executeForAllPrimitives} from '../utils';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicingBox from './SlicingBox';
import SlicingLine from './SlicingLine';
import SlicingToolBase from './SlicingToolBase';

/**
 * @typedef {object} SliceOptions
 * @property {'view-box'|'line'|'view-line'} type - slice type
 * @property [{Cartesian3[]} slicePoints - points for line slicing. Required with 'line' type]
 * @property [{boolean} negate - slice direction for line slicing]
 * @property [{function} deactivationCallback - calls on slicing deactivation]
 */


const DEFAULT_SLICE_OPTIONS = {
  type: undefined,
  slicePoints: [],
  negate: false,
  deactivationCallback: () => {
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

    this.julianDate = new JulianDate();
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      this.slicingTool = this.getSlicingTool();
      if (!(this.slicingTool instanceof SlicingToolBase))
        throw new Error('Slicing tools should extend SlicingToolBase');

      this.sliceActive = true;
      this.slicingTool.activate(this.sliceOptions);
    } else {
      this.sliceActive = false;
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

  get active() {
    return this.sliceActive;
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


}
