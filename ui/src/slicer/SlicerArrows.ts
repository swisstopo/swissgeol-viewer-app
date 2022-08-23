import {
  Cartesian2,
  Cartesian3,
  Color,
  CallbackProperty,
  Entity,
  BoundingSphere,
  ScreenSpaceEventType,
  JulianDate,
  ScreenSpaceEventHandler,

} from 'cesium';
import {DEFAULT_CONFIG_FOR_SLICING_ARROW, SLICING_GEOMETRY_COLOR} from '../constants';
import {getDirectionFromPoints, updateHeightForCartesianPositions} from '../cesiumutils';
import type {Viewer, DataSource, ColorBlendMode, Quaternion, ShadowMode} from 'cesium';
import type {BBox} from './helper';
import {debounce} from '../utils';

interface ArrowListItem {
  // arrow position label
  side: string,
  // path to model
  uri: string,
  // opposite arrow position label
  oppositeSide?: string,
  // arrow position. Required if 'positionUpdateCallback' is not provided
  position?: Cartesian3,
  // position to create move axis. Required if no opposite arrow
  oppositePosition?: Cartesian3
}

interface ArrowConfiguration {
  // specifying the approximate minimum pixel size of the model regardless of zoom
  minimumPixelSize?: number,
  // specifying a uniform linear scale]specifying a uniform linear scale
  scale?: number,
  // the maximum scale size of a model. An upper limit for minimumPixelSize
  maximumScale?: number,
  // specifying whether the model casts or receives shadows from light sources
  shadowMode?: ShadowMode,
  // specifying how the color blends with the model
  colorBlendMode?: ColorBlendMode,
  // specifying the Color that blends with the model's rendered color.
  color: Color,
  // Entity orientation
  orientation?: Quaternion,
}

export interface SlicerArrowOptions {
  arrowsList: ArrowListItem[],
  arrowConfiguration?: ArrowConfiguration,
  // entity position callback
  positionUpdateCallback: (string) => Cartesian3,
  // calls on arrow move
  moveCallback: (string, number, Cartesian3) => void,
  bbox: BBox
}


export default class SlicerArrows {
  viewer!: Viewer;
  dataSource!: DataSource;
  moveCallback: (string, number, Cartesian3) => void;
  positionUpdateCallback: (string) => Cartesian3;
  arrowsList: ArrowListItem[];
  julianDate = new JulianDate();
  selectedArrow: Entity | null = null;
  arrowConfiguration: ArrowConfiguration;

  private enableInputs = true;

  private scratchBoundingSphere_ = new BoundingSphere();
  private scratchArrowPosition2d_ = new Cartesian2();
  private scratchOppositeArrowPosition2d_ = new Cartesian2();
  private scratchAxisVector2d_ = new Cartesian2();
  private scratchMouseMoveVector_ = new Cartesian2();
  private scratchObjectMoveVector2d_ = new Cartesian2();
  private scratchNewArrowPosition2d_ = new Cartesian2();
  private axisVector3d = new Cartesian3();
  private scratchLeft = new Cartesian3();
  private scratchRight = new Cartesian3();
  private scratchTop = new Cartesian3();
  private scratchBottom = new Cartesian3();

