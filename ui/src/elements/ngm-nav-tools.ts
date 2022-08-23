import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import draggable from './draggable';
import {DEFAULT_VIEW} from '../constants';
import type {Event, Scene, Viewer} from 'cesium';
import {
  ArcType,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  Entity,
  JulianDate,
  KeyboardEventModifier,
  Matrix4,
  PolylineCollection,
  Transforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType
} from 'cesium';
import type {Interactable} from '@interactjs/types';
import {classMap} from 'lit/directives/class-map.js';
import {
  lookAtPoint,
  pickCenterOnMapOrObject,
  positionFromPxDistance,
  updateHeightForCartesianPositions
} from '../cesiumutils';
import {showSnackbarError} from '../notifications';
import i18next from 'i18next';
import {debounce} from '../utils';
import {getTargetParam, syncTargetParam} from '../permalink';
import NavToolsStore from '../store/navTools';
import {dragArea} from './helperElements';
import type {LockType} from './ngm-cam-configuration';
import MainStore from '../store/main';


const AXIS_WIDTH = 5;
const AXIS_LENGTH = 120;

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
  private axisDataSource: CustomDataSource | undefined;
  private axisCenter: Cartesian3 | undefined;
  private oldPolylineUpdate: any = PolylineCollection.prototype.update;
  private xyAxisCalculation = (axis, side) => [this.axisCenter, positionFromPxDistance(this.viewer!.scene, this.axisCenter!, AXIS_LENGTH, axis, side)];
  private xAxisCallback = new CallbackProperty(() => this.xyAxisCalculation('x', -1), false);
  private yAxisCallback = new CallbackProperty(() => this.xyAxisCalculation('y', 1), false);
  private zAxisCallback = new CallbackProperty(() => {
    if (!this.axisCenter) return [];
    const positions = this.xyAxisCalculation('x', -1);
    const distance = Cartesian3.distance(positions[0]!, positions[1]!);
    return [this.axisCenter, updateHeightForCartesianPositions([this.axisCenter], distance, this.viewer?.scene)[0]];
  }, false);

  constructor() {
    super();
    MainStore.viewer.subscribe(async v => {
      this.viewer = v;
      if (!this.viewer) return;
      this.axisDataSource = await this.viewer!.dataSources.add(new CustomDataSource('navigationAxes'));
      this.toggleAxis(this.axisCenter);
    });
    NavToolsStore.syncTargetPoint.subscribe(() => this.syncPoint());
    NavToolsStore.hideTargetPointListener.subscribe(() => this.removeTargetPoint());
    NavToolsStore.cameraHeightUpdate.subscribe(async height => {
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
      this.eventHandler.setInputAction(event => {
        const pickedPosition = scene.pickPosition(event.position);
        this.toggleAxis(pickedPosition);
      }, ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.CTRL);
      document.addEventListener('keyup', (evt) => {
        if (evt.key === 'Control') this.toggleAxis(undefined);
      });
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
    NavToolsStore.setTargetPointPosition(position);
    this.toggleAxis(position);
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
    this.toggleAxis(undefined);
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
    this.toggleAxis(center);

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

  createAxis() {
    if (!this.axisDataSource) return;
    const template = {
      width: AXIS_WIDTH,
      arcType: ArcType.NONE,
    };
    this.axisDataSource.entities.add({
      polyline: {
        positions: this.zAxisCallback,
        material: Color.BLUE,
        ...template
      },
    });
    this.axisDataSource.entities.add({
      polyline: {
        positions: this.xAxisCallback,
        material: Color.RED,
        ...template
      },
    });
    this.axisDataSource.entities.add({
      polyline: {
        positions: this.yAxisCallback,
        material: Color.GREEN,
        ...template
      },
    });
  }

  toggleAxis(center: Cartesian3 | undefined) {
    this.axisCenter = center;
    if (!center) {
      this.axisDataSource!.entities.removeAll();
      // Enable polylines depth test.
      PolylineCollection.prototype.update = this.oldPolylineUpdate;
    } else if (!this.axisDataSource?.entities.values.length) {
      this.createAxis();
      // Modify polylines to disable their depth test.
      const oldPolylineUpdate = this.oldPolylineUpdate;
      // @ts-ignore
      PolylineCollection.prototype.update = function (frameState) {
        const oldMorphTime = frameState.morphTime;
        frameState.morphTime = 0.0;
        oldPolylineUpdate.call(this, frameState);
        frameState.morphTime = oldMorphTime;
      };
    }
    this.dispatchEvent(new CustomEvent('axisstate', {detail: {showAxis: !!this.axisCenter}}));
  }

  render() {
    if (!this.viewer) return '';
    return html`
      <div class="ngm-nav-buttons">
        <div title="${i18next.t('nav_zoom_in')}" class="ngm-zoom-p-icon" @pointerdown=${e => this.startZoomIn(e)}></div>
        <div title="${i18next.t('nav_fly_home')}" class="ngm-zoom-o-icon" @click=${() => this.flyToHome()}></div>
        <div title="${i18next.t('nav_zoom_out')}" class="ngm-zoom-m-icon"
             @pointerdown=${e => this.startZoomOut(e)}></div>
        <div class="ngm-divider"></div>
        <div title="${i18next.t('cam_configuration_header')}"
             class="ngm-cam-icon ${classMap({'ngm-active-icon': this.showCamConfig})}"
             @click=${() => this.dispatchEvent(new CustomEvent('togglecamconfig'))}>
        </div>
        <div title="${i18next.t('nav_target_point')}"
             class="ngm-coords-icon ${classMap({
               'ngm-active-icon': this.showTargetPoint,
               'ngm-disabled': this.lockType !== '' && this.lockType !== 'elevation'
             })}" @click=${() => this.toggleReference()}>
        </div>
      </div>
      ${dragArea}
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
