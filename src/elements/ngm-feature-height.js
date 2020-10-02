import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import Cartographic from 'cesium/Source/Core/Cartographic';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';


class NgmFeatureHeight extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      height: {type: Number}
    };
  }

  constructor() {
    super();

    /**
     * @type {import('cesium/Source/Widgets/Viewer/Viewer').default}
     */
    this.viewer;

    this.height = undefined;
    this.eventHandler = undefined;

    this.cameraMoving = false;
    this.unlistenMoveStart = undefined;
    this.unlistenMoveEnd = undefined;

    // always use the 'de-CH' locale to always have the simple tick as thousands separator
    this.integerFormat = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits: 0
    });
  }

  updated() {
    if (this.viewer) {
      if (!this.eventHandler) {
        this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
        this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
      }
      if (!this.unlistenMoveStart && !this.unlistenMoveEnd) {
        this.unlistenMoveStart = this.viewer.camera.moveStart.addEventListener(() => this.cameraMoving = true);
        this.unlistenMoveEnd = this.viewer.camera.moveEnd.addEventListener(() => this.cameraMoving = false);
      }
    }
  }

  disconnectedCallback() {
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = undefined;
    }
    if (this.unlistenMoveStart && this.unlistenMoveEnd) {
      this.unlistenMoveStart();
      this.unlistenMoveStart = undefined;
      this.unlistenMoveEnd();
      this.unlistenMoveEnd = undefined;
    }
    super.disconnectedCallback();
  }

  onMouseMove(movement) {
    if (!this.cameraMoving) {
      const feature = this.viewer.scene.pick(movement.endPosition);
      if (feature) {
        const cartesian = this.viewer.scene.pickPosition(movement.endPosition);
        if (cartesian) {
          const position = Cartographic.fromCartesian(cartesian);
          const altitude = this.viewer.scene.globe.getHeight(position);
          if (altitude !== undefined) {
            this.height = position.height - altitude;
            return;
          }
        }
      }
    }
    this.height = undefined;
  }

  render() {
    if (this.height !== undefined) {
      return html`
        ${i18next.t('nav_object_height_label')}: ${this.integerFormat.format(this.height)} m
      `;
    } else {
      return html``;
    }
  }
}

customElements.define('ngm-feature-height', NgmFeatureHeight);
