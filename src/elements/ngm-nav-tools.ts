import {LitElementI18n} from '../i18n';
import {customElement, html, property, state} from 'lit-element';
import draggable from './draggable';
import {DEFAULT_VIEW} from '../constants';
import {Cartesian3, Entity, Event, Scene, Transforms, Viewer} from 'cesium';
import {Interactable} from '@interactjs/types';
import {classMap} from 'lit-html/directives/class-map.js';
import {pickCenterOnMapOrObject} from '../cesiumutils';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import {showWarning} from '../message';
import i18next from 'i18next';
import {debounce} from '../utils';

@customElement('ngm-nav-tools')
export class NgmNavTools extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null
  @property({type: Boolean}) showCamConfig = false
  @state() moveAmount = 200
  @state() interaction: Interactable | null = null
  @state() showRefPoint = false
  private zoomingIn = false
  private zoomingOut = false
  private unlistenFromPostRender: Event.RemoveCallback | null = null
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private stopZoomFunction: () => void = () => this.stopZoom()
  private refIcon: Entity = new Entity({
    position: Cartesian3.ZERO,
    show: false,
    billboard: {
      image: './images/i_cam_tp.svg',
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      width: 40,
      height: 40,
    }
  });
  private moveRef = false

  updated() {
    if (this.viewer && !this.unlistenFromPostRender) {
      const scene: Scene = this.viewer.scene;
      this.unlistenFromPostRender = scene.postRender.addEventListener(() => {
        const amount = Math.abs(scene.camera.positionCartographic.height) / this.moveAmount;
        if (this.zoomingIn) {
          scene.camera.moveForward(amount);
        } else if (this.zoomingOut) {
          scene.camera.moveBackward(amount);
        }
      });
      this.refIcon = this.viewer.entities.add(this.refIcon);
      this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
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
    if (!this.viewer) return;
    this.zoomingIn = true;
    this.viewer.scene.requestRender();
    event.preventDefault();
  }

  startZoomOut(event) {
    if (!this.viewer) return;
    this.zoomingOut = true;
    this.viewer.scene.requestRender();
    event.preventDefault();
  }

  stopZoom() {
    this.zoomingIn = false;
    this.zoomingOut = false;
  }

  flyToHome() {
    if (!this.viewer) return;
    this.viewer.camera.flyTo(DEFAULT_VIEW);
  }

  toggleReference() {
    if (!this.eventHandler) return;
    if (this.showRefPoint) {
      this.eventHandler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP);
      this.removeReference();
    } else {
      this.eventHandler.setInputAction(debounce(event => this.onMoveRef(event), 250), ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.setInputAction(event => this.onLeftDown(event), ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.setInputAction(() => this.onLeftUp(), ScreenSpaceEventType.LEFT_UP);
      this.setReference();
    }
  }

  setReference(position?: Cartesian3) {
    const center = position || pickCenterOnMapOrObject(this.viewer!.scene);
    if (!center) {
      showWarning(i18next.t('nav_tools_out_glob_warn'));
      return;
    }
    this.showRefPoint = true;
    this.refIcon.position = <any>center;
    this.refIcon.show = true;
    const transform = Transforms.eastNorthUpToFixedFrame(center);
    this.viewer!.scene.camera.lookAtTransform(transform);
    document.addEventListener('keyup', this.ctrlListener);

  }

  removeReference() {
    document.removeEventListener('keyup', this.ctrlListener);
    this.showRefPoint = false;
    this.refIcon.show = false;
    this.viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  ctrlListener = (evt) => {
    if (evt.key !== 'Control') return;
    this.removeReference();
    showWarning(i18next.t('nav_tools_ctrl_disable_warn'));
  }

  onLeftDown(event) {
    const pickedObject = this.viewer!.scene.pick(event.position);
    if (pickedObject && pickedObject.id && pickedObject.id.id === this.refIcon.id) {
      this.viewer!.scene.screenSpaceCameraController.enableInputs = false;
      this.eventHandler!.setInputAction(event => this.onMoveRef(event), ScreenSpaceEventType.MOUSE_MOVE);
      this.moveRef = true;
    }
  }

  onLeftUp() {
    if (!this.moveRef) return;
    this.moveRef = false;
    this.viewer!.scene.screenSpaceCameraController.enableInputs = true;
    // for better performance
    this.eventHandler!.setInputAction(debounce(event => this.onMoveRef(event), 250), ScreenSpaceEventType.MOUSE_MOVE);
  }

  onMoveRef(event) {
    if (this.moveRef) {
      const position = Cartesian3.clone(this.viewer!.scene.pickPosition(event.endPosition));
      if (!position) return;
      this.setReference(position);
      this.viewer!.scene.requestRender();
    } else {
      const pickedObject = this.viewer!.scene.pick(event.endPosition);
      if (pickedObject && pickedObject.id && pickedObject.id.id === this.refIcon.id)
        this.viewer!.canvas.style.cursor = 'pointer';
      else if (this.viewer!.canvas.style.cursor === 'pointer')
        this.viewer!.canvas.style.cursor = '';
    }
  }

  render() {
    if (!this.viewer) return '';
    return html`
      <div class="ngm-nav-buttons">
        <div class="ngm-zoom-p-icon" @pointerdown=${e => this.startZoomIn(e)}></div>
        <div class="ngm-zoom-o-icon" @click=${() => this.flyToHome()}></div>
        <div class="ngm-zoom-m-icon" @pointerdown=${e => this.startZoomOut(e)}></div>
        <div class="ngm-divider"></div>
        <div class="ngm-cam-icon ${classMap({'ngm-active-icon': this.showCamConfig})}"
             @click=${() => this.dispatchEvent(new CustomEvent('togglecamconfig'))}>
        </div>
        <div class="ngm-coords-icon ${classMap({'ngm-active-icon': this.showRefPoint})}"
             @click=${this.toggleReference}>
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
