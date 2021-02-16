import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {executeForAllPrimitives} from '../utils';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicingBBox from './SlicingBBox';
import SlicingBox from './SlicingBox';
import SlicingLine from './SlicingLine';


const DEFAULT_SLICE_OPTIONS = {
  box: false,
  slicePoints: [],
  negate: false,
  deactivationCallback: () => {
  }
};

export default class Slicer {
  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   */
  constructor(viewer) {

    this.viewer = viewer;
    this.slicerDataSource = new CustomDataSource('slicer');
    this.viewer.dataSources.add(this.slicerDataSource);
    this.sliceActive = false;
    this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};
    this.slicingBbox = new SlicingBBox(this.viewer, 1 / 3); // todo
    this.slicingBox = new SlicingBox(this.viewer, this.slicingBbox, this.slicerDataSource);
    this.slicingLine = new SlicingLine(this.viewer, this.sliceOptions);
    this.slicingTool = null;

    this.julianDate = new JulianDate();
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      this.sliceActive = true;
      this.slicingTool = this.sliceOptions.box ? this.slicingBox : this.slicingLine;
      this.slicingTool.options = this.sliceOptions; // todo improve
      this.slicingTool.activate();
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
