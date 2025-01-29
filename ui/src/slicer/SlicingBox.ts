import type { Cesium3DTileset, DataSource, Entity, Viewer } from 'cesium';
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  CornerType,
  JulianDate,
  Matrix4,
  Plane,
  VoxelPrimitive,
} from 'cesium';
import { executeForAllPrimitives } from '../utils';
import SlicerArrows from './SlicerArrows';
import type { BBox } from './helper';
import {
  createClippingPlanes,
  createCPCModelMatrixFromSphere,
  getBboxFromRectangle,
  getBboxFromViewRatio,
  moveSlicingBoxCorners,
} from './helper';
import {
  DEFAULT_CONFIG_FOR_SLICING_ARROW,
  SLICE_BOX_ARROWS_INSIDE,
  SLICE_BOX_ARROWS_OUTSIDE,
  SLICING_BOX_MIN_SIZE,
  SLICING_GEOMETRY_COLOR,
} from '../constants';
import {
  pickCenterOnEllipsoid,
  planeFromTwoPoints,
  projectPointOnSegment,
  updateHeightForCartesianPositions,
} from '../cesiumutils';
import SlicingToolBase from './SlicingToolBase';

export interface SlicingBoxOptions {
  type: 'box' | 'view-box' | undefined;
  slicePoints: Cartesian3[];
  negate: boolean | undefined;
  syncBoxPlanesCallback: (SlicingBoxOptions) => void;
  lowerLimit: number;
  height: number;
  showBox: boolean | undefined;
}

/**
 * This is a tool to cut the globe and models according to a box.
 * Either the interior or the exterior of the box is displayed.
 * Cutting is achieved by using Cesium slicing planes.
 */
export default class SlicingBox extends SlicingToolBase {
  dataSource: DataSource;
  options: SlicingBoxOptions | null = null;
  backPlane: Plane | null = null;
  frontPlane: Plane | null = null;
  leftPlane: Plane | null = null;
  rightPlane: Plane | null = null;

  downPlane: Plane | null = null;
  upPlane: Plane | null = null;
  zPlanes: [Plane, Plane] | null = null;

  bbox: BBox | null = null;
  boxCenter: Cartesian3 | null = null;
  julianDate = new JulianDate();

  globePlanes = [];
  planesPositions:
    | [
        [Cartesian3, Cartesian3],
        [Cartesian3, Cartesian3],
        [Cartesian3, Cartesian3],
        [Cartesian3, Cartesian3],
      ]
    | null = null;

  slicerArrows: SlicerArrows | null = null;
  slicingBoxEntity: Entity | null = null;
  modelMatrix: Matrix4 | null = null;
  sidePlanes: Plane[] = [];

  constructor(viewer: Viewer, dataSource: DataSource) {
    super(viewer);
    this.dataSource = dataSource;
  }

