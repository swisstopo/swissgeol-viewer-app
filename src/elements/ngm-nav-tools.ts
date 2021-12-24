import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import draggable from './draggable';
import {DEFAULT_VIEW} from '../constants';
import type {Event, Scene, Viewer} from 'cesium';
import {Cartesian3, Cartographic, Entity, JulianDate, Matrix4, Transforms} from 'cesium';
import type {Interactable} from '@interactjs/types';
import {classMap} from 'lit/directives/class-map.js';
import {lookAtPoint, pickCenterOnMapOrObject} from '../cesiumutils';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import {showSnackbarError} from '../notifications';
import i18next from 'i18next';
import {debounce} from '../utils';
import {getTargetParam, syncTargetParam} from '../permalink';
import NavToolsStore from '../store/navTools';
import type {LockType} from './ngm-cam-configuration';

@customElement('ngm-nav-tools')
export class NgmNavTools extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null;
  @property({type: Boolean}) showCamConfig = false;
  @state() moveAmount = 200;
  @state() interaction: Interactable | null = null;
  @state() showTargetPoint = false;
  @state() lockType: LockType = '';
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
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      width: 40,
      height: 40,
    }
  });
  private moveRef = false;
  private julianDate = new JulianDate();

  constructor() {
    super();
    NavToolsStore.syncTargetPoint.subscribe(() => this.syncPoint());
    NavToolsStore.hideTargetPointListener.subscribe(() => this.removeTargetPoint());
    NavToolsStore.cameraHeightUpdate.subscribe(height => {
      if (!this.viewer) return;
      this.showTargetPoint && this.stopTracking();
      const pc = this.viewer.camera.positionCartographic;
      this.viewer.camera.position = Cartesian3.fromRadians(pc.longitude, pc.latitude, height);
      this.showTargetPoint && this.startTracking();
    });
    NavToolsStore.navLockType.subscribe(type => {
      if (type !== '' && type !== 'elevation' && this.showTargetPoint) this.removeTargetPoint();
      this.lockType = type;
    });
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
    draggable(this, {
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
    if (!initialTarget && !this.showTargetPoint) return;
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
    this.showTargetPoint && this.removeTargetPoint();
    this.viewer.camera.flyTo({
      ...DEFAULT_VIEW
    });
  }

  toggleReference(forcePosition?) {
    if (!this.eventHandler) return;
    let position: Cartesian3 | undefined = forcePosition;
    if (this.showTargetPoint && !forcePosition) {
      this.eventHandler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP);
      this.removeTargetPoint();
    } else if (!this.lockType || this.lockType === 'elevation') {
      this.eventHandler.setInputAction(debounce(event => this.onMouseMove(event), 250), ScreenSpaceEventType.MOUSE_MOVE);
      this.eventHandler.setInputAction(event => this.onLeftDown(event), ScreenSpaceEventType.LEFT_DOWN);
      this.eventHandler.setInputAction(() => this.onLeftUp(), ScreenSpaceEventType.LEFT_UP);
      position = position || pickCenterOnMapOrObject(this.viewer!.scene);
      if (!position) {
        showSnackbarError(i18next.t('nav_tools_out_glob_warn'));
        return;
      }
      this.addTargetPoint(position, true);
    }
    syncTargetParam(position && Cartographic.fromCartesian(position));
  }

  addTargetPoint(center: Cartesian3, lookAtTransform = false) {
    this.showTargetPoint = true;
    this.refIcon.position = <any>center;
    const cam = this.viewer!.camera;
    this.refIcon.show = true;
    if (lookAtTransform) {
      const transform = Transforms.eastNorthUpToFixedFrame(center);
      cam.lookAtTransform(transform);
    }
    document.addEventListener('keydown', this.ctrlListener);
  }

  removeTargetPoint() {
    document.removeEventListener('keydown', this.ctrlListener);
    this.showTargetPoint = false;
    this.refIcon.show = false;
    this.viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  ctrlListener = (evt) => {
    if (evt.key !== 'Control') return;
    this.removeTargetPoint();
  };

  onLeftDown(event) {
    const pickedObject = this.viewer!.scene.pick(event.position);
    if (pickedObject && pickedObject.id && pickedObject.id.id === this.refIcon.id) {
      this.stopTracking();
      this.moveRef = true;
    }
  }

  onLeftUp() {
    if (!this.moveRef) return;
    this.moveRef = false;
    this.startTracking();
  }

  stopTracking() {
    this.viewer!.scene.screenSpaceCameraController.enableInputs = false;
    this.eventHandler!.setInputAction(event => this.onMouseMove(event), ScreenSpaceEventType.MOUSE_MOVE);
    this.viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  startTracking() {
    this.addTargetPoint(this.refIcon.position!.getValue(this.julianDate));
    const center = this.refIcon.position!.getValue(this.julianDate);
    const camera = this.viewer!.camera;
    lookAtPoint(center, camera);
    const transform = Transforms.eastNorthUpToFixedFrame(center);
    camera.lookAtTransform(transform);

    this.viewer!.scene.screenSpaceCameraController.enableInputs = true;
    // for better performance
    this.eventHandler!.setInputAction(debounce(event => this.onMouseMove(event), 250), ScreenSpaceEventType.MOUSE_MOVE);
    this.viewer!.scene.requestRender();
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
        <div class="ngm-coords-icon ${classMap({
          'ngm-active-icon': this.showTargetPoint,
          'ngm-disabled': this.lockType !== '' && this.lockType !== 'elevation'
        })}" @click=${() => this.toggleReference()}>
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
