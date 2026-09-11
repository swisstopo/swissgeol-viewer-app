import {
  BoundingSphere,
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorBlendMode,
  ColorMaterialProperty,
  DataSource,
  Entity,
  JulianDate,
  Matrix4,
  Quaternion,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ShadowMode,
  Transforms,
  Viewer,
} from 'cesium';
import { CameraControllerService } from 'src/features/controls/camera-controller.service';
import {
  DEFAULT_CONFIG_FOR_SLICING_ARROW,
  MAX_SCALE_FACTOR,
  MIN_ARROW_LENGTH,
  MIN_ARROW_RADIUS,
  MIN_ARROW_TIP_LENGTH,
  MIN_ARROW_TIP_RADIUS,
  MIN_SIZE_DISTANCE,
  SCALE_FACTOR_HORIZONTAL,
  SCALE_FACTOR_VERTICAL,
  SLICING_GEOMETRY_COLOR,
} from '../constants';
import {
  getDirectionFromPoints,
  updateHeightForCartesianPositions,
} from '../cesiumutils';
import type { BBox } from './helper';
import { debounce } from '../utils';

export enum BBoxSide {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
  FRONT = 'front',
  BACK = 'back',
}

export interface ArrowListItem {
  // arrow position label
  side: BBoxSide;
  // opposite arrow position label
  oppositeSide?: string;
  // arrow position. Required if 'positionUpdateCallback' is not provided
  position?: Cartesian3;
  // position to create move axis. Required if no opposite arrow
  oppositePosition?: Cartesian3;
}

interface ArrowConfiguration {
  // specifying the approximate minimum pixel size of the model regardless of zoom
  minimumPixelSize?: number;
  // specifying a uniform linear scale]specifying a uniform linear scale
  scale?: number;
  // the maximum scale size of a model. An upper limit for minimumPixelSize
  maximumScale?: number;
  // specifying whether the model casts or receives shadows from light sources
  shadowMode?: ShadowMode;
  // specifying how the color blends with the model
  colorBlendMode?: ColorBlendMode;
  // specifying the Color that blends with the model's rendered color.
  color: Color;
  // Entity orientation
  orientation?: Quaternion;
}

export interface SlicerArrowOptions {
  arrowsList: ArrowListItem[];
  arrowConfiguration?: ArrowConfiguration;
  // entity position callback
  positionUpdateCallback: (string) => Cartesian3;
  // calls on arrow move
  moveCallback: (string, number, Cartesian3) => void;
  bbox: BBox;
}

interface ArrowGeometry {
  shaft: Entity;
  topCone: Entity;
  bottomCone: Entity;
}

export default class SlicerArrows {
  viewer!: Viewer;
  dataSource!: DataSource;
  moveCallback: (
    side: BBoxSide,
    moveAmount: number,
    moveVector: Cartesian3,
  ) => void;
  positionUpdateCallback: (string) => Cartesian3;
  arrowsList: ArrowListItem[];
  selectedArrow: Entity | null = null;
  arrowConfiguration: ArrowConfiguration;

  private enableInputs = true;
  private readonly cameraControllerService =
    CameraControllerService.get() as CameraControllerService;

  private readonly scratchBoundingSphere_ = new BoundingSphere();
  private readonly scratchArrowPosition2d_ = new Cartesian2();
  private readonly scratchOppositeArrowPosition2d_ = new Cartesian2();
  private readonly scratchAxisVector2d_ = new Cartesian2();
  private readonly scratchMouseMoveVector_ = new Cartesian2();
  private readonly scratchObjectMoveVector2d_ = new Cartesian2();
  private readonly scratchNewArrowPosition2d_ = new Cartesian2();
  private readonly axisVector3d = new Cartesian3();
  private readonly scratchLeft = new Cartesian3();
  private readonly scratchRight = new Cartesian3();
  private readonly scratchTop = new Cartesian3();
  private readonly scratchBottom = new Cartesian3();

  private eventHandler: ScreenSpaceEventHandler | null = null;
  highlightedArrow: ArrowGeometry | null = null;
  arrows: Record<string, ArrowGeometry> = {};
  bbox: BBox | null = null;

