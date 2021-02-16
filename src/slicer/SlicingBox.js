import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {executeForAllPrimitives} from '../utils';
import JulianDate from 'cesium/Source/Core/JulianDate';
import SlicerArrows from './SlicerArrows';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import {getBboxFromMapRatio, getOffsetForPrimitive} from './helper';
import {Plane} from 'cesium';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import {SLICING_GEOMETRY_COLOR} from '../constants';

export default class SlicingBox {
  constructor(viewer, dataSource) {
    this.viewer = viewer;
    this.dataSource = dataSource;

    this.offsets = {};
    this.planeHorizontalDown = null;
    this.planeHorizontalUp = null;
    this.planeVerticalLeft = null;
    this.planeVerticalRight = null;
    this.bbox = null;
    this.julianDate = new JulianDate();

    this.slicerArrows = new SlicerArrows(this.viewer, this.dataSource, this);
  }

  activate() {
    this.bbox = getBboxFromMapRatio(this.viewer, 1 / 3);
    this.planeHorizontalDown = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 1.0, 0.0));
    this.planeHorizontalUp = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, -1.0, 0.0));
    this.planeVerticalLeft = Plane.fromPointNormal(this.bbox.center, new Cartesian3(1.0, 0.0, 0.0));
    this.planeVerticalRight = Plane.fromPointNormal(this.bbox.center, new Cartesian3(-1.0, 0.0, 0.0));
    this.planeDown = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 0, 1.0));
    this.planeUp = Plane.fromPointNormal(this.bbox.center, new Cartesian3(0.0, 0, -1.0));
    this.updatePlanesDistance();
    this.slicerArrows.show(this.bbox);

    this.slicingBoxEntity = this.dataSource.entities.add({ // todo fix move across opposite side
      position: new CallbackProperty(() => this.slicerArrows.center, false),
      box: {
        dimensions: new CallbackProperty(this.dimensionsUpdateFunction(), false),
        material: SLICING_GEOMETRY_COLOR.withAlpha(0.1),
        outline: true,
        outlineColor: SLICING_GEOMETRY_COLOR,
      },
    });

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes(this.slicingBoxEntity.computeModelMatrix(this.julianDate));

    executeForAllPrimitives(this.viewer, (primitive) => this.addClippingPlanes(primitive));
    if (!this.onTickRemove) {
      const syncPlanes = this.movePlane.bind(this);
      this.onTickRemove = this.viewer.scene.postRender.addEventListener(syncPlanes);
    }
  }

  deactivate() {
    this.offsets = {};
    this.planeHorizontalDown = null;
    this.planeHorizontalUp = null;
    this.planeVerticalLeft = null;
    this.planeVerticalRight = null;
    if (this.onTickRemove) {
      this.onTickRemove();
      this.onTickRemove = null;
    }
    this.slicerArrows.hide();
  }

  createClippingPlanes(modelMatrix) {
    return new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: [
        this.planeHorizontalDown, this.planeVerticalLeft, this.planeHorizontalUp, this.planeVerticalRight,
        this.planeDown, this.planeUp
      ],
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
  }

  addClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.url] = getOffsetForPrimitive(primitive, this.bbox.center);
    primitive.clippingPlanes = this.createClippingPlanes();
  }

  updateBoxClippingPlanes(clippingPlanes, offset) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    if (offset) {
      const planeHorizontalDown = ClippingPlane.clone(this.planeHorizontalDown);
      planeHorizontalDown.distance = planeHorizontalDown.distance - offset.offsetX;

      const planeHorizontalUp = ClippingPlane.clone(this.planeHorizontalUp);
      planeHorizontalUp.distance = planeHorizontalUp.distance + offset.offsetX;

      const planeVerticalLeft = ClippingPlane.clone(this.planeVerticalLeft);
      planeVerticalLeft.distance = planeVerticalLeft.distance - offset.offsetY;

      const planeVerticalRight = ClippingPlane.clone(this.planeVerticalRight);
      planeVerticalRight.distance = planeVerticalRight.distance + offset.offsetY;

      const planeDown = ClippingPlane.clone(this.planeDown);
      planeDown.distance = planeDown.distance + offset.offsetZ;

      const planeUp = ClippingPlane.clone(this.planeUp);
      planeUp.distance = planeUp.distance - offset.offsetZ;

      clippingPlanes.add(planeHorizontalDown);
      clippingPlanes.add(planeHorizontalUp);
      clippingPlanes.add(planeVerticalLeft);
      clippingPlanes.add(planeVerticalRight);
      clippingPlanes.add(planeDown);
      clippingPlanes.add(planeUp);
    } else {
      clippingPlanes.add(this.planeHorizontalDown);
      clippingPlanes.add(this.planeVerticalLeft);
      clippingPlanes.add(this.planeHorizontalUp);
      clippingPlanes.add(this.planeVerticalRight);
      clippingPlanes.add(this.planeDown);
      clippingPlanes.add(this.planeUp);
    }
  }

  updatePlanesDistance() {
    this.planeHorizontalDown.distance = this.bbox.width / 2;
    this.planeHorizontalUp.distance = this.bbox.width / 2;
    this.planeVerticalLeft.distance = this.bbox.length / 2;
    this.planeVerticalRight.distance = this.bbox.length / 2;
    this.planeDown.distance = this.bbox.height / 2;
    this.planeUp.distance = this.bbox.height / 2;
    this.viewer.scene.requestRender();
  }

  dimensionsUpdateFunction() {
    return () => {
      return new Cartesian3(this.bbox.length, this.bbox.width, this.bbox.height);
    };
  }

  movePlane() {
    this.updateBoxClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) =>
      this.updateBoxClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url]));
  }
}
