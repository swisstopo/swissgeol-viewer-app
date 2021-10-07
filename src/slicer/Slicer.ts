import {Viewer} from 'cesium';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
// @ts-ignore TS2691
import {executeForAllPrimitives} from '../utils.ts';
// @ts-ignore TS2691
import SlicingBox from './SlicingBox.ts';
// @ts-ignore TS2691
import SlicingLine from './SlicingLine.ts';
// @ts-ignore TS2691
import SlicingToolBase from './SlicingToolBase.ts';


interface SliceOptions {
  /**
   * Slice type.
   */
  type?: 'box'|'view-box'|'line'|'view-line',
  /**
   * points for line slicing. Required with 'line' type
   */
  slicePoints?: Cartesian3[],
  /**
   *
   */
  negate?: boolean,
  /**
   *  lower limit for box slicing
   */
  lowerLimit?: number,
  /**
   * box height for box slicing
   */
  height?: number,
  /**
   * box and arrows visibility
   */
   showBox?: boolean,
  /**
   * calls on slicing deactivation
   */
   deactivationCallback?: () => void,
  /**
   * calls on slicing activation
   */
   activationCallback?: () => void,
   /**
    * calls on synchronization of box planes
    */
   syncBoxPlanesCallback?: () => void,
}


const DEFAULT_SLICE_OPTIONS: SliceOptions = {
  type: undefined,
  slicePoints: [],
  negate: false,
};

export default class Slicer {

  viewer: Viewer;
  slicingBox: SlicingBox;
  slicingLine: SlicingLine;
  sliceOptions: SliceOptions;
  slicerDataSource: CustomDataSource;
  sliceActive: boolean;
  slicingTool: SlicingToolBase;

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
        // @ts-ignore
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