  activate(options: SlicingBoxOptions): void {
    this.options = options;
    if (options.slicePoints && options.slicePoints.length) {
      this.bbox = getBboxFromRectangle(
        this.viewer,
        options.slicePoints,
        options.lowerLimit,
        options.height,
      );
    } else {
      this.bbox = getBboxFromViewRatio(this.viewer, 1 / 3);
    }
    this.boxCenter = this.bbox.center;
    this.planesPositions = [
      [this.bbox.corners.bottomLeft, this.bbox.corners.bottomRight],
      [this.bbox.corners.topRight, this.bbox.corners.topLeft],
      [this.bbox.corners.bottomRight, this.bbox.corners.topRight],
      [this.bbox.corners.topLeft, this.bbox.corners.bottomLeft],
    ];
    this.options.lowerLimit = this.bbox.lowerLimit;
    this.updateSidePlanes();

    this.downPlane = Plane.fromPointNormal(this.boxCenter, Cartesian3.UNIT_Z);
    this.upPlane = Plane.fromPointNormal(
      this.boxCenter,
      Cartesian3.negate(Cartesian3.UNIT_Z, new Cartesian3()),
    );
    this.downPlane.distance = this.options.lowerLimit
      ? this.options.lowerLimit * -1
      : this.bbox.height / 2;
    this.upPlane.distance = this.options.lowerLimit
      ? this.options.lowerLimit + this.bbox.height
      : this.bbox.height / 2;
    this.zPlanes = [this.downPlane, this.upPlane];

    this.slicerArrows = new SlicerArrows(this.viewer, this.dataSource, {
      moveCallback: (side, moveAmount, moveVector) =>
        this.onPlaneMove(side, moveAmount, moveVector),
      positionUpdateCallback: (side: string) =>
        this.arrowPositionCallback(side),
      arrowsList: this.options.negate
        ? SLICE_BOX_ARROWS_INSIDE
        : SLICE_BOX_ARROWS_OUTSIDE,
      arrowConfiguration: {
        ...DEFAULT_CONFIG_FOR_SLICING_ARROW,
        orientation: this.bbox.orientation,
      },
      bbox: this.bbox,
    });
    this.slicerArrows.show();

    const boxPositions = [
      this.bbox.corners.bottomRight,
      this.bbox.corners.bottomLeft,
      this.bbox.corners.topLeft,
      this.bbox.corners.topRight,
      this.bbox.corners.bottomRight,
    ];
    const scratchCartesian2 = new Cartesian2(1, 0);
    const scratchCenter = new Cartographic();
    this.slicingBoxEntity = this.dataSource.entities.add({
      position: Cartesian3.midpoint(
        boxPositions[0],
        boxPositions[2],
        new Cartesian3(),
      ),
      polylineVolume: {
        positions: new CallbackProperty(() => {
          const height =
            Cartographic.fromCartesian(
              this.boxCenter!,
              undefined,
              scratchCenter,
            ).height -
            this.bbox!.height / 2;
          // Fixme workaround, see https://github.com/CesiumGS/cesium/issues/12005
          this.viewer.scene.requestRender();
          return updateHeightForCartesianPositions(boxPositions, height);
        }, false),
        cornerType: CornerType.MITERED,
        outline: false,
        material: SLICING_GEOMETRY_COLOR.withAlpha(0.2),
        shape: new CallbackProperty(() => {
          // Fixme workaround, see https://github.com/CesiumGS/cesium/issues/12005
          this.viewer.scene.requestRender();
          return [
            Cartesian2.ZERO,
            Cartesian2.ZERO,
            scratchCartesian2,
            new Cartesian2(0, this.bbox!.height),
          ];
        }, false),
      },
    });

    this.modelMatrix = this.slicingBoxEntity!.computeModelMatrix(
      this.julianDate,
    );
    const planes = [...this.sidePlanes];
    if (!this.options.negate) {
      planes.push(...this.zPlanes);
    }
    this.viewer.scene.globe.clippingPlanes = createClippingPlanes(
      planes,
      !this.options.negate,
    );

    executeForAllPrimitives(this.viewer, (primitive) =>
      this.addClippingPlanes(primitive),
    );
    this.syncPlanes();

    if (typeof options.showBox === 'boolean')
      this.toggleBoxVisibility(options.showBox);
    this.viewer.scene.requestRender();
  }

  deactivate() {
    this.options = null;
    this.backPlane = null;
    this.frontPlane = null;
    this.leftPlane = null;
    this.rightPlane = null;
    this.boxCenter = null;
    this.slicerArrows?.hide();
  }

  addClippingPlanes(primitive) {
    const planes = [...this.sidePlanes];
    if (!this.options!.negate) {
      planes.push(...this.zPlanes!);
    }
    if (primitive instanceof VoxelPrimitive && this.options) {
      primitive.clippingPlanes = createClippingPlanes(
        planes,
        !this.options.negate,
      );
    } else if (!primitive.root || !primitive.boundingSphere) return;
    primitive.clippingPlanes = createClippingPlanes(
      planes,
      !this.options!.negate,
    );
    this.syncPlanes();
  }

  updateBoxGlobeClippingPlanes(clippingPlanes) {
    if (!clippingPlanes) return;
    clippingPlanes.removeAll();
    this.sidePlanes.forEach((plane) => clippingPlanes.add(plane));
    if (!this.options!.negate)
      this.zPlanes!.forEach((plane) =>
        clippingPlanes.add(Plane.transform(plane, this.modelMatrix!)),
      );
  }

