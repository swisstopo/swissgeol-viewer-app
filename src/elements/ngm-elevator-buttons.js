import {LitElement, html} from 'lit-element';

import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import {setCameraHeight} from '../utils.js';

class NgmElevatorButtons extends I18nMixin(LitElement) {

  static get properties() {
    return {
      scene: {type: Object},
      moveAmount: {type: Number}
    };
  }

  constructor() {
    super();

    /**
     * @type {import('cesium/Source/Scene/Scene').default}
     */
    this.scene;

    this.moveAmount = 200;

    this.movingUp = false;
    this.movingDown = false;

    this.unlistenFromPostRender = null;
    this.stopElevatorFunction = this.stopElevator.bind(this);
  }

  updated() {
    if (this.scene && !this.unlistenFromPostRender) {
      this.unlistenFromPostRender = this.scene.postRender.addEventListener(() => {
        const amount = Math.abs(this.scene.camera.positionCartographic.height) / this.moveAmount;
        if (this.movingUp) {
          setCameraHeight(this.scene.camera, this.scene.camera.positionCartographic.height + amount);
        } else if (this.movingDown) {
          setCameraHeight(this.scene.camera, this.scene.camera.positionCartographic.height - amount);
        }
      });
    }
  }

  connectedCallback() {
    document.addEventListener('pointerup', this.stopElevatorFunction);
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (this.unlistenFromPostRender) {
      this.unlistenFromPostRender();
    }
    document.removeEventListener('pointerup', this.stopElevatorFunction);
    super.disconnectedCallback();
  }

  /**
   * @param {PointerEvent} event
   */
  startMovingUp(event) {
    this.movingUp = true;
    this.scene.requestRender();
    event.preventDefault();
  }

  /**
   * @param {PointerEvent} event
   */
  startMovingDown(event) {
    this.movingDown = true;
    this.scene.requestRender();
    event.preventDefault();
  }

  stopElevator() {
    this.movingUp = false;
    this.movingDown = false;
  }

  render() {
    if (this.scene) {
      return html`
        <div class="ui vertical compact mini icon buttons">
          <button
          data-tooltip=${i18next.t('nav_up_btn_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui button"
          @pointerdown="${this.startMovingUp}">
            <i class="angle up icon"></i>
          </button>
          <button
          data-tooltip=${i18next.t('nav_down_btn_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui button"
          @pointerdown="${this.startMovingDown}">
            <i class="angle down icon"></i>
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

customElements.define('ngm-elevator-buttons', NgmElevatorButtons);
