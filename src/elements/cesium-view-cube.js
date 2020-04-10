import {LitElement, css, html} from 'lit-element';

class CesiumViewCube extends LitElement {

  static get properties() {
    return {
      scene: {type: Object}
    };
  }

  static get styles() {
    return css`
      :host * {
        box-sizing: content-box;
      }
      #wrapper {
        width: 100px;
        height: 100px;
      }
      #cube {
        width: 50%;
        height: 50%;
        top: 25%;
        transform-style: preserve-3d;
        margin: auto;
        position: relative;
      }
      #cube > div {
        display: flex;
        justify-content: center;
        align-items: center;
        position: absolute;
        width: 100%;
        height: 100%;
        color: var(--cesium-view-cube-stroke-color);
        background-color: var(--cesium-view-cube-fill-color);
        border: 1px solid var(--cesium-view-cube-stroke-color);
        opacity: var(--cesium-view-cube-opacity);
      }
      #side1 {
        transform: rotatex(90deg) translateZ(25px);
      }
      #side2 {
        transform: rotateY(-90deg) translateZ(25px);
        border-left: 2px solid blue !important;
        border-bottom: 2px solid red !important;
      }
      #side3 {
        transform: translateZ(25px);
      }
      #side4 {
        transform: rotateY(90deg) translateZ(25px);
      }
      #side5 {
        transform: rotateY(180deg) translateZ(25px);
        border-right: 2px solid blue !important;
        border-bottom: 2px solid green !important;
      }
      #side6 {
        transform: rotateX(-90deg) translateZ(25px);
        border-left: 2px solid red !important;
        border-bottom: 2px solid green !important;
      }
    `;
  }


  constructor() {
    super();

    this.unlistenPostRender = null;
  }

  updated() {
    if (this.scene && !this.unlistenPostRender) {
      this.unlistenPostRender = this.scene.postRender.addEventListener(() => this.updateFromCamera());
    }
  }

  disconnectedCallback() {
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
    super.disconnectedCallback();
  }

  updateFromCamera() {
    const element = this.shadowRoot.querySelector('#cube');
    if (element) {
      const camera = this.scene.camera;
      element.style.transform = `rotateX(${camera.pitch}rad) rotateY(${camera.heading}rad)`;
    }
  }

  render() {
    return html`
      <div id="wrapper">
        <div id="cube">
          <div id="side1">top</div>
          <div id="side2">2</div>
          <div id="side3">3</div>
          <div id="side4">4</div>
          <div id="side5">5</div>
          <div id="side6">bottom</div>
        </div>
      </div>
    `;
  }
}

customElements.define('cesium-view-cube', CesiumViewCube);
