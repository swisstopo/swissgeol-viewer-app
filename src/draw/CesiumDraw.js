import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty';
import Color from 'cesium/Source/Core/Color';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';

// Safari and old versions of Edge are not able to extends EventTarget
import {EventTarget} from 'event-target-shim';
import {getDimensionLabel} from './helpers.js';
import {getMeasurements} from '../utils.js';

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
    this.leftPressed = false;
    this.moveEntity = false;
    this.sketchPoints_ = [];

    this.entities_ = [];

    this.ERROR_TYPES = {needMorePoints: 'need_more_points'};
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
          this.eventHandler_.setInputAction(event => this.onLeftDown_(event), ScreenSpaceEventType.LEFT_DOWN);
          this.eventHandler_.setInputAction(event => this.onLeftUp_(event), ScreenSpaceEventType.LEFT_UP);
          if (this.type !== 'point') {
            let positions = this.entityForEdit.polygon ?
              this.entityForEdit.polygon.hierarchy.getValue().positions :
              this.entityForEdit.polyline.positions.getValue();
            if (this.type === 'rectangle') {
              positions = positions.slice(0, 3);
            }
            positions.forEach((p, key) => {
              this.activePoints_.push(p);
              const sketchPoint = this.drawSketchPoint_(p, true);
              sketchPoint.properties.index = key;
              this.sketchPoints_.push(sketchPoint);
            });
            this.viewer_.scene.requestRender();
          }
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
    this.viewer_.entities.remove(this.sketchPoint_);
    this.viewer_.entities.remove(this.sketchLine_);
    this.viewer_.entities.remove(this.activeEntity_);

    this.activePoints_ = [];
    this.activePoint_ = undefined;
    this.activeEntity_ = undefined;
    this.sketchPoint_ = undefined;
    this.sketchLine_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistances_ = [];
    this.entityForEdit = undefined;
    this.leftPressed = false;
    this.moveEntity = false;
    this.sketchPoints_.forEach(sp => this.viewer_.entities.remove(sp));
    this.sketchPoints_ = [];
  }

  /**
   *
   */
  clear() {
    this.removeSketches();
    this.entities_.forEach(entity => this.viewer_.entities.remove(entity));
  }

  drawSketchPoint_(position, edit = false) {
    const entity = {
      position: position,
      point: {
        color: Color.WHITE,
        outlineWidth: 1,
        outlineColor: Color.BLACK,
        pixelSize: edit ? 7 : 5,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      properties: {}
    };
    if (!edit) {
      entity.label = getDimensionLabel(this.type, this.activeDistances_);
    } else {
      entity.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    }
    return this.viewer_.entities.add(entity);
  }

  drawSketchLine_(positions) {
    return this.viewer_.entities.add({
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
      return this.viewer_.entities.add({
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
      return this.viewer_.entities.add({
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
      return this.viewer_.entities.add({
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
    const position = Cartesian3.clone(this.viewer_.scene.pickPosition(event.position));
    if (position) {
      if (!this.sketchPoint_) {
        this.dispatchEvent(new CustomEvent('drawstart'));
        this.sketchPoint_ = this.drawSketchPoint_(position);
        this.activePoint_ = position;

        this.sketchLine_ = this.drawSketchLine_(this.dynamicSketLinePositions());

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

  onMouseMove_(event) {
    const position = Cartesian3.clone(this.viewer_.scene.pickPosition(event.endPosition));
    if (!position) return;
    if (this.entityForEdit && this.leftPressed) {
      if (this.moveEntity) {
        if (this.type === 'point') {
          this.entityForEdit.position = position;
        } else {
          this.sketchPoint_.position = position;
          this.activePoints_[this.sketchPoint_.properties.index] = position;
          if (this.type === 'line') {
            this.entityForEdit.polyline.positions = this.activePoints_;
          } else {
            const hierarchy = this.entityForEdit.polygon.hierarchy.getValue();
            let positions = this.activePoints_;
            if (this.type === 'rectangle') {
              positions = rectanglify(this.activePoints_).map(p => Cartesian3.clone(p));
              this.sketchPoints_.forEach((sp, key) => {
                sp.position = positions[key];
              });
            }
            this.entityForEdit.polygon.hierarchy = {...hierarchy, positions};
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

  onLeftDown_(event) {
    this.leftPressed = true;
    if (this.entityForEdit) {
      const objects = this.viewer_.scene.drillPick(event.position, 5, 5, 5);
      if (objects.length) {
        const selectedPoint = objects.find(obj => !!obj.id.point);
        if (!selectedPoint) return;
        const selectedEntity = selectedPoint.id;
        this.sketchPoint_ = selectedEntity;
        this.moveEntity = selectedEntity.id === this.entityForEdit.id ||
          this.sketchPoints_.some(sp => sp.id === selectedEntity.id);
      }
      if (this.moveEntity) {
        this.viewer_.scene.screenSpaceCameraController.enableInputs = false;
      }
    }
    this.dispatchEvent(new CustomEvent('leftdown'));
  }

  onLeftUp_() {
    this.viewer_.scene.screenSpaceCameraController.enableInputs = true;
    this.moveEntity = false;
    this.leftPressed = false;
    this.sketchPoint_ = undefined;
    this.dispatchEvent(new CustomEvent('leftup'));
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

    const AP = Cartesian3.subtract(C, AM, scratchAP);
    const BP = Cartesian3.add(AP, AB, scratchBP);

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
