import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {DEFAULT_CONFIG_FOR_SLICING_ARROW, SLICING_GEOMETRY_COLOR} from '../constants';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Entity from 'cesium/Source/DataSources/Entity';
import Color from 'cesium/Source/Core/Color';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import JulianDate from 'cesium/Source/Core/JulianDate';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import {getDirectionFromPoints} from '../cesiumutils';

/**
 * @typedef {object} ArrowListItem
 * @property {string} side - arrow position label
 * @property {string} uri - path to model
 * @property {string} [oppositeSide - opposite arrow position label]
 * @property {string} [position - arrow position. Required if 'positionUpdateCallback' is not provided]
 * @property {string} [oppositePosition - position to create move axis. Required if no opposite arrow]
 */

/**
 * @typedef {object} ArrowConfiguration
 * @property {number} [minimumPixelSize - specifying the approximate minimum pixel size of the model regardless of zoom]
 * @property {number} [scale - specifying a uniform linear scale]
 * @property {number} [maximumScale - the maximum scale size of a model. An upper limit for minimumPixelSize]
 * @property {shadows} [shadowMode - specifying whether the model casts or receives shadows from light sources]
 * @property {ColorBlendMode} [colorBlendMode - specifying how the color blends with the model]
 * @property {Color} [color - specifying the Color that blends with the model's rendered color.]
 * @property {Quaternion} [orientation - entity orientation.]
 */

/**
 * @typedef {object} SlicerArrowOptions
 * @property {ArrowListItem[]} arrowsList
 * @property {ArrowConfiguration} [arrowConfiguration]
 * @property {(function(string): Cartesian3)} [positionUpdateCallback - entity position callback]
 * @property {(function(string, number, Cartesian3): void)} [moveCallback - calls on arrow move]
 */

export default class SlicerArrows {
  /**
   * Creates one or more entities and handle their move.
   * @param {Viewer} viewer
   * @param {DataSource} dataSource - dataSource to store entities
   * @param {SlicerArrowOptions} options
   */
  constructor(viewer, dataSource, options) {
    this.viewer = viewer;
    this.dataSource = dataSource;
    this.moveCallback = options.moveCallback;
    this.positionUpdateCallback = options.positionUpdateCallback;
    this.arrowsList = options.arrowsList;
    this.julianDate = new JulianDate();
    this.selectedArrow = null;
    this.arrowConfiguration = options.arrowConfiguration || DEFAULT_CONFIG_FOR_SLICING_ARROW;

    this.eventHandler_ = null;
    this.enableInputs_ = true;

    this.scratchBoundingSphere_ = new BoundingSphere();
    this.scratchArrowPosition2d_ = new Cartesian2();
    this.scratchOppositeArrowPosition2d_ = new Cartesian2();
    this.scratchAxisVector2d_ = new Cartesian2();
    this.scratchMouseMoveVector_ = new Cartesian2();
    this.scratchObjectMoveVector2d_ = new Cartesian2();
    this.scratchNewArrowPosition2d_ = new Cartesian2();
    this.scratchAxisVector3d_ = new Cartesian3();
  }

  show() {
    this.createMoveArrows();
    this.eventHandler_ = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler_.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
    this.eventHandler_.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
    this.eventHandler_.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
  }

  hide() {
    if (this.eventHandler_) {
      this.eventHandler_.destroy();
      this.eventHandler_ = null;
    }
  }

  onLeftDown(event) {
    const pickedObject = this.viewer.scene.pick(event.position);
    const isModelPicked = pickedObject && pickedObject.id && pickedObject.id.model;
    if (isModelPicked && pickedObject.id.properties && pickedObject.id.properties.side) {
      this.selectedArrow = pickedObject.id;
      this.enableInputs_ = this.viewer.scene.screenSpaceCameraController.enableInputs;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    }
  }

  onLeftUp() {
    if (this.selectedArrow) {
      this.selectedArrow = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = this.enableInputs_;
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
      scene.cartesianToCanvasCoordinates(arrowPosition3d, this.scratchArrowPosition2d_);
      scene.cartesianToCanvasCoordinates(oppositePosition3d, this.scratchOppositeArrowPosition2d_);

      // get pixel size for calculation move distance in meters
      this.scratchBoundingSphere_.center = arrowPosition3d;
      const pixelSize = scene.camera.getPixelSize(this.scratchBoundingSphere_, scene.drawingBufferWidth, scene.drawingBufferHeight);

      // calculate scalar of mouse move
      Cartesian2.subtract(this.scratchOppositeArrowPosition2d_, this.scratchArrowPosition2d_, this.scratchAxisVector2d_);
      Cartesian2.subtract(movement.endPosition, this.scratchArrowPosition2d_, this.scratchMouseMoveVector_);
      const scalar2d =
        Cartesian2.dot(this.scratchMouseMoveVector_, this.scratchAxisVector2d_) / Cartesian2.dot(this.scratchAxisVector2d_, this.scratchAxisVector2d_);

      // calculate distance in meters
      Cartesian2.multiplyByScalar(this.scratchAxisVector2d_, scalar2d, this.scratchObjectMoveVector2d_);
      Cartesian2.add(this.scratchArrowPosition2d_, this.scratchObjectMoveVector2d_, this.scratchNewArrowPosition2d_);
      const distance = Cartesian2.distance(this.scratchNewArrowPosition2d_, this.scratchArrowPosition2d_) * pixelSize;

      // calculate Cartesian3 position of arrow
      const scalarDirection = (1 / scalar2d) * Math.abs(scalar2d);
      const scalar3d = distance / Cartesian3.distance(arrowPosition3d, oppositePosition3d) * scalarDirection;
      Cartesian3.subtract(oppositePosition3d, arrowPosition3d, this.scratchAxisVector3d_);

      const objectMoveVector3d = Cartesian3.multiplyByScalar(this.scratchAxisVector3d_, scalar3d, new Cartesian3());
      const newArrowPosition3d = Cartesian3.add(arrowPosition3d, objectMoveVector3d, new Cartesian3());

      // directly update arrow position if position callback not provided
      if (!this.positionUpdateCallback) {
        this.selectedArrow.position = newArrowPosition3d;
      }
      if (this.moveCallback) {
        // calculate move amount (distance with direction)
        const moveAmount = distance * getDirectionFromPoints(arrowPosition3d, newArrowPosition3d);

        this.moveCallback(side, moveAmount, objectMoveVector3d);
      }

    } else {
      this.highlightArrow(movement.endPosition);
    }
    this.viewer.scene.requestRender();
  }

  createMoveArrows() {
    const arrowEntityTemplate = {
      orientation: this.arrowConfiguration.orientation,
      model: this.arrowConfiguration,
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
      this.viewer.canvas.style.cursor = 'pointer';
      this.highlightedArrow.model.color = Color.YELLOW;
    } else {
      this.unhighlightArrow();
    }
  }

  unhighlightArrow() {
    if (this.highlightedArrow) {
      this.highlightedArrow.model.color = SLICING_GEOMETRY_COLOR;
      this.highlightedArrow = undefined;
      this.viewer.canvas.style.cursor = '';
    }
  }

  toggleArrowsVisibility(show) {
    this.arrowsList.forEach(arrow => this.arrows[arrow.side].show = show);
  }
}
