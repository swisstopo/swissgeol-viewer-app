import {LitElement, html} from 'lit-element';

import Camera from 'cesium/Scene/Camera';

class NgmZoomButtons extends LitElement {

  static get properties() {
    return {
      scene: {type: Object},
      moveAmount: {type: Number}
    };
  }

  constructor() {
    super();

    this.moveAmount = 125;

    this.zoomingIn = false;
    this.zoomingOut = false;

    this.unlistenFromPostRender = null;
  }

  updated() {
    if (this.scene && !this.unlistenFromPostRender) {
      this.unlistenFromPostRender = this.scene.postRender.addEventListener(() => {
        if (this.zoomingIn) {
          this.scene.camera.moveForward(this.moveAmount);
        } else if (this.zoomingOut) {
          this.scene.camera.moveBackward(this.moveAmount);
        }
      });
    }
  }

  disconnectedCallback() {
    if (this.unlistenFromPostRender) {
      this.unlistenFromPostRender();
    }
    super.disconnectedCallback();
  }

  startZoomIn() {
    this.zoomingIn = true;
    this.scene.requestRender();
  }

  stopZoomIn(event) {
    this.zoomingIn = false;
    event.target.blur();
  }

  startZoomOut() {
    this.zoomingOut = true;
    this.scene.requestRender();
  }

  stopZoomOut(event) {
    this.zoomingOut = false;
    event.target.blur();
  }

  flyToHome(event) {
    this.scene.camera.flyTo({
      destination: Camera.DEFAULT_VIEW_RECTANGLE
    });
  }

  render() {
    if (this.scene) {
      return html`
        <div class="ui vertical compact mini icon buttons">
          <button class="ui button" @pointerdown="${this.startZoomIn}" @pointerup="${this.stopZoomIn}">
            <i class="plus icon"></i>
          </button>
          <button class="ui button" @click="${this.flyToHome}">
            <i class="home icon"></i>
          </button>
          <button class="ui button" @pointerdown="${this.startZoomOut}" @pointerup="${this.stopZoomOut}">
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
