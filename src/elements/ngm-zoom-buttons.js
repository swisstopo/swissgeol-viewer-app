import {LitElement, html} from 'lit-element';

import Camera from 'cesium/Scene/Camera';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

class NgmZoomButtons extends I18nMixin(LitElement) {

  static get properties() {
    return {
      scene: {type: Object},
      moveAmount: {type: Number}
    };
  }

  constructor() {
    super();

    this.moveAmount = 200;

    this.zoomingIn = false;
    this.zoomingOut = false;

    this.unlistenFromPostRender = null;

    this.stopZoomFunction = this.stopZoom.bind(this);
  }

  updated() {
    if (this.scene && !this.unlistenFromPostRender) {
      this.unlistenFromPostRender = this.scene.postRender.addEventListener(() => {
        const amount = Math.abs(this.scene.camera.positionCartographic.height) / this.moveAmount;
        if (this.zoomingIn) {
          this.scene.camera.moveForward(amount);
        } else if (this.zoomingOut) {
          this.scene.camera.moveBackward(amount);
        }
      });
    }
  }

  connectedCallback() {
    document.addEventListener('pointerup', this.stopZoomFunction);
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (this.unlistenFromPostRender) {
      this.unlistenFromPostRender();
    }
    document.removeEventListener('pointerup', this.stopZoomFunction);
    super.disconnectedCallback();
  }

  startZoomIn(event) {
    this.zoomingIn = true;
    this.scene.requestRender();
    event.preventDefault();
  }

  startZoomOut(event) {
    this.zoomingOut = true;
    this.scene.requestRender();
    event.preventDefault();
  }

  stopZoom() {
    this.zoomingIn = false;
    this.zoomingOut = false;
  }

  flyToHome() {
    this.scene.camera.flyTo({
      destination: Camera.DEFAULT_VIEW_RECTANGLE
    });
  }

  render() {
    if (this.scene) {
      return html`
        <div class="ui vertical compact mini icon buttons">
          <button
          data-tooltip=${i18next.t('zoom_in_btn')}
          data-position="left center"
          data-variation="mini"
          class="ui button"
          @pointerdown="${this.startZoomIn}">
            <i class="plus icon"></i>
          </button>
          <button
          data-tooltip=${i18next.t('reset_view_btn')}
          data-position="left center"
          data-variation="mini"
          class="ui button"
          @click="${this.flyToHome}">
            <i class="home icon"></i>
          </button>
          <button
          data-tooltip=${i18next.t('zoom_out_btn')}
          data-position="left center"
          data-variation="mini"
          class="ui button"
          @pointerdown="${this.startZoomOut}">
            <i class="minus icon"></i>
          </button>
        </div>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-zoom-buttons', NgmZoomButtons);
