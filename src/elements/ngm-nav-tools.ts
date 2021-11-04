import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import draggable from './draggable';
import {DEFAULT_VIEW} from '../constants';
import {Event, Scene} from 'cesium';
import {Interactable} from '@interactjs/types';
import {classMap} from 'lit/directives/class-map.js';

@customElement('ngm-nav-tools')
export class NgmNavTools extends LitElementI18n {
  @property({type: Object}) scene: Scene | null = null;
  @property({type: Boolean}) showCamConfig = false;
  @state() moveAmount = 200;
  @state() interaction: Interactable | null = null;
  private zoomingIn = false;
  private zoomingOut = false;
  private unlistenFromPostRender: Event.RemoveCallback | null = null;
  private stopZoomFunction: () => void = () => this.stopZoom();

  updated() {
    if (this.scene && !this.unlistenFromPostRender) {
      const scene: Scene = this.scene;
      this.unlistenFromPostRender = scene.postRender.addEventListener(() => {
        const amount = Math.abs(scene.camera.positionCartographic.height) / this.moveAmount;
        if (this.zoomingIn) {
          scene.camera.moveForward(amount);
        } else if (this.zoomingOut) {
          scene.camera.moveBackward(amount);
        }
      });
    }
  }

  connectedCallback() {
    document.addEventListener('pointerup', this.stopZoomFunction);
    this.interaction = draggable(this, {
      allowFrom: '.ngm-drag-area'
    });
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
    if (!this.scene) return;
    this.zoomingIn = true;
    this.scene.requestRender();
    event.preventDefault();
  }

  startZoomOut(event) {
    if (!this.scene) return;
    this.zoomingOut = true;
    this.scene.requestRender();
    event.preventDefault();
  }

  stopZoom() {
    this.zoomingIn = false;
    this.zoomingOut = false;
  }

  flyToHome() {
    if (!this.scene) return;
    this.scene.camera.flyTo(DEFAULT_VIEW);
  }

  render() {
    if (!this.scene) return '';
    return html`
      <div class="ngm-nav-buttons">
        <div class="ngm-zoom-p-icon" @pointerdown=${e => this.startZoomIn(e)}></div>
        <div class="ngm-zoom-o-icon" @click=${() => this.flyToHome()}></div>
        <div class="ngm-zoom-m-icon" @pointerdown=${e => this.startZoomOut(e)}></div>
        <div class="ngm-divider"></div>
        <div class="ngm-cam-icon ${classMap({'ngm-active-icon': this.showCamConfig})}"
             @click=${() => this.dispatchEvent(new CustomEvent('togglecamconfig'))}>
        </div>
      </div>
      <div class="ngm-drag-area">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
