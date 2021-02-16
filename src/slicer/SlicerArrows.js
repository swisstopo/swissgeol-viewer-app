import Cartographic from 'cesium/Source/Core/Cartographic';
import {lv95ToDegrees, radiansToLv95} from '../projection';
import {pickCenterOnEllipsoid} from '../cesiumutils';
import CesiumMath from 'cesium/Source/Core/Math';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import ShadowMode from 'cesium/Source/Scene/ShadowMode';
import ColorBlendMode from 'cesium/Source/Scene/ColorBlendMode';
import {SLICE_ARROW_ICONS, SLICING_GEOMETRY_COLOR} from '../constants';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Entity from 'cesium/Source/DataSources/Entity';
import Color from 'cesium/Source/Core/Color';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import JulianDate from 'cesium/Source/Core/JulianDate';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';

export default class SlicerArrows {
  constructor(viewer, dataSource, box) {
    this.viewer = viewer;
    this.dataSource = dataSource;
    this.box = box; // todo improve
    this.julianDate = new JulianDate();
    this.eventHandler = null;
    this.selectedArrow = null;
    this.bbox = null;
    this.center = null;
  }

  show(bbox) {
    this.bbox = bbox;
    this.center = bbox.center;
    this.createMoveArrows();
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
    this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
    this.eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
  }

