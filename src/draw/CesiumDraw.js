import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Color from 'cesium/Source/Core/Color';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Cartographic from 'cesium/Source/Core/Cartographic';
import JulianDate from 'cesium/Source/Core/JulianDate';

// Safari and old versions of Edge are not able to extends EventTarget
import {EventTarget} from 'event-target-shim';
import {getDimensionLabel} from './helpers.js';
import {getMeasurements} from '../utils.js';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {getLinesIntersection} from '../utils';

/**
 * @typedef {"point" | "line" | "polygon" | "rectangle"} ShapeType
 */

/**
 * @typedef {object} Options
 * @property {string|Color} [strokeColor='rgba(0, 153, 255, 0.75)']
 * @property {number} [strokeWidth=4]
 * @property {string|Color} [fillColor='rgba(0, 153, 255, 0.3)']
 */

export class CesiumDraw extends EventTarget {

  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   * @param {ShapeType} type
   * @param {Options} [options]
   */
  constructor(viewer, type, options = {}) {
    super();
    this.viewer_ = viewer;
    this.type = type;
    this.julianDate = new JulianDate();

    this.drawingDataSource = new CustomDataSource('drawing');
    this.viewer_.dataSources.add(this.drawingDataSource);

    this.strokeColor_ = options.strokeColor instanceof Color ?
      options.strokeColor : Color.fromCssColorString(options.strokeColor || 'rgba(0, 153, 255, 0.75)');
    this.strokeWidth_ = options.strokeWidth !== undefined ? options.strokeWidth : 4;
    this.fillColor_ = options.fillColor instanceof Color ?
      options.fillColor : Color.fromCssColorString(options.fillColor || 'rgba(0, 153, 255, 0.3)');

    this.eventHandler_ = undefined;
    this.activePoints_ = [];
    this.activePoint_ = undefined;
    this.activeEntity_ = undefined;
    this.sketchPoint_ = undefined;
    this.sketchLine_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistances_ = [];
    this.entityForEdit = undefined;
    this.leftPressedPixel_ = undefined;
    this.moveEntity = false;
    this.sketchPoints_ = [];

    this.entities_ = [];

    this.ERROR_TYPES = {needMorePoints: 'need_more_points'};
  }

  renderSceneIfTranslucent() {
    // because calling render decreases performance, only call it when needed.
    // see https://cesium.com/docs/cesiumjs-ref-doc/Scene.html#pickTranslucentDepth
    if (this.viewer_.scene.globe.translucency.enabled) {
      this.viewer_.scene.render();
    }
  }

  /**
   *
   */
  get active() {
    return this.eventHandler_ !== undefined;
  }

