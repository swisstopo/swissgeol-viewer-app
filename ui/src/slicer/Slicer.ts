import type { Cartesian3, Viewer } from 'cesium';
import { CustomDataSource } from 'cesium';
import { executeForAllPrimitives } from '../utils';
import SlicingBox from './SlicingBox';
import SlicingLine from './SlicingLine';
import SlicingToolBase from './SlicingToolBase';
import i18next from 'i18next';
import { CesiumDraw, DrawEndDetails } from '../draw/CesiumDraw';
import { DEFAULT_AOI_COLOR } from '../constants';
import { showSnackbarInfo } from '../notifications';
import type { GeometryTypes, NgmGeometry } from '../toolbox/interfaces';
import { getMeasurements } from '../cesiumutils';
import ToolboxStore from '../store/toolbox';
import NavToolsStore from '../store/navTools';

interface SliceOptions {
  /**
   * Slice type.
   */
  type?: 'box' | 'view-box' | 'line' | 'view-line';
  /**
   * points for line slicing. Required with 'line' type
   */
  slicePoints?: Cartesian3[];
  /**
   *
   */
  negate?: boolean;
  /**
   *  lower limit for box slicing
   */
  lowerLimit?: number;
  /**
   * box height for box slicing
   */
  height?: number;
  /**
   * box and arrows visibility
   */
  showBox?: boolean;
  /**
   * calls on slicing deactivation
   */
  deactivationCallback?: () => void;
  /**
   * calls on slicing activation
   */
  activationCallback?: () => void;
  /**
   * calls on synchronization of box planes
   */
  syncBoxPlanesCallback?: (sliceInfo) => void;
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
  constructor(viewer: Viewer) {
    this.viewer = viewer;
    /**
     * @type {SliceOptions}
     */
    this.sliceOptions = { ...DEFAULT_SLICE_OPTIONS };
    this.viewer.dataSources.add(this.slicerDataSource);
    this.slicingBox = new SlicingBox(this.viewer, this.slicerDataSource);
    this.slicingLine = new SlicingLine(this.viewer);
    this.draw = new CesiumDraw(this.viewer, {
      fillColor: DEFAULT_AOI_COLOR,
      minPointsStop: true,
    });
    this.draw.addEventListener('drawend', (evt) =>
      this.endDrawing(<DrawEndDetails>(<CustomEvent>evt).detail),
    );
    this.draw.addEventListener('drawerror', (evt) => {
      if (
        this.draw.ERROR_TYPES.needMorePoints === (<CustomEvent>evt).detail.error
      ) {
        showSnackbarInfo(i18next.t('tbx_error_need_more_points_warning'));
      }
    });

    NavToolsStore.exaggerationChanged.subscribe((exaggeration) => {
      const arrows = this.slicingBox.slicerArrows?.arrows;
      if (arrows && this.slicingBox.options?.showBox) {
        let showSnackbar = false;
        Object.values(arrows).forEach((a) => {
          if (exaggeration > 1 && a.isShowing) {
            a.show = false;
            showSnackbar = true;
          } else if (exaggeration === 1 && !a.isShowing) {
            a.show = true;
          }
        });
        if (exaggeration > 1 && showSnackbar) {
          showSnackbarInfo(i18next.t('dtd_slice_arrows_hidden'));
        }
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

      if (
        this.sliceOptions.type?.includes('view') &&
        !this.sliceOptions.slicePoints
      ) {
        this.draw!.type =
          this.sliceOptions.type === 'view-box' ? 'rectangle' : 'line';
        this.draw!.active = true;
      } else {
        this.activateSlicing();
      }
    } else {
      this.deactivateDrawing();
      this.sliceActive = false;
      if (this.sliceOptions.deactivationCallback)
        this.sliceOptions.deactivationCallback();
      this.sliceOptions = { ...DEFAULT_SLICE_OPTIONS };
      this.slicerDataSource.entities.removeAll();
      if (this.slicingTool) this.slicingTool.deactivate();

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

  get options() {
    return this.sliceOptions;
  }
  set options(options) {
    this.sliceOptions = options;
  }

  applyClippingPlanesToTileset(tileset) {
    if (tileset.readyPromise) {
      tileset.readyPromise.then((primitive) => {
        if (!primitive.clippingPlanes && this.slicingTool) {
          this.slicingTool.addClippingPlanes(primitive);
          if (
            this.sliceOptions.type === 'box' ||
            this.sliceOptions.type === 'view-box'
          )
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

  endDrawing(info: DrawEndDetails) {
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
    this.addSliceGeometry(type);
  }

  activateSlicing() {
    this.sliceActive = true;
    this.slicingTool!.activate(this.sliceOptions);
    if (this.sliceOptions.activationCallback)
      this.sliceOptions.activationCallback();
  }

  addSliceGeometry(type: GeometryTypes) {
    if (!this.sliceOptions.slicePoints) return;
    let positions = this.sliceOptions.slicePoints;
    let geomToCreate: NgmGeometry = { type: type, positions: positions };
    if (type === 'rectangle') {
      const bbox = this.slicingBox.bbox!;
      positions = [
        bbox.corners.bottomRight,
        bbox.corners.bottomLeft,
        bbox.corners.topLeft,
        bbox.corners.topRight,
      ];
      geomToCreate = {
        ...geomToCreate,
        positions: positions,
        volumeShowed: true,
        showSlicingBox: true,
        volumeHeightLimits: {
          height: this.sliceOptions.height!,
          lowerLimit: this.sliceOptions.lowerLimit!,
        },
      };
    }
    const measurements = getMeasurements(positions, type);
    const segmentsLength = measurements.segmentsLength;
    geomToCreate = {
      ...geomToCreate,
      ...measurements,
      area: measurements.area?.toFixed(3),
      perimeter: measurements.perimeter?.toFixed(3),
      sidesLength: [segmentsLength[0], segmentsLength[1]],
      show: false,
    };
    ToolboxStore.setGeometryToCreate({ geometry: geomToCreate, slice: true });
  }
}