  hide() {
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = null;
    }
  }

  onLeftDown(event) {
    const pickedObject = this.viewer.scene.pick(event.position);
    const isModelPicked = pickedObject && pickedObject.id && pickedObject.id.model;
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.type) {
      this.selectedArrow = pickedObject.id;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp() {
    if (this.selectedArrow) {
      const type = this.selectedArrow.properties.type.getValue();
      this.selectedArrow.position = new CallbackProperty(this.arrowCenterUpdateFunction(type), false);
      this.selectedArrow = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
    this.unhighlightArrow();
  }

  onMouseMove(movement) {
    if (this.selectedArrow) {
      const scene = this.viewer.scene;
      const type = this.selectedArrow.properties.type.getValue();
      const mainType = type.split('-')[0];
      const boxCenterCartographic = Cartographic.fromCartesian(this.center);

      // depends on selected plane type calculates plane distance
      // also updates plane entities center and dimensions (depends on type) to show planes as a box
      if (type.includes('altitude')) { // todo one type of moving
        const boundingSphere = new BoundingSphere(this.selectedArrow.position.getValue(this.julianDate));
        const pixelSize = scene.camera.getPixelSize(boundingSphere, scene.drawingBufferWidth, scene.drawingBufferHeight);
        const target = (movement.endPosition.y - movement.startPosition.y) * pixelSize;
        type.includes('down') ? this.box.planeDown.distance += target : this.box.planeUp.distance -= target;
        this.bbox.height = this.box.planeDown.distance + this.box.planeUp.distance;
        boxCenterCartographic.height = -this.box.planeDown.distance + this.bbox.height / 2;
        this.center = Cartographic.toCartesian(boxCenterCartographic);
        return;
      }

      const arrowPosition = this.selectedArrow.position.getValue(new Date());
      const arrowPosition2d = scene.cartesianToCanvasCoordinates(arrowPosition);

      const oppositeArrow = this.arrows[type.includes('northeast') ? mainType : `${mainType}-northeast`];

      const oppositeArrowPosition = oppositeArrow.position.getValue(new Date());
      const oppositeArrowPosition2d = scene.cartesianToCanvasCoordinates(oppositeArrowPosition);

      const axisVector3d = Cartesian3.subtract(oppositeArrowPosition, arrowPosition, new Cartesian3());
      const axisVector2d = Cartesian2.subtract(oppositeArrowPosition2d, arrowPosition2d, new Cartesian2());
      const moveVector = Cartesian2.subtract(movement.endPosition, arrowPosition2d, new Cartesian2());
      const scalar = Cartesian2.dot(moveVector, axisVector2d) / Cartesian2.dot(axisVector2d, axisVector2d);
      const moveVector3d = Cartesian3.multiplyByScalar(axisVector3d, scalar, new Cartesian3());
      const newArrowPosition = Cartesian3.add(arrowPosition, moveVector3d, new Cartesian3());
      const diff = Cartesian3.subtract(arrowPosition, newArrowPosition, new Cartesian3()); // todo check for another solution
      const diffSum = diff.x + diff.y + diff.z;

      const boundingSphere = new BoundingSphere(this.selectedArrow.position.getValue(this.julianDate));
      const pixelSize = scene.camera.getPixelSize(boundingSphere, scene.drawingBufferWidth, scene.drawingBufferHeight);
      const moveProj = Cartesian2.multiplyByScalar(axisVector2d, scalar, new Cartesian2());
      const newArrowPosition2d = Cartesian2.add(arrowPosition2d, moveProj, new Cartesian2());
      const direction = (1 / diffSum) * Math.abs(diffSum);
      const distance = Cartesian2.distance(newArrowPosition2d, arrowPosition2d) * pixelSize * direction;
      // const distance = Cartesian3.distance(arrowPosition, newArrowPosition) * direction;

      // this.selectedArrow.position = newArrowPosition;
      // const midpoint = Cartesian3.midpoint(newArrowPosition, oppositeArrowPosition, new Cartesian3());
      // const cartMidpoint = Cartographic.fromCartesian(midpoint);
      const lv95Center = radiansToLv95([boxCenterCartographic.longitude, boxCenterCartographic.latitude]); // todo improve

      if (type.includes('horizontal')) { // todo handle in slicingBox
        if (type.includes('northeast')) {
          this.box.planeHorizontalUp.distance += distance;
          this.bbox.width += distance;
        } else {
          this.box.planeHorizontalDown.distance -= distance;
          this.bbox.width -= distance;
        }
        lv95Center[1] += distance / 2;
      } else if (type.includes('vertical')) {
        if (type.includes('northeast')) {
          this.box.planeVerticalRight.distance -= distance;
          this.bbox.length -= distance;
        } else {
          this.box.planeVerticalLeft.distance += distance;
          this.bbox.length += distance;
        }
        lv95Center[0] -= distance / 2;
      }
      const degCenter = lv95ToDegrees(lv95Center);
      this.center = Cartesian3.fromDegrees(degCenter[0], degCenter[1], boxCenterCartographic.height);
      // this.center = Cartographic.toCartesian(boxCenterCartographic);
    } else {
      this.highlightArrow(movement.endPosition);
    }
    this.viewer.scene.requestRender();
  }

  arrowCenterUpdateFunction(type) {
    return () => {
      const boxCenter = Cartographic.fromCartesian(this.center);
      const lv95Center = radiansToLv95([boxCenter.longitude, boxCenter.latitude]);

      let lon, lat, height;
      const halfWidth = this.bbox.length / 2;
      const halfHeight = this.bbox.width / 2;
      if (type.includes('altitude')) {
        lon = lv95Center[0] - halfWidth;
        lat = lv95Center[1] - halfHeight;
        type.includes('down') ? height = -this.box.planeDown.distance : height = this.box.planeUp.distance;
      } else {
        let viewCenterLv95 = lv95Center;
        const viewCenter = pickCenterOnEllipsoid(this.viewer.scene);
        if (viewCenter) {
          const viewCenterCart = Cartographic.fromCartesian(viewCenter);
          viewCenterLv95 = radiansToLv95([viewCenterCart.longitude, viewCenterCart.latitude]);
        }
        const heightOffset = 20;
        height = this.viewer.scene.cameraUnderground ?
          -this.box.planeDown.distance - heightOffset :
          this.box.planeUp.distance + heightOffset;
        const negate = type.includes('northeast') ? 1 : -1;
        const offset = 5000;
        if (type.includes('horizontal')) {
          const horizontalMin = lv95Center[0] - halfWidth + offset;
          const horizontalMax = lv95Center[0] + halfWidth - offset;
          lon = CesiumMath.clamp(viewCenterLv95[0], horizontalMin, horizontalMax);
          lat = lv95Center[1] + halfHeight * negate;
        } else if (type.includes('vertical')) {
          const verticalMin = lv95Center[1] - halfHeight + offset;
          const verticalMax = lv95Center[1] + halfHeight - offset;
          lat = CesiumMath.clamp(viewCenterLv95[1], verticalMin, verticalMax);
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
        color: SLICING_GEOMETRY_COLOR
      },
      properties: {}
    };
    this.arrows = {};
    SLICE_ARROW_ICONS.forEach(icon => { // todo
      const navigationIcon = navigationIconTemplate;
      navigationIcon.position = new CallbackProperty(this.arrowCenterUpdateFunction(icon.type), false);
      navigationIcon.properties.type = icon.type;
      navigationIcon.model.uri = icon.uri;
      this.arrows[icon.type] = new Entity(navigationIcon);
      this.dataSource.entities.add(this.arrows[icon.type]);
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
      this.highlightedArrow.model.color = SLICING_GEOMETRY_COLOR;
      this.highlightedArrow = undefined;
      document.querySelector('.cesium-widget').style.cursor = '';
    }
  }
}