  /**
   *
   */
  set active(value) {
    if (value) {
      if (!this.eventHandler_) {
        this.eventHandler_ = new ScreenSpaceEventHandler(this.viewer_.canvas);
        if (this.entityForEdit) {
          this.activateEditing();
        } else {
          this.eventHandler_.setInputAction(this.onLeftClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
          this.eventHandler_.setInputAction(this.onDoubleClick_.bind(this), ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        this.eventHandler_.setInputAction(this.onMouseMove_.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
      }
    } else {
      if (this.eventHandler_) {
        this.eventHandler_.destroy();
      }
      this.eventHandler_ = undefined;
    }
    this.dispatchEvent(new CustomEvent('statechanged'));
  }

  activateEditing() {
    this.eventHandler_.setInputAction(event => this.onLeftDown_(event), ScreenSpaceEventType.LEFT_DOWN);
    this.eventHandler_.setInputAction(event => this.onLeftUp_(event), ScreenSpaceEventType.LEFT_UP);
    let positions = [];
    switch (this.type) {
      case 'line':
        positions = [...this.entityForEdit.polyline.positions.getValue()];
        break;
      case 'polygon':
        positions = [...this.entityForEdit.polygon.hierarchy.getValue().positions];
        break;
      case 'rectangle':
        positions = [...this.entityForEdit.polygon.hierarchy.getValue().positions];
        this.drawingDataSource.entities.add({
          position: new CallbackProperty(() => {
            positions = this.activePoints_.length ? this.activePoints_ : positions;
            return Cartesian3.midpoint(positions[0], positions[1], new Cartesian3());
          }, false),
          billboard: {
            image: './images/rotate-icon.svg',
            scale: 0.15,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: {
            type: 'rotate'
          }
        });
        break;
      default:
        break;
    }
    positions.forEach((p, idx) => {
      this.activePoints_.push(p);
      const sketchPoint = this.createSketchPoint_(p, {edit: true, positionIndex: idx});
      sketchPoint.properties.index = idx;
      this.sketchPoints_.push(sketchPoint);
    });
    this.viewer_.scene.requestRender();
  }

  /**
   *
   */
  finishDrawing() {
    this.activePoints_.pop();
    let positions = this.activePoints_;
    if ((this.type === 'polygon' || this.type === 'rectangle') && positions.length < 3) {
      this.dispatchEvent(new CustomEvent('drawerror', {
        detail: {
          error: this.ERROR_TYPES.needMorePoints
        }
      }));
      return;
    }
    if (this.type === 'point') {
      positions.push(this.activePoint_);
      this.entities_.push(this.drawShape_(this.activePoint_));
    } else if (this.type === 'rectangle') {
      positions = rectanglify(this.activePoints_);
      this.entities_.push(this.drawShape_(positions));
    } else {
      if (this.type === 'polygon') {
        const distance = Cartesian3.distance(this.activePoints_[this.activePoints_.length - 1], this.activePoints_[0]);
        this.activeDistances_.push(distance / 1000);
      }
      this.entities_.push(this.drawShape_(this.activePoints_));
    }
    this.viewer_.scene.requestRender();

    const measurements = getMeasurements(positions, this.activeDistances_, this.type);
    this.dispatchEvent(new CustomEvent('drawend', {
      detail: {
        positions: positions.map(cartesiantoDegrees),
        type: this.type,
        measurements: measurements
      }
    }));

    this.removeSketches();
  }

  removeSketches() {
    this.drawingDataSource.entities.removeAll();

    this.activePoints_ = [];
    this.activePoint_ = undefined;
    this.activeEntity_ = undefined;
    this.sketchPoint_ = undefined;
    this.sketchLine_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistances_ = [];
    this.entityForEdit = undefined;
    this.leftPressedPixel_ = undefined;
    this.moveEntity = false;
    this.sketchPoints_ = [];
  }

  /**
   *
   */
  clear() {
    this.removeSketches();
  }

  createSketchPoint_(position, options = {}) {
    const entity = {
      position: position,
      point: {
        color: Color.WHITE,
        outlineWidth: 1,
        outlineColor: Color.BLACK,
        pixelSize: options.edit ? 7 : 5,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      properties: {}
    };
    if (options.edit) {
      entity.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    } else {
      entity.label = getDimensionLabel(this.type, this.activeDistances_);
    }
    return this.drawingDataSource.entities.add(entity);
  }

  createSketchLine_(positions) {
    return this.drawingDataSource.entities.add({
      polyline: {
        positions: positions,
        clampToGround: true,
        width: this.strokeWidth_,
        material: this.strokeColor_
      }
    });
  }

  drawShape_(positions) {
    if (this.type === 'point') {
      return this.drawingDataSource.entities.add({
        position: positions,
        point: {
          color: this.fillColor_,
          outlineWidth: 2,
          outlineColor: this.strokeColor_,
          pixelSize: this.strokeWidth_,
          heightReference: HeightReference.CLAMP_TO_GROUND
        }
      });

    } else if (this.type === 'line') {
      return this.drawingDataSource.entities.add({
        position: positions[positions.length - 1],
        polyline: {
          positions: positions,
          clampToGround: true,
          width: this.strokeWidth_,
          material: this.strokeColor_
        },
        label: getDimensionLabel(this.type, this.activeDistances_)
      });
    } else if (this.type === 'polygon' || this.type === 'rectangle') {
      return this.drawingDataSource.entities.add({
        position: positions[positions.length - 1],
        polygon: {
          hierarchy: positions,
          material: this.fillColor_
        },
        label: getDimensionLabel(this.type, this.activeDistances_)
      });
    }
  }

  dynamicSketLinePositions() {
    return new CallbackProperty(() => {
      const activePoints = [...this.activePoints_, this.activePoint_];
      const positions = this.type === 'rectangle' ? rectanglify(activePoints) : activePoints;
      if (this.type === 'rectangle' && activePoints.length === 4) { // to avoid showing of confusing lines
        return [];
      }
      if (positions.length >= 3 && this.type !== 'line') {
        // close the polygon
        // FIXME: better memory management
        return [...positions, positions[0]];
      } else {
        return positions;
      }
    }, false);
  }

  updateSketchPoint() {
    const activePoints = [...this.activePoints_, this.activePoint_];
    const positions = this.type === 'rectangle' ? rectanglify(activePoints) : activePoints;
    const pointsLength = positions.length;
    if (pointsLength > 1) {
      let distance;
      if (this.type === 'rectangle' && pointsLength > 2) {
        const b = positions[1]; //according to rectanglify
        const bp = positions[2];
        distance = Cartesian3.distance(b, bp);
        this.sketchPoint_.position.setValue(bp);
      } else {
        const lastPoint = positions[pointsLength - 1];
        distance = Cartesian3.distance(positions[pointsLength - 2], lastPoint);
        this.sketchPoint_.position.setValue(lastPoint);
      }
      this.activeDistance_ = distance / 1000;
      this.sketchPoint_.label.text.setValue(`${this.activeDistance_.toFixed(3)}km`);
      return;
    }
    this.sketchPoint_.label.text.setValue('0km');
  }

  onLeftClick_(event) {
    this.renderSceneIfTranslucent();
    const position = Cartesian3.clone(this.viewer_.scene.pickPosition(event.position));
    if (position) {
      if (!this.sketchPoint_) {
        this.dispatchEvent(new CustomEvent('drawstart'));
        this.sketchPoint_ = this.createSketchPoint_(position);
        this.activePoint_ = position;

        this.sketchLine_ = this.createSketchLine_(this.dynamicSketLinePositions());

        if (this.type === 'point') {
          this.activePoints_.push(position);
          this.finishDrawing();
          return;
        }
      } else if (!this.activeDistances_.includes(this.activeDistance_)) {
        this.activeDistances_.push(this.activeDistance_);
      }
      this.activePoints_.push(Cartesian3.clone(this.activePoint_));
      if (this.type === 'rectangle' && this.activePoints_.length === 4) {
        this.finishDrawing();
      }
    }
  }

  updateRectCorner(corner, oppositePoint, midPoint, midPointPrev, midScale, negate) {
    let midDiff = Cartesian3.subtract(corner, midPointPrev, new Cartesian3());
    midDiff = Cartesian3.multiplyByScalar(midDiff, midScale, new Cartesian3());
    const positionFromMid = Cartesian3.add(midPoint, midDiff, new Cartesian3());

    const distancePrev = Cartesian3.distance(corner, oppositePoint);
    const distanceCurrent = Cartesian3.distance(positionFromMid, oppositePoint);
    const distanceScale = distanceCurrent / distancePrev;
    let distanceDiff = Cartesian3.subtract(corner, oppositePoint, new Cartesian3());

    distanceDiff = Cartesian3.multiplyByScalar(distanceDiff, distanceScale, new Cartesian3());
    let newCornerPosition = Cartesian3.add(oppositePoint, distanceDiff, new Cartesian3());
    if (negate) {
      distanceDiff = Cartesian3.negate(distanceDiff, new Cartesian3());
      newCornerPosition = Cartesian3.add(oppositePoint, distanceDiff, new Cartesian3());
    }
    return newCornerPosition;
  }

  rotateRectangle(angle) {
    const positions = [...this.activePoints_];
    const center = Cartesian3.midpoint(positions[0], positions[2], new Cartesian3());
    let skipUpdate = false;

    positions.forEach((pos, indx) => {
      const position2d = this.viewer_.scene.cartesianToCanvasCoordinates(pos);
      const center2d = this.viewer_.scene.cartesianToCanvasCoordinates(center);
      const xDiff = position2d.x - center2d.x;
      const yDiff = position2d.y - center2d.y;

      const x = Math.cos(angle) * xDiff - Math.sin(angle) * yDiff + center2d.x;
      const y = Math.sin(angle) * xDiff + Math.cos(angle) * yDiff + center2d.y;
      const rotatedPoint = this.viewer_.scene.pickPosition(new Cartesian2(x, y));
      if (rotatedPoint) {
        positions[indx] = rotatedPoint;
      } else {
        skipUpdate = true;
      }
    });
    positions[0] = this.getCorrectRectCorner(positions[0], positions[2], positions[1], positions[3]);
    positions[0] = this.getCorrectRectCorner(positions[0], positions[2], positions[3], positions[1]);

    if (!skipUpdate) {
      this.sketchPoints_.forEach((sp, key) => {
        sp.position = positions[key];
        this.activePoints_[key] = positions[key];
      });
      this.entityForEdit.polygon.hierarchy = {positions};
    }
  }

  onMouseMove_(event) {
    this.renderSceneIfTranslucent();
    const position = Cartesian3.clone(this.viewer_.scene.pickPosition(event.endPosition));
    if (!position) return;
    if (this.entityForEdit && !!this.leftPressedPixel_) {
      if (this.moveEntity) {
        if (this.type === 'point') {
          this.entityForEdit.position = position;
        } else {
          const pointProperties = this.sketchPoint_.properties;
          const index = pointProperties.index;
          let prevPosition = new Cartesian3();
          if (typeof index === 'number') {
            this.sketchPoint_.position = position;
            prevPosition = Cartesian3.clone(this.activePoints_[index]);
            this.activePoints_[index] = position;
          }
          if (this.type === 'line') {
            this.entityForEdit.polyline.positions = this.activePoints_;
          } else {
            const positions = this.activePoints_;
            if (this.type === 'rectangle') {
              if (pointProperties.type && pointProperties.type.getValue() === 'rotate') {
                const center = Cartesian3.midpoint(positions[0], positions[2], new Cartesian3());
                const oldPosition = this.sketchPoint_.position.getValue();
                const vect1 = Cartesian3.subtract(center, oldPosition, new Cartesian3());
                const vect2 = Cartesian3.subtract(center, position, new Cartesian3());
                const dist0 = Cartesian3.distance(positions[0], position);
                const dist1 = Cartesian3.distance(positions[1], position);
                const negate = dist0 > dist1;
                let angle = Cartesian3.angleBetween(vect1, vect2);
                angle = negate ? -angle : angle;
                this.rotateRectangle(angle);
                return;
              }
              const oppositeIndex = index > 1 ? index - 2 : index + 2;
              const leftIndex = index - 1 < 0 ? 3 : index - 1;
              const rightIndex = index + 1 > 3 ? 0 : index + 1;
              let draggedPoint = positions[index];
              const oppositePoint = positions[oppositeIndex];
              let leftPoint = positions[leftIndex];
              let rightPoint = positions[rightIndex];

              const midPoint = Cartesian3.midpoint(draggedPoint, oppositePoint, new Cartesian3());
              const midPointPrev = Cartesian3.midpoint(prevPosition, oppositePoint, new Cartesian3());
              const midDist = Cartesian3.distance(draggedPoint, midPoint);
              const midDistPrev = Cartesian3.distance(prevPosition, midPointPrev);
              const midScale = midDist / midDistPrev;

              const draggedPoint2D = this.viewer_.scene.cartesianToCanvasCoordinates(draggedPoint);
              const rightPoint2D = this.viewer_.scene.cartesianToCanvasCoordinates(rightPoint);
              const leftPoint2D = this.viewer_.scene.cartesianToCanvasCoordinates(leftPoint);
              const oppositePoint2D = this.viewer_.scene.cartesianToCanvasCoordinates(oppositePoint);

              const negateRight = !!getLinesIntersection(draggedPoint2D, rightPoint2D, leftPoint2D, oppositePoint2D);
              const negateLeft = !!getLinesIntersection(draggedPoint2D, leftPoint2D, rightPoint2D, oppositePoint2D);
              leftPoint = this.updateRectCorner(leftPoint, oppositePoint, midPoint, midPointPrev, midScale, negateLeft);
              rightPoint = this.updateRectCorner(rightPoint, oppositePoint, midPoint, midPointPrev, midScale, negateRight);

              draggedPoint = this.getCorrectRectCorner(draggedPoint, oppositePoint, leftPoint, rightPoint);
              draggedPoint = this.getCorrectRectCorner(draggedPoint, oppositePoint, rightPoint, leftPoint);

              positions[index] = draggedPoint;
              this.activePoints_[index] = draggedPoint;
              positions[leftIndex] = leftPoint;
              positions[rightIndex] = rightPoint;
              this.sketchPoints_.forEach((sp, key) => {
                sp.position = positions[key];
              });
            }
            this.entityForEdit.polygon.hierarchy = {positions};
          }
        }
      }
    } else if (this.sketchPoint_) {
      this.activePoint_ = position;
      this.updateSketchPoint();
    }
  }

  onDoubleClick_() {
    if (!this.activeDistances_.includes(this.activeDistance_)) {
      this.activeDistances_.push(this.activeDistance_);
    }
    this.finishDrawing();
  }

  /**
   * Enables moving of point geometry or one of the sketch points for other geometries if left mouse button pressed on it
   * @param event
   * @private
   */
  onLeftDown_(event) {
    this.leftPressedPixel_ = Cartesian2.clone(event.position);
    if (this.entityForEdit) {
      const objects = this.viewer_.scene.drillPick(event.position, 5, 5, 5);
      if (objects.length) {
        const selectedPoint = objects.find(obj => !!obj.id.point || !!obj.id.billboard);
        if (!selectedPoint) return;
        const selectedEntity = selectedPoint.id;
        this.sketchPoint_ = selectedEntity;
        const properties = selectedEntity.properties;
        // checks if picked entity is point geometry or one of the sketch points for other geometries
        this.moveEntity = selectedEntity.id === this.entityForEdit.id ||
          !!this.sketchPoints_.some(sp => sp.id === selectedEntity.id) ||
          (properties && properties.type && properties.type.getValue() === 'rotate');
      }
      if (this.moveEntity) {
        this.viewer_.scene.screenSpaceCameraController.enableInputs = false;
      }
    }
    this.dispatchEvent(new CustomEvent('leftdown'));
  }

  /**
   * @param event
   */
  onLeftUp_(event) {
    this.viewer_.scene.screenSpaceCameraController.enableInputs = true;
    const wasAClick = Cartesian2.equalsEpsilon(event.position, this.leftPressedPixel_, 0, 2);
    if (wasAClick) {
      this.onLeftDownThenUp_(event);
    }
    this.moveEntity = false;
    this.leftPressedPixel_ = undefined;
    this.sketchPoint_ = undefined;
    this.dispatchEvent(new CustomEvent('leftup'));
  }

  /**
   * @param event
   */
  onLeftDownThenUp_(event) {
    const e = this.entityForEdit;
    if (this.sketchPoint_ && this.sketchPoint_.properties.index !== undefined) {
      switch (this.type) {
        case 'polygon': {
          const hierarchy = e.polygon.hierarchy.getValue();
          if (hierarchy.positions.length <= 3) {
            return;
          }
          hierarchy.positions.splice(this.sketchPoint_.properties.index, 1);
          e.polygon.hierarchy.setValue({...hierarchy});
          break;
        }
        case 'line': {
          const pPositions = e.polyline.positions.getValue();
          if (pPositions.length <= 2) {
            return;
          }
          pPositions.splice(this.sketchPoint_.properties.index, 1);
          e.polyline.positions = pPositions;
          break;
        }
        default:
          break;
      }
      if (this.type !== 'rectangle') {
        // a sketch point was clicked => remove it
        this.sketchPoints_.splice(this.sketchPoint_.properties.index, 1);
        this.sketchPoints_.forEach((sp, idx) => sp.properties.index = idx);
        this.drawingDataSource.entities.remove(this.sketchPoint_);
        this.viewer_.scene.requestRender();
      }
    }
  }

  getCorrectRectCorner(corner, oppositePoint, checkPoint1, checkPoint2) {
    const distance = Cartesian3.distance(checkPoint1, oppositePoint);
    const newDistance = Cartesian3.distance(corner, checkPoint2);
    const dScale = distance / newDistance;
    let dDiff = Cartesian3.subtract(corner, checkPoint2, new Cartesian3());
    dDiff = Cartesian3.multiplyByScalar(dDiff, dScale, new Cartesian3());
    return Cartesian3.add(checkPoint2, dDiff, new Cartesian3());
  }
}

const scratchAB = new Cartesian3();
const scratchAC = new Cartesian3();
const scratchAM = new Cartesian3();
const scratchAP = new Cartesian3();
const scratchBP = new Cartesian3();

function rectanglify(coordinates) {
  if (coordinates.length === 3) {
    // A and B are the base of the triangle, C is the point currently moving:
    //
    // A -- AP
    // |\
    // | \
    // |  \
    // |   \
    // M    C
    // |
    // B -- BP

    const A = coordinates[0];
    const B = coordinates[1];
    const C = coordinates[2];

    // create the two vectors from the triangle coordinates
    const AB = Cartesian3.subtract(B, A, scratchAB);
    const AC = Cartesian3.subtract(C, A, scratchAC);

    const AM = Cartesian3.projectVector(AC, AB, scratchAM);

    const AP = Cartesian3.subtract(C, AM, scratchAP).clone();
    const BP = Cartesian3.add(AP, AB, scratchBP).clone();

    // FIXME: better memory management
    return [A, B, BP, AP];
  } else {
    return coordinates;
  }
}


/**
 * @param {import('cesium/Source/Core/Cartesian3').default} cartesian
 * @return {Array<number>}
 */
function cartesiantoDegrees(cartesian) {
  const cartographic = Cartographic.fromCartesian(cartesian);
  return [
    cartographic.longitude * 180 / Math.PI,
    cartographic.latitude * 180 / Math.PI,
    cartographic.height
  ];
}
