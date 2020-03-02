import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import CallbackProperty from 'cesium/DataSources/CallbackProperty.js';
import Color from 'cesium/Core/Color.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import PolygonHierarchy from 'cesium/Core/PolygonHierarchy.js';

/**
 * @typedef {object} Options
 * @property {string} [strokeColor='rgba(0, 153, 255, 0.75)']
 * @property {number} [strokeWidth=4]
 * @property {string} [fillColor='rgba(0, 153, 255, 0.5)']
 */

export class CesiumDraw extends EventTarget {

  /**
   * @param {import('cesium/Widgets/Viewer/Viewer').default} viewer
   * @param {"line" | "polygon"} type
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
      this.eventHandler_ = new ScreenSpaceEventHandler(this.viewer_.canvas);
      this.eventHandler_.setInputAction(this.onLeftClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
      this.eventHandler_.setInputAction(this.onMouseMove_.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler_.setInputAction(this.onDoubleClick_.bind(this), ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
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
    this.entities_.push(this.drawShape_(this.activePoints_));
    this.viewer_.entities.remove(this.floatingPoint_);
    this.viewer_.entities.remove(this.activeEntity_);

    this.dispatchEvent(new CustomEvent('drawend', {
      detail: {
        positions: this.activePoints_
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

  createPoint_(position) {
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
    if (this.type === 'line') {
      return this.viewer_.entities.add({
        polyline: {
          positions: positions,
          clampToGround: true,
          width: this.strokeWidth_,
          material: this.strokeColor_
        }
      });
    } else if (this.type === 'polygon') {
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
        this.floatingPoint_ = this.createPoint_(position);
        this.activePoints_.push(position);
        const dynamicPositions = new CallbackProperty(() => {
          if (this.type === 'polygon') {
            return new PolygonHierarchy(this.activePoints_);
          } else {
            return this.activePoints_;
          }
        }, false);
        this.activeEntity_ = this.drawShape_(dynamicPositions);
      }
      this.activePoints_.push(position);
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
