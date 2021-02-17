import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import ShadowMode from 'cesium/Source/Scene/ShadowMode';
import ColorBlendMode from 'cesium/Source/Scene/ColorBlendMode';
import {SLICING_GEOMETRY_COLOR} from '../constants';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Entity from 'cesium/Source/DataSources/Entity';
import Color from 'cesium/Source/Core/Color';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import JulianDate from 'cesium/Source/Core/JulianDate';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';

/**
 * @typedef {object} ArrowListItem
 * @property {string} side - arrow position label
 * @property {string} uri - path to model
 * @property {string} [oppositeSide - opposite arrow position label]
 * @property {string} [position - arrow position. Required if 'positionUpdateCallback' is not provided]
 * @property {string} [oppositePosition - position to create move axis. Required if no opposite arrow]
 */

export default class SlicerArrows {
  /**
   * Creates one or more entities and handle their move.
   * @param {Viewer} viewer
   * @param {DataSource} dataSource - dataSource to store entities
   * @param {{
   *          arrowsList: ArrowListItem[],
   *          positionUpdateCallback: (function(string): Cartesian3),
   *          moveCallback: (function(string, number, Cartesian3): void)
   *        }} options
   */
  constructor(viewer, dataSource, options) {
    this.viewer = viewer;
    this.dataSource = dataSource;
    this.moveCallback = options.moveCallback;
    this.positionUpdateCallback = options.positionUpdateCallback;
    this.arrowsList = options.arrowsList;
    this.julianDate = new JulianDate();
    this.eventHandler = null;
    this.selectedArrow = null;
  }

  show() {
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
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.side) {
      this.selectedArrow = pickedObject.id;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp() {
    if (this.selectedArrow) {
      this.selectedArrow = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
    this.unhighlightArrow();
  }

  onMouseMove(movement) {
    if (this.selectedArrow) {
      const scene = this.viewer.scene;
      const side = this.selectedArrow.properties.side.getValue();
      // get second position to create move axis
      let oppositePosition3d = undefined;
      if (this.selectedArrow.properties.oppositeSide) {
        const oppositeSide = this.selectedArrow.properties.oppositeSide.getValue();
        const oppositeArrow = this.arrows[oppositeSide];
        oppositePosition3d = oppositeArrow.position.getValue(this.julianDate);
      } else if (this.selectedArrow.properties.oppositePosition) {
        oppositePosition3d = this.selectedArrow.properties.oppositePosition.getValue();
      } else {
        throw new Error('Move axis can\'t be created. Second position missing');
      }

      const arrowPosition3d = this.selectedArrow.position.getValue(this.julianDate);
      const arrowPosition2d = scene.cartesianToCanvasCoordinates(arrowPosition3d);
      const oppositePosition2d = scene.cartesianToCanvasCoordinates(oppositePosition3d);

      // get pixel size for calculation move distance in meters
      const boundingSphere = new BoundingSphere(arrowPosition3d);
      const pixelSize = scene.camera.getPixelSize(boundingSphere, scene.drawingBufferWidth, scene.drawingBufferHeight);

      // calculate scalar of mouse move
      const axisVector2d = Cartesian2.subtract(oppositePosition2d, arrowPosition2d, new Cartesian2());
      const mouseMoveVector = Cartesian2.subtract(movement.endPosition, arrowPosition2d, new Cartesian2());
      const scalar2d = Cartesian2.dot(mouseMoveVector, axisVector2d) / Cartesian2.dot(axisVector2d, axisVector2d);

      // calculate distance in meters
      const objectMoveVector2d = Cartesian2.multiplyByScalar(axisVector2d, scalar2d, new Cartesian2());
      const newArrowPosition2d = Cartesian2.add(arrowPosition2d, objectMoveVector2d, new Cartesian2());
      const distance = Cartesian2.distance(newArrowPosition2d, arrowPosition2d) * pixelSize;

      // calculate Cartesian3 position of arrow
      const scalarDirection = (1 / scalar2d) * Math.abs(scalar2d);
      const scalar3d = distance / Cartesian3.distance(arrowPosition3d, oppositePosition3d) * scalarDirection;
      const axisVector3d = Cartesian3.subtract(oppositePosition3d, arrowPosition3d, new Cartesian3());
      const objectMoveVector3d = Cartesian3.multiplyByScalar(axisVector3d, scalar3d, new Cartesian3());
      const newArrowPosition3d = Cartesian3.add(arrowPosition3d, objectMoveVector3d, new Cartesian3());

      // directly update arrow position if position callback not provided
      if (!this.positionUpdateCallback) {
        this.selectedArrow.position = newArrowPosition3d;
      }
      if (this.moveCallback) {
        // calculate move amount (distance with direction)
        const diff = Cartesian3.subtract(arrowPosition3d, newArrowPosition3d, new Cartesian3());
        const diffSum = diff.x + diff.y + diff.z;
        const direction = (1 / diffSum) * Math.abs(diffSum);
        const moveAmount = distance * direction;

        this.moveCallback(side, moveAmount, objectMoveVector3d);
      }

    } else {
      this.highlightArrow(movement.endPosition);
    }
    this.viewer.scene.requestRender();
  }

  createMoveArrows() {
    const arrowEntityTemplate = {
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
    this.arrowsList.forEach(arrow => {
      const arrowEntityOptions = arrowEntityTemplate;
      arrowEntityOptions.properties.side = arrow.side;
      arrowEntityOptions.model.uri = arrow.uri;
      if (this.positionUpdateCallback) {
        arrowEntityOptions.position = new CallbackProperty(() => this.positionUpdateCallback(arrow.side), false);
      } else {
        arrowEntityOptions.position = arrow.position;
      }
      if (arrow.oppositeSide) {
        arrowEntityOptions.properties.oppositeSide = arrow.oppositeSide;
      } else if (arrow.oppositePosition) {
        arrowEntityOptions.properties.oppositePosition = arrow.oppositePosition;
      }
      this.arrows[arrow.side] = new Entity(arrowEntityOptions);
      this.dataSource.entities.add(this.arrows[arrow.side]);
    });
  }

  highlightArrow(position) {
    const pickedObject = this.viewer.scene.pick(position);
    const isModelPicked = pickedObject && pickedObject.id && pickedObject.id.model;
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.side) {
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