  private eventHandler: (ScreenSpaceEventHandler | null) = null;
  highlightedArrow: Entity | undefined = undefined;
  arrows: Record<string, Entity> = {};
  bbox: BBox | null = null;


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
    this.arrowConfiguration = options.arrowConfiguration || DEFAULT_CONFIG_FOR_SLICING_ARROW;
    this.bbox = options.bbox;
  }

  show() {
    this.createMoveArrows();
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
    this.eventHandler.setInputAction(debounce((evt) => this.onMouseMove(evt), 250), ScreenSpaceEventType.MOUSE_MOVE);
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
      this.enableInputs = this.viewer.scene.screenSpaceCameraController.enableInputs;
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
      this.eventHandler!.setInputAction((evt) => this.onMouseMove(evt), ScreenSpaceEventType.MOUSE_MOVE);
    }
  }

  onLeftUp() {
    if (this.selectedArrow) {
      this.selectedArrow = null;
      this.viewer.scene.screenSpaceCameraController.enableInputs = this.enableInputs;
      // for better performance
      this.eventHandler!.setInputAction(debounce((evt) => this.onMouseMove(evt), 250), ScreenSpaceEventType.MOUSE_MOVE);
    }
    this.unhighlightArrow();
  }

  onMouseMove(movement) {
    if (this.selectedArrow) {
      const scene = this.viewer.scene;
      const properties = this.selectedArrow.properties!;
      const side: string = properties.side.getValue();
      // get second position to create move axis
      let oppositePosition3d: Cartesian3;
      if (properties.oppositeSide) {
        const oppositeSide: string = properties.oppositeSide.getValue();
        const oppositeArrow = this.arrows[oppositeSide];
        oppositePosition3d = oppositeArrow.position!.getValue(this.julianDate);
      } else if (properties.oppositePosition) {
        oppositePosition3d = properties.oppositePosition.getValue();
      } else {
        throw new Error('Move axis can\'t be created. Second position missing');
      }

      const arrowPosition3d = this.selectedArrow.position!.getValue(this.julianDate);
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

      this.updateAxisVector(arrowPosition3d, oppositePosition3d);

      const objectMoveVector3d = Cartesian3.multiplyByScalar(this.axisVector3d, scalar3d, new Cartesian3());
      const newArrowPosition3d = Cartesian3.add(arrowPosition3d, objectMoveVector3d, new Cartesian3());

      // directly update arrow position if position callback not provided
      if (!this.positionUpdateCallback) {
        // @ts-ignore 2322
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
    const arrowEntityTemplate: Entity.ConstructorOptions = {
      // @ts-ignore 2322
      orientation: this.arrowConfiguration.orientation,
      model: this.arrowConfiguration,
      properties: {}
    };
    this.arrows = {};
    this.arrowsList.forEach(arrow => {
      const arrowEntityOptions = arrowEntityTemplate;
      const properties = arrowEntityOptions.properties;
      if (!properties) return;
      properties!.side = arrow.side;
      arrowEntityOptions.model!.uri = arrow.uri;
      if (this.positionUpdateCallback) {
        // @ts-ignore 2322
        arrowEntityOptions.position = new CallbackProperty(() => this.positionUpdateCallback(arrow.side), false);
      } else {
        arrowEntityOptions.position = arrow.position;
      }
      if (arrow.oppositeSide) {
        properties.oppositeSide = arrow.oppositeSide;
      } else if (arrow.oppositePosition) {
        properties.oppositePosition = arrow.oppositePosition;
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
      // @ts-ignore 2322
      this.highlightedArrow.model.color = Color.YELLOW;
    } else {
      this.unhighlightArrow();
    }
  }

  unhighlightArrow() {
    if (this.highlightedArrow?.model) {
      // @ts-ignore 2322
      this.highlightedArrow.model.color = SLICING_GEOMETRY_COLOR;
      this.highlightedArrow = undefined;
      this.viewer.canvas.style.cursor = '';
    }
  }

  toggleArrowsVisibility(show) {
    this.arrowsList.forEach(arrow => this.arrows[arrow.side].show = show);
  }

  updateAxisVector(arrowPosition3d, oppositePosition3d) {
    const corners = this.bbox!.corners;
    const type = this.selectedArrow!.properties!.side.getValue();
    if (type === 'left' || type === 'right') {
      Cartesian3.midpoint(corners.bottomLeft, corners.topLeft, this.scratchLeft);
      Cartesian3.midpoint(corners.bottomRight, corners.topRight, this.scratchRight);
      updateHeightForCartesianPositions([this.scratchLeft, this.scratchRight], 0, undefined, true);
    } else {
      Cartesian3.midpoint(corners.topLeft, corners.topRight, this.scratchTop);
      Cartesian3.midpoint(corners.bottomLeft, corners.bottomRight, this.scratchBottom);
      updateHeightForCartesianPositions([this.scratchTop, this.scratchBottom], 0, undefined, true);
    }
    switch (type) {
      case 'right':
        Cartesian3.subtract(this.scratchLeft, this.scratchRight, this.axisVector3d);
        break;
      case 'left':
        Cartesian3.subtract(this.scratchRight, this.scratchLeft, this.axisVector3d);
        break;
      case 'front':
        Cartesian3.subtract(this.scratchBottom, this.scratchTop, this.axisVector3d);
        break;
      case 'back':
        Cartesian3.subtract(this.scratchTop, this.scratchBottom, this.axisVector3d);
        break;
      default:
        Cartesian3.subtract(oppositePosition3d, arrowPosition3d, this.axisVector3d);
    }
  }
}