  updateBoxTileClippingPlanes(primitive: Cesium3DTileset) {
    const clippingPlanes = primitive.clippingPlanes;
    if (!clippingPlanes || !primitive.root) return;
    clippingPlanes.removeAll();
    const shouldNegate = this.options!.negate;
    let modelMatrix: Matrix4;
    if (Matrix4.equals(primitive.root.transform, Matrix4.IDENTITY)) {
      modelMatrix = createCPCModelMatrixFromSphere(primitive);
    } else {
      modelMatrix = Matrix4.inverse(primitive.root.transform, new Matrix4());
    }
    this.planesPositions!.forEach((positions) => {
      const plane = planeFromTwoPoints(positions[0], positions[1], false);
      const p: Plane = Plane.clone(plane);
      Plane.transform(p, modelMatrix, p);
      if (shouldNegate) {
        Cartesian3.negate(p.normal, p.normal);
        p.distance *= -1;
      }
      clippingPlanes.add(p);
    });
    if (!shouldNegate) {
      this.zPlanes!.forEach((plane) => {
        const p: Plane = Plane.clone(plane);
        // @ts-ignore clippingPlanesOriginMatrix is private?
        const toLocalMatrix = Matrix4.inverse(
          primitive.clippingPlanesOriginMatrix,
          new Matrix4(),
        );
        Plane.transform(
          plane,
          Matrix4.multiply(toLocalMatrix, this.modelMatrix!, new Matrix4()),
          p,
        );
        clippingPlanes.add(p);
      });
    }
  }

  onPlaneMove(side, moveAmount, moveVector) {
    const bbox = this.bbox!;
    let shouldBothSidesMove = false;
    const corners = bbox!.corners;
    switch (side) {
      case 'left': {
        shouldBothSidesMove = moveSlicingBoxCorners(
          corners.topLeft,
          corners.bottomLeft,
          corners.topRight,
          corners.bottomRight,
          this.rightPlane!,
          moveVector,
        );
        break;
      }
      case 'right': {
        shouldBothSidesMove = moveSlicingBoxCorners(
          corners.topRight,
          corners.bottomRight,
          corners.topLeft,
          corners.bottomLeft,
          this.leftPlane!,
          moveVector,
        );
        break;
      }
      case 'front': {
        shouldBothSidesMove = moveSlicingBoxCorners(
          corners.topLeft,
          corners.topRight,
          corners.bottomLeft,
          corners.bottomRight,
          this.backPlane!,
          moveVector,
        );
        break;
      }
      case 'back': {
        shouldBothSidesMove = moveSlicingBoxCorners(
          corners.bottomLeft,
          corners.bottomRight,
          corners.topLeft,
          corners.topRight,
          this.frontPlane!,
          moveVector,
        );
        break;
      }
      case 'up':
      case 'down': {
        let boxHeight = bbox.height;
        side === 'down' ? (boxHeight += moveAmount) : (boxHeight -= moveAmount);
        if (boxHeight < SLICING_BOX_MIN_SIZE) {
          side === 'down'
            ? (this.upPlane!.distance -= moveAmount)
            : (this.downPlane!.distance += moveAmount);
          shouldBothSidesMove = true;
        }
        bbox.height =
          boxHeight < SLICING_BOX_MIN_SIZE ? SLICING_BOX_MIN_SIZE : boxHeight;
        bbox.lowerLimit =
          Cartographic.fromCartesian(bbox.center).height - bbox.height / 2;
        side === 'down'
          ? (this.downPlane!.distance += moveAmount)
          : (this.upPlane!.distance -= moveAmount);
        break;
      }
    }
    updateHeightForCartesianPositions(
      Object.values(corners),
      0,
      undefined,
      true,
    );
    bbox.width = Cartesian3.distance(corners.topLeft, corners.bottomLeft);
    bbox.length = Cartesian3.distance(corners.bottomRight, corners.bottomLeft);
    if (!shouldBothSidesMove) {
      Cartesian3.divideByScalar(moveVector, 2, moveVector);
    }
    Cartesian3.add(this.boxCenter!, moveVector, this.boxCenter!);
    this.syncPlanes();
  }

