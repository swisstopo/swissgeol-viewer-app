import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import draggable from './draggable';
import {DEFAULT_VIEW} from '../constants';
import {Cartesian3, Cartographic, Entity, Event, Matrix4, Scene, Transforms, Viewer} from 'cesium';
import {Interactable} from '@interactjs/types';
import {classMap} from 'lit/directives/class-map.js';
import {eastNorthUp, pickCenterOnMapOrObject} from '../cesiumutils';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import {showWarning} from '../notifications';
import i18next from 'i18next';
import {debounce} from '../utils';
import {getTargetParam, syncTargetParam} from '../permalink';
import MainStore from '../store/main';

@customElement('ngm-nav-tools')
export class NgmNavTools extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null;
  @property({type: Boolean}) showCamConfig = false;
  @state() moveAmount = 200;
  @state() interaction: Interactable | null = null;
  @state() showRefPoint = false;
  private zoomingIn = false;
  private zoomingOut = false;
  private unlistenFromPostRender: Event.RemoveCallback | null = null;
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private stopZoomFunction: () => void = () => this.stopZoom();
  private refIcon: Entity = new Entity({
    position: Cartesian3.ZERO,
    show: false,
    billboard: {
      image: './images/i_cam_tp.svg',
      width: 40,
      height: 40,
    }
  });
  private moveRef = false;

  constructor() {
    super();
    MainStore.syncTargetPoint.subscribe(() => this.syncPoint());
  }

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
      this.syncPoint();
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

  syncPoint() {
    const initialTarget = getTargetParam();
    if (!initialTarget) return;
    this.toggleReference(initialTarget);
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

  toggleReference(forcePosition?) {
    if (!this.eventHandler) return;
    let position: Cartesian3 | undefined = forcePosition;
    if (this.showRefPoint && !forcePosition) {
      this.eventHandler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP);
      this.removeTargetPoint();
    } else {
      this.eventHandler.setInputAction(debounce(event => this.onMouseMove(event), 250), ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.setInputAction(event => this.onLeftDown(event), ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.setInputAction(() => this.onLeftUp(), ScreenSpaceEventType.LEFT_UP);
      position = position || pickCenterOnMapOrObject(this.viewer!.scene);
      if (!position) {
        showWarning(i18next.t('nav_tools_out_glob_warn'));
        return;
      }
      this.addTargetPoint(position, true);
    }
    syncTargetParam(position && Cartographic.fromCartesian(position));
  }

  addTargetPoint(center: Cartesian3, lookAtTransform = false) {
    this.showRefPoint = true;
    this.refIcon.position = <any>center;
    const cam = this.viewer!.camera;
    this.refIcon.show = true;
    this.refIcon.viewFrom = <any>eastNorthUp(center, cam.position);
    if (lookAtTransform) {
      const transform = Transforms.eastNorthUpToFixedFrame(center);
      cam.lookAtTransform(transform);
    }
    document.addEventListener('keydown', this.ctrlListener);
  }

  removeTargetPoint() {
    document.removeEventListener('keydown', this.ctrlListener);
    this.showRefPoint = false;
    this.refIcon.show = false;
    this.viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer!.trackedEntity = undefined;
  }

  ctrlListener = (evt) => {
    if (evt.key !== 'Control') return;
    this.removeTargetPoint();
    showWarning(i18next.t('nav_tools_ctrl_disable_warn'));
  };

  onLeftDown(event) {
    const pickedObject = this.viewer!.scene.pick(event.position);
    if (pickedObject && pickedObject.id && pickedObject.id.id === this.refIcon.id) {
      this.viewer!.scene.screenSpaceCameraController.enableInputs = false;
      this.eventHandler!.setInputAction(event => this.onMouseMove(event), ScreenSpaceEventType.MOUSE_MOVE);
      this.viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
      this.viewer!.trackedEntity = undefined;
      this.moveRef = true;
    }
  }

  onLeftUp() {
    if (!this.moveRef) return;
    this.moveRef = false;
    this.viewer!.trackedEntity = this.refIcon;
    this.viewer!.scene.screenSpaceCameraController.enableInputs = true;
    // for better performance
    this.eventHandler!.setInputAction(debounce(event => this.onMouseMove(event), 250), ScreenSpaceEventType.MOUSE_MOVE);
  }

  onMouseMove(event) {
    if (this.moveRef) {
      const position = this.viewer!.scene.pickPosition(event.endPosition);
      if (!position) return;
      this.addTargetPoint(position);
      syncTargetParam(Cartographic.fromCartesian(position));
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
             @click=${() => this.toggleReference()}>
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
