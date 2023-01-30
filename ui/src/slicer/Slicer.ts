import type {Cartesian3, Viewer} from 'cesium';
import {CustomDataSource} from 'cesium';
import {executeForAllPrimitives} from '../utils';
import SlicingBox from './SlicingBox';
import SlicingLine from './SlicingLine';
import SlicingToolBase from './SlicingToolBase';
import i18next from 'i18next';
import {CesiumDraw} from '../draw/CesiumDraw';
import {DEFAULT_AOI_COLOR} from '../constants';
import {showSnackbarInfo} from '../notifications';


interface SliceOptions {
  /**
   * Slice type.
   */
  type?: 'box' | 'view-box' | 'line' | 'view-line',
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
  syncBoxPlanesCallback?: (sliceInfo) => void,
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
  slicerDataSource: CustomDataSource = new CustomDataSource('slicer');
  sliceActive = false;
  slicingTool: SlicingToolBase | null = null;
  draw: CesiumDraw;

  /**
   * @param {Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    /**
     * @type {SliceOptions}
     */
    this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};
    this.viewer.dataSources.add(this.slicerDataSource);
    this.slicingBox = new SlicingBox(this.viewer, this.slicerDataSource);
    this.slicingLine = new SlicingLine(this.viewer);
    this.draw = new CesiumDraw(this.viewer, 'line', {fillColor: DEFAULT_AOI_COLOR, minPointsStop: true});
    this.draw.addEventListener('drawend', (evt) => this.endDrawing((<CustomEvent>evt).detail));
    this.draw.addEventListener('drawerror', evt => {
      if (this.draw.ERROR_TYPES.needMorePoints === (<CustomEvent>evt).detail.error) {
        showSnackbarInfo(i18next.t('tbx_error_need_more_points_warning'));
      }
    });
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

      if (this.sliceOptions.type?.includes('view') && !this.sliceOptions.slicePoints) {
        this.draw!.type = this.sliceOptions.type === 'view-box' ? 'rectangle' : 'line';
        this.draw!.active = true;
      } else {
        this.activateSlicing();
      }
    } else {
      this.deactivateDrawing();
      this.sliceActive = false;
      if (this.sliceOptions.deactivationCallback)
        this.sliceOptions.deactivationCallback();
      this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};
      this.slicerDataSource.entities.removeAll();
      if (this.slicingTool)
        this.slicingTool.deactivate();

      if (globe.clippingPlanes) {
        globe.clippingPlanes.enabled = false;
        globe.clippingPlanes.removeAll();
      }


      executeForAllPrimitives(this.viewer, (primitive) => {
        if (!primitive.clippingPlanes) return;
        primitive.clippingPlanes.enabled = false;
        primitive.clippingPlanes.removeAll();
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
        if (!primitive.clippingPlanes && this.slicingTool) {
          this.slicingTool.addClippingPlanes(primitive);
          if (this.sliceOptions.type === 'box' || this.sliceOptions.type === 'view-box')
            this.slicingBox.syncPlanes();
        }
      });
    }
  }

  toggleBoxVisibility(show) {
    if (!this.slicingBox) return;
    this.slicingBox.toggleBoxVisibility(show);
  }

  deactivateDrawing() {
    if (!this.draw.active) return;
    this.draw.active = false;
    this.draw.clear();
  }

  endDrawing(info) {
    this.deactivateDrawing();
    const positions = info.positions;
    const type = info.type;

    if (type === 'line') {
      this.sliceOptions = {
        ...this.sliceOptions,
        slicePoints: [positions[0], positions[positions.length - 1]],
      };
    } else {
      this.sliceOptions = {
        ...this.sliceOptions,
        slicePoints: positions,
      };
    }

    this.activateSlicing();
  }

  activateSlicing() {
    this.sliceActive = true;
    this.slicingTool!.activate(this.sliceOptions);
    if (this.sliceOptions.activationCallback)
      this.sliceOptions.activationCallback();
  }


}