  /**
   * Creates one or more entities and handle their move.
   * @param {Viewer} viewer
   * @param {DataSource} dataSource - dataSource to store entities
   * @param {SlicerArrowOptions} options
   */
  constructor(
    viewer: Viewer,
    dataSource: DataSource,
    options: SlicerArrowOptions,
  ) {
    this.viewer = viewer;
    this.dataSource = dataSource;
    this.moveCallback = options.moveCallback;
    this.positionUpdateCallback = options.positionUpdateCallback;
    this.arrowsList = options.arrowsList;
    this.arrowConfiguration =
      options.arrowConfiguration || DEFAULT_CONFIG_FOR_SLICING_ARROW;
    this.bbox = options.bbox;
  }

  show() {
    this.createMoveArrows();
    this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.eventHandler.setInputAction(
      this.onLeftDown.bind(this),
      ScreenSpaceEventType.LEFT_DOWN,
    );
    this.eventHandler.setInputAction(
      debounce((evt) => this.onMouseMove(evt), 250),
      ScreenSpaceEventType.MOUSE_MOVE,
    );
    this.eventHandler.setInputAction(
      this.onLeftUp.bind(this),
      ScreenSpaceEventType.LEFT_UP,
    );
  }

  hide() {
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = null;
    }
  }

  onLeftDown(event) {
    const pickedObject = this.viewer.scene.pick(event.position);
    if (!pickedObject?.id) {
      return;
    }
    const pickedArrow = Object.values(this.arrows).find(
      (arrow) =>
        arrow.shaft === pickedObject.id ||
        arrow.topCone === pickedObject.id ||
        arrow.bottomCone === pickedObject.id,
    );
    if (pickedArrow) {
      this.selectedArrow = pickedArrow.shaft;
      this.enableInputs = this.cameraControllerService.enableInputs;
      this.cameraControllerService.enableInputs = false;
      this.eventHandler!.setInputAction(
        (evt) => this.onMouseMove(evt),
        ScreenSpaceEventType.MOUSE_MOVE,
      );
    }
  }

  onLeftUp() {
    if (this.selectedArrow) {
      this.selectedArrow = null;
      this.cameraControllerService.enableInputs = this.enableInputs;
      // for better performance
      this.eventHandler!.setInputAction(
        debounce((evt) => this.onMouseMove(evt), 250),
        ScreenSpaceEventType.MOUSE_MOVE,
      );
    }
    this.unhighlightArrow();
  }

  onMouseMove(movement) {
    if (this.selectedArrow) {
      const scene = this.viewer.scene;
      const properties = this.selectedArrow.properties!;
      const side: BBoxSide = properties.side.getValue();
      // get second position to create move axis
      let oppositePosition3d: Cartesian3;
      if (properties.oppositeSide) {
        const oppositeSide: BBoxSide = properties.oppositeSide.getValue();
        const oppositeArrow = this.arrows[oppositeSide];
        oppositePosition3d = oppositeArrow.shaft.position!.getValue(
          new JulianDate(),
        )!;
      } else if (properties.oppositePosition) {
        oppositePosition3d = properties.oppositePosition.getValue();
      } else {
        throw new Error("Move axis can't be created. Second position missing");
      }

      const arrowPosition3d = this.selectedArrow.position!.getValue(
        new JulianDate(),
      )!;
      scene.cartesianToCanvasCoordinates(
        arrowPosition3d,
        this.scratchArrowPosition2d_,
      );
      scene.cartesianToCanvasCoordinates(
        oppositePosition3d,
        this.scratchOppositeArrowPosition2d_,
      );

      // get pixel size for calculation move distance in meters
      this.scratchBoundingSphere_.center = arrowPosition3d;
      const pixelSize = scene.camera.getPixelSize(
        this.scratchBoundingSphere_,
        scene.drawingBufferWidth,
        scene.drawingBufferHeight,
      );

      // calculate scalar of mouse move
      Cartesian2.subtract(
        this.scratchOppositeArrowPosition2d_,
        this.scratchArrowPosition2d_,
        this.scratchAxisVector2d_,
      );
      Cartesian2.subtract(
        movement.endPosition,
        this.scratchArrowPosition2d_,
        this.scratchMouseMoveVector_,
      );
      const scalar2d =
        Cartesian2.dot(
          this.scratchMouseMoveVector_,
          this.scratchAxisVector2d_,
        ) /
        Cartesian2.dot(this.scratchAxisVector2d_, this.scratchAxisVector2d_);

      // calculate distance in meters
      Cartesian2.multiplyByScalar(
        this.scratchAxisVector2d_,
        scalar2d,
        this.scratchObjectMoveVector2d_,
      );
      Cartesian2.add(
        this.scratchArrowPosition2d_,
        this.scratchObjectMoveVector2d_,
        this.scratchNewArrowPosition2d_,
      );
      const distance =
        Cartesian2.distance(
          this.scratchNewArrowPosition2d_,
          this.scratchArrowPosition2d_,
        ) * pixelSize;

      // calculate Cartesian3 position of arrow
      const scalarDirection = (1 / scalar2d) * Math.abs(scalar2d);
      const scalar3d =
        (distance / Cartesian3.distance(arrowPosition3d, oppositePosition3d)) *
        scalarDirection;

      this.updateAxisVector(arrowPosition3d, oppositePosition3d);

      const objectMoveVector3d = Cartesian3.multiplyByScalar(
        this.axisVector3d,
        scalar3d,
        new Cartesian3(),
      );
      const newArrowPosition3d = Cartesian3.add(
        arrowPosition3d,
        objectMoveVector3d,
        new Cartesian3(),
      );

      // directly update arrow position if position callback not provided
      if (!this.positionUpdateCallback) {
        // @ts-ignore 2322
        this.selectedArrow.position = newArrowPosition3d;
      }
      if (this.moveCallback) {
        // calculate move amount (distance with direction)
        const moveAmount =
          distance *
          getDirectionFromPoints(arrowPosition3d, newArrowPosition3d);

        this.moveCallback(side, moveAmount, objectMoveVector3d);
      }
    } else {
      this.highlightArrow(movement.endPosition);
    }
    this.viewer.scene.requestRender();
  }

  createMoveArrows() {
    const arrowEntityTemplate: Entity.ConstructorOptions = {
      properties: {},
    };
    this.arrows = {};
    this.arrowsList.forEach((arrow) => {
      const isVertical =
        arrow.side === BBoxSide.UP || arrow.side === BBoxSide.DOWN;
      const arrowEntityOptions = arrowEntityTemplate;
      const properties = arrowEntityOptions.properties;
      if (!properties) return;
      properties.side = arrow.side;
      if (this.positionUpdateCallback) {
        // @ts-ignore 2322
        arrowEntityOptions.position = new CallbackProperty(
          () => this.positionUpdateCallback(arrow.side),
          false,
        );
      } else {
        arrowEntityOptions.position = arrow.position;
      }

      if (!this.bbox) {
        return;
      }

      // Default values for up and down arrows
      let orientation: Quaternion | undefined = undefined;
      let directionVector: Cartesian3 = new Cartesian3(0, 0, 1);
      if (!isVertical) {
        const pointA = this.bbox.corners.topLeft;
        const pointB =
          arrow.side === BBoxSide.FRONT || arrow.side === BBoxSide.BACK
            ? this.bbox.corners.topRight
            : this.bbox.corners.bottomLeft;
        directionVector = this.getHorizontalPerpendicularVectorFromTwoPoints(
          pointA,
          pointB,
        );
        const rotation = Quaternion.fromAxisAngle(
          Cartesian3.cross(
            Cartesian3.UNIT_Z,
            directionVector,
            new Cartesian3(),
          ),
          Cartesian3.angleBetween(Cartesian3.UNIT_Z, directionVector),
        );
        orientation = Quaternion.normalize(rotation, new Quaternion());
      }
      arrowEntityOptions.orientation = orientation;

      if (arrow.oppositeSide) {
        properties.oppositeSide = arrow.oppositeSide;
      } else if (arrow.oppositePosition) {
        properties.oppositePosition = arrow.oppositePosition;
      }

      const createCallBackProperty = (
        min_size: number,
        position: Cartesian3,
      ) => {
        return new CallbackProperty(() => {
          return this.scaleArrowElementsRelativeToCameraDistance(
            min_size,
            position,
          );
        }, false);
      };

      const shaft = new Entity(arrowEntityOptions);
      // @ts-expect-error
      shaft.cylinder = {
        length: createCallBackProperty(
          MIN_ARROW_LENGTH,
          shaft.position!.getValue(new JulianDate())!,
        ),
        bottomRadius: createCallBackProperty(
          MIN_ARROW_RADIUS,
          shaft.position!.getValue(new JulianDate())!,
        ),
        topRadius: createCallBackProperty(
          MIN_ARROW_RADIUS,
          shaft.position!.getValue(new JulianDate())!,
        ),
      };

      const arrowTipLength = createCallBackProperty(
        MIN_ARROW_TIP_LENGTH,
        shaft.position!.getValue(new JulianDate())!,
      );

      const arrowTipRadius = createCallBackProperty(
        MIN_ARROW_TIP_RADIUS,
        shaft.position!.getValue(new JulianDate())!,
      );

      const topCone = new Entity({
        position: this.computeRelativePosition(
          shaft,
          isVertical,
          directionVector,
        ),
        cylinder: {
          length: arrowTipLength,
          topRadius: 0,
          bottomRadius: arrowTipRadius,
        },
        orientation: orientation,
      });

      const bottomCone = new Entity({
        position: this.computeRelativePosition(
          shaft,
          isVertical,
          Cartesian3.negate(directionVector, new Cartesian3()),
        ),
        cylinder: {
          length: arrowTipLength,
          topRadius: arrowTipRadius,
          bottomRadius: 0,
        },
        orientation: orientation,
      });

      this.arrows[arrow.side] = {
        shaft,
        topCone,
        bottomCone,
      };
      this.dataSource.entities.add(shaft);
      this.dataSource.entities.add(topCone);
      this.dataSource.entities.add(bottomCone);
    });
  }

  scaleArrowElementsRelativeToCameraDistance(
    minSize: number,
    position: Cartesian3,
  ): number {
    const cameraPosition = this.viewer.camera.position;
    const distance = Cartesian3.distance(cameraPosition, position);
    return (
      minSize *
      Math.min(Math.max(1, distance / MIN_SIZE_DISTANCE), MAX_SCALE_FACTOR)
    );
  }

  /**
   * Get a vector perpendicular to the side of the bbox and parallel to the ellipsoid which is defined by two of its corners (pointA and pointB)
   * @param pointA one of the corners of the side of the bbox
   * @param pointB the other corner of the side of the bbox
   */
  getHorizontalPerpendicularVectorFromTwoPoints(
    pointA: Cartesian3,
    pointB: Cartesian3,
  ): Cartesian3 {
    const diff = Cartesian3.subtract(pointB, pointA, new Cartesian3());
    const normalized = Cartesian3.normalize(diff, new Cartesian3());
    const perpendicular = new Cartesian3(-normalized.y, normalized.x, 0);
    const perpendicularEnd = Cartesian3.add(
      pointA,
      perpendicular,
      new Cartesian3(),
    );

    // Convert the perpendicular point back to Cartographic to maintain the same height above the ellipsoid
    const perpendicularCartographic =
      Cartographic.fromCartesian(perpendicularEnd);
    const pointACartographic = Cartographic.fromCartesian(pointA);
    perpendicularCartographic.height = pointACartographic.height; // Keep original height

    // Get the perpendicular point in Cartesian3
    const referencePoint = Cartesian3.fromRadians(
      perpendicularCartographic.longitude,
      perpendicularCartographic.latitude,
      perpendicularCartographic.height,
    );
    // Get a vector perpendicular to the side of the bbox and parallel to the ellipsoid
    return Cartesian3.subtract(referencePoint, pointA, new Cartesian3());
  }

  /**
   * Compute relative position of the arrow depending on the parent entity position
   *
   * @param parentEntity Entity to which the arrow is attached
   * @param isVertical Whether the arrow vertical in space
   * @param directionVector The direction in which the arrow is pointing
   */
  computeRelativePosition(
    parentEntity: Entity,
    isVertical: boolean,
    directionVector: Cartesian3,
  ): CallbackPositionProperty {
    return new CallbackPositionProperty((time, result) => {
      const parentPosition = parentEntity.position!.getValue(time);
      if (!parentPosition) return undefined;

      const cylinderLength: number = parentEntity.cylinder?.length?.getValue(
        new JulianDate(),
      );
      if (isVertical) {
        const transform = Transforms.eastNorthUpToFixedFrame(parentPosition);
        const scaledDirectionVector = Cartesian3.multiplyByScalar(
          directionVector,
          cylinderLength * SCALE_FACTOR_VERTICAL,
          new Cartesian3(),
        );
        return Matrix4.multiplyByPoint(
          transform,
          scaledDirectionVector,
          result ?? new Cartesian3(),
        );
      }
      return Cartesian3.add(
        parentPosition,
        Cartesian3.multiplyByScalar(
          directionVector,
          cylinderLength * SCALE_FACTOR_HORIZONTAL,
          new Cartesian3(),
        ),
        new Cartesian3(),
      );
    }, false);
  }

  highlightArrow(position) {
    const pickedObject = this.viewer.scene.pick(position);
    if (pickedObject?.id.cylinder) {
      const entry = Object.values(this.arrows).find(
        (entry) =>
          entry.shaft === pickedObject.id ||
          entry.topCone === pickedObject.id ||
          entry.bottomCone === pickedObject.id,
      );
      if (entry) {
        this.highlightedArrow = entry;
        this.viewer.canvas.style.cursor = 'pointer';
        // @ts-expect-error 2322
        this.highlightedArrow.shaft.cylinder.material = Color.YELLOW;
        // @ts-expect-error 2322
        this.highlightedArrow.topCone.cylinder.material = Color.YELLOW;
        // @ts-expect-error 2322
        this.highlightedArrow.bottomCone.cylinder.material = Color.YELLOW;
      }
    } else {
      this.unhighlightArrow();
    }
  }

  unhighlightArrow() {
    if (this.highlightedArrow) {
      this.highlightedArrow.shaft.cylinder!.material =
        new ColorMaterialProperty(SLICING_GEOMETRY_COLOR);
      this.highlightedArrow.topCone.cylinder!.material =
        new ColorMaterialProperty(SLICING_GEOMETRY_COLOR);
      this.highlightedArrow.bottomCone.cylinder!.material =
        new ColorMaterialProperty(SLICING_GEOMETRY_COLOR);

      this.highlightedArrow = null;
      this.viewer.canvas.style.cursor = '';
    }
  }

  toggleArrowsVisibility(show) {
    this.arrowsList.forEach((arrow) => {
      this.arrows[arrow.side].shaft.show = show;
      this.arrows[arrow.side].topCone.show = show;
      this.arrows[arrow.side].bottomCone.show = show;
    });
  }

  updateAxisVector(arrowPosition3d, oppositePosition3d) {
    const corners = this.bbox!.corners;
    const type: BBoxSide = this.selectedArrow!.properties!.side.getValue();
    if (type === BBoxSide.LEFT || type === BBoxSide.RIGHT) {
      Cartesian3.midpoint(
        corners.bottomLeft,
        corners.topLeft,
        this.scratchLeft,
      );
      Cartesian3.midpoint(
        corners.bottomRight,
        corners.topRight,
        this.scratchRight,
      );
      updateHeightForCartesianPositions(
        [this.scratchLeft, this.scratchRight],
        0,
        undefined,
        true,
      );
    } else {
      Cartesian3.midpoint(corners.topLeft, corners.topRight, this.scratchTop);
      Cartesian3.midpoint(
        corners.bottomLeft,
        corners.bottomRight,
        this.scratchBottom,
      );
      updateHeightForCartesianPositions(
        [this.scratchTop, this.scratchBottom],
        0,
        undefined,
        true,
      );
    }
    switch (type) {
      case BBoxSide.RIGHT:
        Cartesian3.subtract(
          this.scratchLeft,
          this.scratchRight,
          this.axisVector3d,
        );
        break;
      case BBoxSide.LEFT:
        Cartesian3.subtract(
          this.scratchRight,
          this.scratchLeft,
          this.axisVector3d,
        );
        break;
      case BBoxSide.FRONT:
        Cartesian3.subtract(
          this.scratchBottom,
          this.scratchTop,
          this.axisVector3d,
        );
        break;
      case BBoxSide.BACK:
        Cartesian3.subtract(
          this.scratchTop,
          this.scratchBottom,
          this.axisVector3d,
        );
        break;
      default:
        Cartesian3.subtract(
          oppositePosition3d,
          arrowPosition3d,
          this.axisVector3d,
        );
    }
  }
}
