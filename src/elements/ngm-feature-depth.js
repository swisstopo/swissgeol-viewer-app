import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';


class NgmFeatureDepth extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      depth: {type: Number}
    };
  }

  constructor() {
    super();

    this.depth = undefined;
    this.eventHandler = undefined;

    // always use the 'de-CH' locale to always have the simple tick as thousands separator
    this.integerFormat = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits: 0
    });
  }

  updated() {
    if (this.viewer && !this.eventHandler) {
      this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
      this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
    }
  }

  disconnectedCallback() {
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = undefined;
    }
    super.disconnectedCallback();
  }

  onMouseMove(movement) {
    const feature = this.viewer.scene.pick(movement.endPosition);
    if (feature) {
      // FIXME: validate this !
      const position = Cartographic.fromCartesian(this.viewer.scene.pickPosition(movement.endPosition));
      const altitude = this.viewer.scene.globe.getHeight(position);
      this.depth = altitude - position.height;
    } else {
      this.depth = undefined;
    }
  }

  render() {
    if (this.depth !== undefined) {
      return html`
        ${i18next.t('Depth')}: ${this.integerFormat.format(this.depth)} m
      `;
    } else {
      return html``;
    }
  }
}

customElements.define('ngm-feature-depth', NgmFeatureDepth);