  /**
   * Positioning arrows according to view center
   * @param side
   */
  arrowPositionCallback(side: string): Cartesian3 {
    const boxCenter = Cartographic.fromCartesian(this.boxCenter!);
    const boxHeight = this.bbox!.height;
    const corners = this.bbox!.corners;

    if (side === 'up' || side === 'down') {
      const position = Cartographic.fromCartesian(corners.bottomLeft);
      position.height = side === 'down' ? -(boxHeight / 2) : boxHeight / 2;
      position.height += boxCenter.height;
      return Cartographic.toCartesian(position);
    } else {
      const viewCenter =
        pickCenterOnEllipsoid(this.viewer.scene) || this.boxCenter;
      if (!viewCenter) {
        return Cartesian3.ZERO; // return something
      }
      const heightOffset = 20;
      let height = boxHeight / 2 + heightOffset;
      height = this.viewer.scene.cameraUnderground
        ? boxCenter.height - height
        : boxCenter.height + height;
      const start = 0.05;
      const end = 0.95;
      switch (side) {
        case 'right':
          return projectPointOnSegment(
            viewCenter,
            corners.bottomRight,
            corners.topRight,
            start,
            end,
            height,
          );
        case 'left':
          return projectPointOnSegment(
            viewCenter,
            corners.bottomLeft,
            corners.topLeft,
            start,
            end,
            height,
          );
        case 'back':
          return projectPointOnSegment(
            viewCenter,
            corners.bottomRight,
            corners.bottomLeft,
            start,
            end,
            height,
          );
        case 'front':
          return projectPointOnSegment(
            viewCenter,
            corners.topRight,
            corners.topLeft,
            start,
            end,
            height,
          );
        default:
          return Cartesian3.ZERO; // return something
      }
    }
  }

  syncPlanes() {
    this.updateSidePlanes();
    this.updateBoxGlobeClippingPlanes(this.viewer.scene.globe.clippingPlanes);
    executeForAllPrimitives(this.viewer, (primitive) => {
      if (primitive instanceof VoxelPrimitive && this.options) {
        const clippingPlanes = primitive.clippingPlanes;
        const bbox = this.bbox;
        const options = this.options;
        if (!clippingPlanes || !bbox || !options) return;
        const backPlane = planeFromTwoPoints(
          bbox.corners.bottomLeft,
          bbox.corners.bottomRight,
          !options.negate,
        );
        const frontPlane = planeFromTwoPoints(
          bbox.corners.topRight,
          bbox.corners.topLeft,
          !options.negate,
        );
        const rightPlane = planeFromTwoPoints(
          bbox.corners.bottomRight,
          bbox.corners.topRight,
          !options.negate,
        );
        const leftPlane = planeFromTwoPoints(
          bbox.corners.topLeft,
          bbox.corners.bottomLeft,
          !options.negate,
        );

        clippingPlanes.removeAll();
        [backPlane, leftPlane, frontPlane, rightPlane].forEach((plane) =>
          clippingPlanes.add(plane),
        );
        if (!options.negate) {
          const transform = Matrix4.negate(this.modelMatrix!, new Matrix4());
          this.zPlanes!.forEach((plane) =>
            clippingPlanes.add(Plane.transform(plane, transform)),
          );
        }
      } else if (primitive.root && primitive.boundingSphere) {
        this.updateBoxTileClippingPlanes(primitive);
      }
    });
    this.onBoxPlanesChange();
  }

  updateSidePlanes() {
    const bbox = this.bbox!;
    const options = this.options!;
    this.backPlane = planeFromTwoPoints(
      bbox.corners.bottomLeft,
      bbox.corners.bottomRight,
      options.negate,
    );
    this.frontPlane = planeFromTwoPoints(
      bbox.corners.topRight,
      bbox.corners.topLeft,
      options.negate,
    );
    this.rightPlane = planeFromTwoPoints(
      bbox.corners.bottomRight,
      bbox.corners.topRight,
      options.negate,
    );
    this.leftPlane = planeFromTwoPoints(
      bbox.corners.topLeft,
      bbox.corners.bottomLeft,
      options.negate,
    );
    this.sidePlanes = [
      this.backPlane,
      this.leftPlane,
      this.frontPlane,
      this.rightPlane,
    ];
  }

  toggleBoxVisibility(show) {
    if (!this.slicingBoxEntity) return;
    this.slicingBoxEntity.show = show;
    this.slicerArrows!.toggleArrowsVisibility(show);
    this.onBoxPlanesChange();
    this.viewer.scene.requestRender();
  }

  onBoxPlanesChange() {
    if (!this.options || !this.options.syncBoxPlanesCallback) return;
    const bbox = this.bbox!;
    const boxCenter = Cartographic.fromCartesian(this.boxCenter!);
    const altitude = this.viewer.scene.globe.getHeight(boxCenter) || 0;
    const planesInfo = {
      type: this.options.type,
      slicePoints: Object.values(bbox.corners),
      lowerLimit: boxCenter.height - bbox.height / 2 - altitude,
      height: bbox.height,
      showBox: this.slicingBoxEntity!.show,
      negate: this.options.negate,
    };
    this.options.syncBoxPlanesCallback(planesInfo);
  }
}
