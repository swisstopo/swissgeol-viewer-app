import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import CallbackProperty from 'cesium/DataSources/CallbackProperty.js';
import Color from 'cesium/Core/Color.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import PolygonHierarchy from 'cesium/Core/PolygonHierarchy.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Cartographic from 'cesium/Core/Cartographic.js';


/**
 * @typedef {object} Options
 * @property {string} [strokeColor='rgba(0, 153, 255, 0.75)']
 * @property {number} [strokeWidth=4]
 * @property {string} [fillColor='rgba(0, 153, 255, 0.5)']
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

    this.eventHandler_ = undefined;

    this.strokeColor_ = Color.fromCssColorString(options.strokeColor || 'rgba(0, 153, 255, 0.75)');
    this.strokeWidth_ = options.strokeWidth !== undefined ? options.strokeWidth : 4;
    this.fillColor_ = Color.fromCssColorString(options.fillColor || 'rgba(0, 153, 255, 0.5)');

    this.activePoints_ = [];
    this.activeEntity_ = undefined;
    this.floatingPoint_ = undefined;

    this.entities_ = [];
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
      this.eventHandler_.destroy();
      this.eventHandler_ = undefined;
    }
  }

  /**
   *
   */
  finishDrawing() {
    this.activePoints_.pop();
    let positions = this.activePoints_;
    if (this.type === 'point') {
      this.entities_.push(this.drawShape_(this.activePoints_[0]));
    } else if (this.type === 'rectangle') {
      positions = rectanglify(this.activePoints_);
      this.entities_.push(this.drawShape_(positions));
    } else {
      this.entities_.push(this.drawShape_(this.activePoints_));
    }

    this.viewer_.entities.remove(this.floatingPoint_);
    this.viewer_.entities.remove(this.activeEntity_);

    this.dispatchEvent(new CustomEvent('drawend', {
      detail: {
        positions: positions.map(cartesiantoDegrees)
      }
    }));

    this.activePoints_ = [];
    this.activeEntity_ = undefined;
    this.floatingPoint_ = undefined;
  }

  /**
   *
   */
  clear() {
    this.entities_.forEach(entity => this.viewer_.entities.remove(entity));
  }

  drawControlPoint_(position) {
    return this.viewer_.entities.add({
      position: position,
      point: {
        color: Color.WHITE,
        pixelSize: 6,
        heightReference: HeightReference.CLAMP_TO_GROUND
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
        polyline: {
          positions: positions,
          clampToGround: true,
          width: this.strokeWidth_,
          material: this.strokeColor_
        }
      });
    } else if (this.type === 'polygon' || this.type === 'rectangle') {
      return this.viewer_.entities.add({
        polygon: {
          hierarchy: positions,
          material: this.fillColor_
        }
      });
    }
  }

  onLeftClick_(event) {
    const position = this.viewer_.scene.pickPosition(event.position);
    if (position) {
      if (!this.floatingPoint_) {
        this.dispatchEvent(new CustomEvent('drawstart'));
        this.floatingPoint_ = this.drawControlPoint_(position);
        this.activePoints_.push(position);
        const dynamicPositions = new CallbackProperty(() => {
          if (this.type === 'polygon') {
            return new PolygonHierarchy(this.activePoints_);
          } else if (this.type === 'rectangle') {
            return new PolygonHierarchy(rectanglify(this.activePoints_));
          } else {
            return this.activePoints_;
          }
        }, false);
        this.activeEntity_ = this.drawShape_(dynamicPositions);

        if (this.type === 'point') {
          this.activePoints_.push(position);
          this.finishDrawing();
          return;
        }
      }
      this.activePoints_.push(position);
      if (this.type === 'rectangle' && this.activePoints_.length === 4) {
        this.finishDrawing();
      }
    }
  }

  onMouseMove_(event) {
    if (this.floatingPoint_) {
      const position = this.viewer_.scene.pickPosition(event.endPosition);
      if (position) {
        this.floatingPoint_.position.setValue(position);
        this.activePoints_.pop();
        this.activePoints_.push(position);
      }
    }
  }

  onDoubleClick_() {
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
  if (coordinates.length === 3 && !Cartesian3.equals(coordinates[1], coordinates[2])) {
    // A and B are the base of the triangle, C is the point currently moving:
    //
    // A -- AP
    // |\
    // | \
    // |  \
    // |   \
    // M    C
    // |
    // B -- AB

    const A = coordinates[0];
    const B = coordinates[1];
    const C = coordinates[2];

    // create the two vectors from the triangle coordinates
    const AB = Cartesian3.subtract(B, A, scratchAB);
    const AC = Cartesian3.subtract(C, A, scratchAC);

    const AM = Cartesian3.projectVector(AC, AB, scratchAM);

    const AP = Cartesian3.subtract(C, AM, scratchAP);
    const BP = Cartesian3.add(AP, AB, scratchBP);

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
