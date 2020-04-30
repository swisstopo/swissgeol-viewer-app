import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import CallbackProperty from 'cesium/DataSources/CallbackProperty.js';
import Color from 'cesium/Core/Color.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import PolygonHierarchy from 'cesium/Core/PolygonHierarchy.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Cartographic from 'cesium/Core/Cartographic.js';

// Safari and old versions of Edge are not able to extends EventTarget
import {EventTarget} from 'event-target-shim';
import {getDimensionLabel, getDimensionLabelText} from './helpers.js';

/**
 * @typedef {object} Options
 * @property {string|Color} [strokeColor='rgba(0, 153, 255, 0.75)']
 * @property {number} [strokeWidth=4]
 * @property {string|Color} [fillColor='rgba(0, 153, 255, 0.3)']
 */

export class CesiumDraw extends EventTarget {

  /**
   * @param {import('cesium/Widgets/Viewer/Viewer').default} viewer
   * @param {"point" | "line" | "polygon" | "rectangle"} type
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
    this.activeEntity_ = undefined;
    this.sketchPoint_ = undefined;
    this.sketchLine_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistances_ = [];

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
        this.eventHandler_.setInputAction(this.onLeftClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
        this.eventHandler_.setInputAction(this.onMouseMove_.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this.eventHandler_.setInputAction(this.onDoubleClick_.bind(this), ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
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
      this.entities_.push(this.drawShape_(this.activePoints_[0]));
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

    this.dispatchEvent(new CustomEvent('drawend', {
      detail: {
        positions: positions.map(cartesiantoDegrees),
        dimensionLabel: getDimensionLabelText(this.type, this.activeDistances_)
      }
    }));

    this.removeSketches();
  }

  removeSketches() {
    this.viewer_.entities.remove(this.sketchPoint_);
    this.viewer_.entities.remove(this.sketchLine_);
    this.viewer_.entities.remove(this.activeEntity_);

    this.activePoints_ = [];
    this.activeEntity_ = undefined;
    this.sketchPoint_ = undefined;
    this.sketchLine_ = undefined;
    this.activeDistance_ = 0;
    this.activeDistances_ = [];
  }

  /**
   *
   */
  clear() {
    this.removeSketches();
    this.entities_.forEach(entity => this.viewer_.entities.remove(entity));
  }

  drawSketchPoint_(position) {
    return this.viewer_.entities.add({
      position: position,
      point: {
        color: Color.WHITE,
        pixelSize: 6,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      label: getDimensionLabel(this.type, this.activeDistances_)
    });
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

  dynamicShapePositions() {
    return new CallbackProperty(() => {
      if (this.type === 'polygon') {
        return new PolygonHierarchy(this.activePoints_);
      } else if (this.type === 'rectangle') {
        return new PolygonHierarchy(rectanglify(this.activePoints_));
      } else {
        return this.activePoints_;
      }
    }, false);
  }

  dynamicSketLinePositions() {
    return new CallbackProperty(() => {
      const positions = this.type === 'rectangle' ? rectanglify(this.activePoints_) : this.activePoints_;
      if (positions.length >= 3) {
        // close the polygon
        // FIXME: better memory management
        return [...positions, positions[0]];
      } else {
        return positions;
      }
    }, false);
  }

  updateSketchPoint() {
    const positions = this.type === 'rectangle' ? rectanglify(this.activePoints_) : this.activePoints_;
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
      this.activeDistance_ = Number((distance / 1000).toFixed(2));
      this.sketchPoint_.label.text.setValue(`${this.activeDistance_}km`);
      return;
    }
    this.sketchPoint_.label.text.setValue('0km');
  }

  onLeftClick_(event) {
    const position = this.viewer_.scene.pickPosition(event.position);
    if (position) {
      if (!this.sketchPoint_) {
        this.dispatchEvent(new CustomEvent('drawstart'));
        this.sketchPoint_ = this.drawSketchPoint_(position);
        this.activePoints_.push(position);

        if (this.type === 'polygon' || this.type === 'rectangle') {
          this.sketchLine_ = this.drawSketchLine_(this.dynamicSketLinePositions());
        }

        if (this.type !== 'rectangle') { // disrupts work of size calculation for rectangle
          this.activeEntity_ = this.drawShape_(this.dynamicShapePositions());
        }

        if (this.type === 'point') {
          this.activePoints_.push(position);
          this.finishDrawing();
          return;
        }
      } else if (!this.activeDistances_.includes(this.activeDistance_)) {
        this.activeDistances_.push(this.activeDistance_);
      }
      this.activePoints_.push(position);
      if (this.type === 'rectangle' && this.activePoints_.length === 4) {
        this.finishDrawing();
      }
    }
  }

  onMouseMove_(event) {
    if (this.sketchPoint_) {
      const position = this.viewer_.scene.pickPosition(event.endPosition);
      if (position) {
        this.updateSketchPoint(position);
        this.activePoints_.pop();
        this.activePoints_.push(position);
      }
    }
  }

  onDoubleClick_() {
    if (!this.activeDistances_.includes(this.activeDistance_)) {
      this.activeDistances_.push(this.activeDistance_);
    }
    this.activePoints_.pop();
    this.finishDrawing();
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
 * @param {import('cesium/Core/Cartesian3').default} cartesian
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
