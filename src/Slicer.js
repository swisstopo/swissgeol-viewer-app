import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import Plane from 'cesium/Source/Core/Plane';
import {pickCenter} from './utils.js';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Rectangle from 'cesium/Source/Core/Rectangle';
import Entity from 'cesium/Source/DataSources/Entity';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Color from 'cesium/Source/Core/Color';
import ShadowMode from 'cesium/Source/Scene/ShadowMode';
import {lv95ToDegrees, radiansToLv95} from './projection';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import ColorBlendMode from 'cesium/Source/Scene/ColorBlendMode';
import {applyLimits, executeForAllPrimitives, pickCenterOnEllipsoid, planeFromTwoPoints} from './utils';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';
import Transforms from 'cesium/Source/Core/Transforms';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import {SLICE_ARROW_ICONS} from './constants';
import JulianDate from 'cesium/Source/Core/JulianDate';


const DEFAULT_BOX_HEIGHT = 15000;
const PLANE_COLOR = Color.WHITE;
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
    this.slicePoints = [];
    this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};

    this.planeEntity = null;
    this.planesCenter = null;
    this.planesCenterH = null;
    this.planesCenterV = null;
    this.planesHorizontalLength = 0;
    this.planesVerticalLength = 0;
    this.boxHeight = DEFAULT_BOX_HEIGHT;

    this.eventHandler = null;
    this.selectedPlane = null;
    this.targetYSouthwest = 0.0;
    this.targetXSouthwest = 0.0;
    this.targetYNortheast = 0.0;
    this.targetXNortheast = 0.0;

    this.offsets = {};
    this.julianDate = new JulianDate();
  }

  set active(value) {
    const globe = this.viewer.scene.globe;
    if (value) {
      this.sliceActive = true;
      if (this.sliceOptions.box) {
        this.activateBoxSlicing();
      } else {
        this.activateLineSlicing();
      }
    } else {
      this.sliceActive = false;
      this.sliceOptions.deactivationCallback();
      this.sliceOptions = {...DEFAULT_SLICE_OPTIONS};
      this.slicerDataSource.entities.removeAll();
      this.offsets = {};
      this.planeHorizontalDown = null;
      this.planeHorizontalUp = null;
      this.planeVerticalLeft = null;
      this.planeVerticalRight = null;
      this.plane = null;

      if (this.eventHandler) {
        this.eventHandler.destroy();
        this.eventHandler = null;
        this.onTickRemove();
      }

      if (globe.clippingPlanes) {
        globe.clippingPlanes.enabled = false;
        globe.clippingPlanes = undefined;
      }

      this.targetYSouthwest = 0.0;
      this.targetXSouthwest = 0.0;
      this.targetYNortheast = 0.0;
      this.targetXNortheast = 0.0;
      this.targetDown = 0.0;
      this.targetUp = 0.0;


      executeForAllPrimitives(this.viewer, (primitive) => {
        if (!primitive.clippingPlanes) return;
        primitive.clippingPlanes.enabled = false;
        primitive.clippingPlanes = undefined;
      });
    }
    this.viewer.scene.requestRender();
  }

  activateBoxSlicing() {
    // initialize plane based on the camera's position
    this.setInitialTargetsForBox();

    this.planeHorizontalDown = new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), 0.0);
    this.planeHorizontalUp = new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), 0.0);
    this.planeVerticalLeft = new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), 0.0);
    this.planeVerticalRight = new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), 0.0);
    this.planeDown = new ClippingPlane(new Cartesian3(0.0, 0, 1.0), 0.0);
    this.planeUp = new ClippingPlane(new Cartesian3(0.0, 0, -1.0), 0.0);
    const planeStyle = {
      material: Color.WHITE.withAlpha(0.1),
      outline: true,
      outlineColor: PLANE_COLOR,
    };

    const horizontalEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('horizontal'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeHorizontalDown, 'horizontal'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.planesHorizontalLength, this.boxHeight), false),
        ...planeStyle
      }
    };

    const verticalEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('vertical'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeVerticalLeft, 'vertical'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.planesVerticalLength, this.boxHeight), false),
        ...planeStyle
      }
    };

    const zEntityTemplate = {
      position: new CallbackProperty(this.centerUpdateFunction('altitude'), false),
      plane: {
        plane: new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeDown, 'altitude-down'), false),
        dimensions: new CallbackProperty(() => new Cartesian2(this.planesHorizontalLength, this.planesVerticalLength), false),
        ...planeStyle
      }
    };
    this.planeEntitDown = new Entity(zEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntitDown);

    zEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeUp, 'altitude-up'), false);
    this.planeEntitUp = new Entity(zEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntitUp);

    this.planeEntityHorizontal = new Entity(horizontalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityHorizontal);

    horizontalEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeHorizontalUp, 'horizontal-northeast'), false);
    this.planeEntityHorizontalUp = new Entity(horizontalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityHorizontalUp);

    this.planeEntityVertical = new Entity(verticalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityVertical);

    verticalEntityTemplate.plane.plane =
      new CallbackProperty(this.createBoxPlaneUpdateFunction(this.planeVerticalRight, 'vertical-northeast'), false);
    this.planeEntityVerticalRight = new Entity(verticalEntityTemplate);
    this.slicerDataSource.entities.add(this.planeEntityVerticalRight);

    this.createMoveArrows();

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes(this.planeEntityHorizontal.computeModelMatrix(this.julianDate));

    executeForAllPrimitives(this.viewer, (primitive) => this.addBoxClippingPlanes(primitive));

    if (!this.eventHandler) {
      this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
      this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
      const syncPlanes = this.movePlane.bind(this);
      this.onTickRemove = this.viewer.scene.postRender.addEventListener(syncPlanes);
    }
  }

  activateLineSlicing() {
    const slicePoints = this.sliceOptions.slicePoints;
    if (!slicePoints || slicePoints.length !== 2) {
      const center = pickCenter(this.viewer.scene);
      const hpr = new HeadingPitchRoll(this.viewer.scene.camera.heading, 0.0, 0.0);
      this.plane = Plane.transform(Plane.ORIGIN_ZX_PLANE, Transforms.headingPitchRollToFixedFrame(center, hpr));
    } else {
      this.plane = planeFromTwoPoints(slicePoints[0], slicePoints[1], this.sliceOptions.negate);
    }

    this.viewer.scene.globe.clippingPlanes = this.createClippingPlanes();
    executeForAllPrimitives(this.viewer, (primitive) => this.addLineClippingPlane(primitive));
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

  movePlane() {
    this.updateBoxClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) =>
      this.updateBoxClippingPlanes(primitive.clippingPlanes, this.offsets[primitive.url]));
  }

  /**
   * @param {Matrix4=} modelMatrix
   */
  createClippingPlanes(modelMatrix) {
    let planes = [this.plane];
    if (this.sliceOptions.box) {
      planes = [
        this.planeHorizontalDown, this.planeVerticalLeft, this.planeHorizontalUp, this.planeVerticalRight,
        this.planeDown, this.planeUp
      ];
    }
    return new ClippingPlaneCollection({
      modelMatrix: modelMatrix,
      planes: planes,
      edgeWidth: 1.0,
      unionClippingRegions: true
    });
  }

  updateBoxClippingPlanes(clippingPlanes, offset) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    if (offset) {
      const planeHorizontalDown = Plane.clone(this.planeHorizontalDown);
      planeHorizontalDown.distance = planeHorizontalDown.distance - offset.offsetX;

      const planeHorizontalUp = Plane.clone(this.planeHorizontalUp);
      planeHorizontalUp.distance = planeHorizontalUp.distance + offset.offsetX;

      const planeVerticalLeft = Plane.clone(this.planeVerticalLeft);
      planeVerticalLeft.distance = planeVerticalLeft.distance - offset.offsetY;

      const planeVerticalRight = Plane.clone(this.planeVerticalRight);
      planeVerticalRight.distance = planeVerticalRight.distance + offset.offsetY;

      const planeDown = Plane.clone(this.planeDown);
      planeDown.distance = planeDown.distance + offset.offsetZ;

      const planeUp = Plane.clone(this.planeUp);
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

  onLeftDown(event) {
    const pickedObject = this.viewer.scene.pick(event.position);
    const isModelPicked = pickedObject && pickedObject.id && pickedObject.id.model;
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.type) {
      this.selectedPlane = pickedObject.id;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp() {
    if (this.selectedPlane) {
      this.selectedPlane = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
    this.unhighlightArrow();
  }

  onMouseMove(movement) {
    if (this.selectedPlane) {
      const scene = this.viewer.scene;
      const type = this.selectedPlane.properties.type.getValue();
      const centerHCartographic = Cartographic.fromCartesian(this.planesCenterH);
      const centerVCartographic = Cartographic.fromCartesian(this.planesCenterV);

      // depends on selected plane type calculates plane distance
      // also updates plane entities center and dimensions (depends on type) to show planes as a box
      if (type.includes('altitude')) {
        const entity = type.includes('down') ? this.planeEntitDown : this.planeEntitUp;
        const boundingSphere = new BoundingSphere(entity.position.getValue(this.julianDate));
        const pixelSize = scene.camera.getPixelSize(boundingSphere, scene.drawingBufferWidth, scene.drawingBufferHeight);
        const target = (movement.endPosition.y - movement.startPosition.y) * pixelSize;
        type.includes('down') ? this.targetDown += target : this.targetUp -= target;
        this.boxHeight = this.targetDown + this.targetUp;
        const height = -this.targetDown + this.boxHeight / 2;
        centerHCartographic.height = centerVCartographic.height = height;
        this.planesCenterH = Cartographic.toCartesian(centerHCartographic);
        this.planesCenterV = Cartographic.toCartesian(centerVCartographic);
        return;
      }

      const intersectionStart = scene.camera.pickEllipsoid(movement.startPosition);
      const intersectionEnd = scene.camera.pickEllipsoid(movement.endPosition);
      if (!intersectionStart || !intersectionEnd) return;
      let distance = Cartesian3.distance(intersectionStart, intersectionEnd);
      const diff = Cartesian3.subtract(intersectionEnd, intersectionStart, new Cartesian3());
      const height = -this.targetDown + this.boxHeight / 2;
      if (type.includes('horizontal')) {
        const lv95Center = radiansToLv95([centerVCartographic.longitude, centerVCartographic.latitude]);
        if (type.includes('northeast')) {
          const negative = (diff.x + diff.y) > 0 ? -1 : 1;
          distance = distance * negative;
          lv95Center[1] = lv95Center[1] + distance / 2;
          this.targetYNortheast += distance;
          this.planesVerticalLength = this.planeHorizontalDown.distance + this.targetYNortheast;
        } else {
          const negative = (diff.x + diff.y) > 0 ? 1 : -1;
          distance = distance * negative;
          lv95Center[1] = lv95Center[1] - distance / 2;
          this.targetYSouthwest += distance;
          this.planesVerticalLength = this.planeHorizontalUp.distance + this.targetYSouthwest;
        }
        const degCenter = lv95ToDegrees(lv95Center);
        Cartographic.fromDegrees(degCenter[0], degCenter[1], height, centerVCartographic);
        this.planesCenterV = Cartographic.toCartesian(centerVCartographic);
      } else if (type.includes('vertical')) {
        const lv95Center = radiansToLv95([centerHCartographic.longitude, centerHCartographic.latitude]);
        if (type.includes('northeast')) {
          const negative = (diff.x + diff.y) < 0 ? -1 : 1;
          distance = distance * negative;
          lv95Center[0] = lv95Center[0] + distance / 2;
          this.targetXNortheast += distance;
          this.planesHorizontalLength = this.planeVerticalLeft.distance + this.targetXNortheast;
        } else {
          const negative = (diff.x + diff.y) < 0 ? 1 : -1;
          distance = distance * negative;
          lv95Center[0] = lv95Center[0] - distance / 2;
          this.targetXSouthwest += distance;
          this.planesHorizontalLength = this.planeVerticalRight.distance + this.targetXSouthwest;
        }
        const degCenter = lv95ToDegrees(lv95Center);
        Cartographic.fromDegrees(degCenter[0], degCenter[1], height, centerHCartographic);
        this.planesCenterH = Cartographic.toCartesian(centerHCartographic);
      }
    } else {
      this.highlightArrow(movement.endPosition);
    }
  }

  /**
   * @param {Plane} plane
   * @param {string}type
   */
  createBoxPlaneUpdateFunction(plane, type) {
    return () => {
      if (type.includes('altitude')) {
        plane.distance = type.includes('down') ? this.targetDown : this.targetUp;
      } else if (type.includes('horizontal')) {
        plane.distance = type.includes('northeast') ? this.targetYNortheast : this.targetYSouthwest;
      } else if (type.includes('vertical')) {
        plane.distance = type.includes('northeast') ? this.targetXNortheast : this.targetXSouthwest;
      }
      return plane;
    };
  }

  /**
   *
   * @param {Cartographic} viewCenter
   */
  setInitialTargetsForBox() {
    const globe = this.viewer.scene.globe;
    this.planesCenter = pickCenter(this.viewer.scene);
    let planesCenter = Cartographic.fromCartesian(this.planesCenter);
    planesCenter.height = 0;
    // check is slicing center placed on map otherwise use map center
    if (!Rectangle.contains(globe.cartographicLimitRectangle, planesCenter)) {
      planesCenter = Rectangle.center(globe.cartographicLimitRectangle);
    }

    let viewRect = this.viewer.scene.camera.computeViewRectangle();
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    if (viewRect.width > mapRect.width || viewRect.height > mapRect.height) {
      viewRect = mapRect;
    }
    // get extreme points of the map
    const mapRectNortheast = Rectangle.northeast(mapRect);
    // calculate slicing rect sizes (1/3 of view)
    const sliceRectWidth = 1 / 3 * viewRect.width;
    const sliceRectHeight = 1 / 3 * viewRect.height;
    let lon = planesCenter.longitude + sliceRectWidth;
    let lat = planesCenter.latitude + sliceRectHeight;
    if (!Rectangle.contains(globe.cartographicLimitRectangle, Cartographic.fromRadians(lon, lat))) {
      lon = mapRectNortheast.longitude;
      lat = mapRectNortheast.latitude;
    }
    // moves the center of slicing. Left down corner should be placed in the view center
    planesCenter.longitude = sliceRectWidth / 2 + planesCenter.longitude;
    planesCenter.latitude = sliceRectHeight / 2 + planesCenter.latitude;
    // converts coordinates to lv95 to calculate initial planes distance in meters
    const lv95SecondPosition = radiansToLv95([lon, lat]);
    const lv95Center = radiansToLv95([planesCenter.longitude, planesCenter.latitude]);

    // calculates initial planes distance in meters
    const xDiffNortheast = lv95SecondPosition[0] - lv95Center[0];
    const xDiffSouthwest = xDiffNortheast;
    const yDiffNortheast = lv95SecondPosition[1] - lv95Center[1];
    const yDiffSouthwest = yDiffNortheast;
    this.planesHorizontalLength = xDiffNortheast + xDiffSouthwest;
    this.planesVerticalLength = yDiffNortheast + yDiffSouthwest;
    this.boxHeight = DEFAULT_BOX_HEIGHT;

    this.targetYNortheast = yDiffNortheast;
    this.targetXNortheast = xDiffNortheast;
    this.targetYSouthwest = yDiffSouthwest;
    this.targetXSouthwest = xDiffSouthwest;
    this.targetDown = planesCenter.height + this.boxHeight / 2;
    this.targetUp = this.targetDown;
    this.planesCenter = Cartographic.toCartesian(planesCenter);
    this.planesCenterH = this.planesCenter;
    this.planesCenterV = this.planesCenter;
  }

  getTilesetOffset(primitive) {
    const tileCenter = Cartographic.fromCartesian(primitive.boundingSphere.center);
    const cartCenter = Cartographic.fromCartesian(this.planesCenter);
    const lv95Center = radiansToLv95([cartCenter.longitude, cartCenter.latitude]);
    const lv95Tile = radiansToLv95([tileCenter.longitude, tileCenter.latitude]);
    const offsetX = lv95Center[1] - lv95Tile[1];
    const offsetY = lv95Center[0] - lv95Tile[0];

    const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
    const transformCartographic = Cartographic.fromCartesian(transformCenter);
    const boundingSphereCartographic = Cartographic.fromCartesian(primitive.boundingSphere.center);
    let offsetZ = boundingSphereCartographic.height;
    if (transformCartographic) {
      offsetZ = transformCartographic.height;
    }
    return {
      offsetX: offsetX,
      offsetY: offsetY,
      offsetZ: offsetZ,
    };
  }

  applyClippingPlanesToTileset(tileset) {
    if (tileset.readyPromise) {
      tileset.readyPromise.then(primitive => {
        if (!primitive.clippingPlanes) {
          this.sliceOptions.box ? this.addBoxClippingPlanes(primitive) : this.addLineClippingPlane(primitive);
        }
      });
    }
  }

  centerUpdateFunction(type) {
    return () => {
      if (type === 'horizontal')
        return this.planesCenterH;
      else if (type === 'vertical')
        return this.planesCenterV;
      else {
        const centerHCart = Cartographic.fromCartesian(this.planesCenterH);
        const centerVCart = Cartographic.fromCartesian(this.planesCenterV);
        const center = new Cartographic(centerHCart.longitude, centerVCart.latitude);
        return Cartographic.toCartesian(center);
      }
    };
  }

  arrowCenterUpdateFunction(type) {
    return () => {
      const cartCenterH = Cartographic.fromCartesian(this.planesCenterH);
      const cartCenterV = Cartographic.fromCartesian(this.planesCenterV);
      const lv95Center = radiansToLv95([cartCenterH.longitude, cartCenterV.latitude]);

      let lon, lat, height;
      const halfWidth = this.planesHorizontalLength / 2;
      const halfHeight = this.planesVerticalLength / 2;
      if (type.includes('altitude')) {
        lon = lv95Center[0] - halfWidth;
        lat = lv95Center[1] - halfHeight;
        type.includes('down') ? height = -this.targetDown : height = this.targetUp;
      } else {
        let viewCenterLv95 = lv95Center;
        const viewCenter = pickCenterOnEllipsoid(this.viewer.scene);
        if (viewCenter) {
          const viewCenterCart = Cartographic.fromCartesian(viewCenter);
          viewCenterLv95 = radiansToLv95([viewCenterCart.longitude, viewCenterCart.latitude]);
        }
        height = this.viewer.scene.cameraUnderground ? -this.targetDown : this.targetUp;
        const negate = type.includes('northeast') ? 1 : -1;
        const offset = 5000;
        if (type.includes('horizontal')) {
          const horizontalMin = lv95Center[0] - halfWidth + offset;
          const horizontalMax = lv95Center[0] + halfWidth - offset;
          lon = applyLimits(viewCenterLv95[0], horizontalMin, horizontalMax);
          lat = lv95Center[1] + halfHeight * negate;
        } else if (type.includes('vertical')) {
          const verticalMin = lv95Center[1] - halfHeight + offset;
          const verticalMax = lv95Center[1] + halfHeight - offset;
          lat = applyLimits(viewCenterLv95[1], verticalMin, verticalMax);
          lon = lv95Center[0] + halfWidth * negate;
        }
      }
      const degCenter = lv95ToDegrees([lon, lat]);
      return Cartesian3.fromDegrees(degCenter[0], degCenter[1], height);
    };
  }

  createMoveArrows() {
    const navigationIconTemplate = {
      model: {
        minimumPixelSize: 64,
        scale: 3000,
        maximumScale: 10000,
        shadowMode: ShadowMode.DISABLED,
        colorBlendMode: ColorBlendMode.MIX,
        color: PLANE_COLOR
      },
      properties: {}
    };
    SLICE_ARROW_ICONS.forEach(icon => {
      const navigationIcon = navigationIconTemplate;
      navigationIcon.position = new CallbackProperty(this.arrowCenterUpdateFunction(icon.type), false);
      navigationIcon.properties.type = icon.type;
      navigationIcon.model.uri = icon.uri;
      this.slicerDataSource.entities.add(new Entity(navigationIcon));
    });
  }

  highlightArrow(position) {
    const pickedObject = this.viewer.scene.pick(position);
    const isModelPicked = pickedObject && pickedObject.id && pickedObject.id.model;
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.type) {
      this.highlightedArrow = pickedObject.id;
      document.querySelector('.cesium-widget').style.cursor = 'pointer';
      this.highlightedArrow.model.color = Color.YELLOW;
    } else {
      this.unhighlightArrow();
    }
  }

  unhighlightArrow() {
    if (this.highlightedArrow) {
      this.highlightedArrow.model.color = PLANE_COLOR;
      this.highlightedArrow = undefined;
      document.querySelector('.cesium-widget').style.cursor = '';
    }
  }

  addLineClippingPlane(primitive) {
    if (!primitive.root || !primitive.root.computedTransform) return;
    const modelMatrix = Matrix4.inverse(primitive.root.computedTransform, new Matrix4());
    primitive.clippingPlanes = this.createClippingPlanes(modelMatrix);
  }

  addBoxClippingPlanes(primitive) {
    if (!primitive.root || !primitive.boundingSphere) return;
    this.offsets[primitive.url] = this.getTilesetOffset(primitive);
    primitive.clippingPlanes = this.createClippingPlanes();
  }
}
