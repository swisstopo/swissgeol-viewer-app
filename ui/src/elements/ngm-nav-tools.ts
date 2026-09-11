import { customElement, property, state } from 'lit/decorators.js';
import { html } from 'lit';
import draggable from './draggable';
import { DEFAULT_VIEW } from '../constants';
import {
  ArcType,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  CustomDataSource,
  Entity,
  Event,
  JulianDate,
  Matrix4,
  PolylineCollection,
} from 'cesium';
import type { Interactable } from '@interactjs/types';
import { classMap } from 'lit/directives/class-map.js';
import {
  lookAtPoint,
  pickCenter,
  pickCenterOnMapOrObject,
  pickPositionOrVoxel,
  positionFromPxDistance,
} from '../cesiumutils';
import { showSnackbarError } from '../notifications';
import i18next from 'i18next';
import { getTargetParam, syncTargetParam } from '../permalink';
import NavToolsStore from '../store/navTools';
import { dragArea } from './helperElements';
import type { LockType } from './ngm-cam-configuration';
import { consume } from '@lit/context';
import { ControlsService } from 'src/features/controls/controls.service';
import { CameraControllerService } from 'src/features/controls/camera-controller.service';
import {
  ButtonGesture,
  ButtonGestureEvent,
  filterByButtonGesture,
  filterByModifier,
  GestureControlsService,
  GestureModifier,
  MoveGestureEvent,
} from 'src/features/controls/gestures/gesture-controls.service';
import { CoreElement } from 'src/features/core';
import { debounceTime, Subscription } from 'rxjs';
import { CesiumService } from 'src/services/cesium.service';

const AXIS_WIDTH = 5;
const AXIS_LENGTH = 120;

@customElement('ngm-nav-tools')
export class NgmNavTools extends CoreElement {
  @property({ type: Boolean })
  accessor showCamConfig = false;

  @consume({ context: ControlsService.context() })
  accessor controlsService!: ControlsService;

  @consume({ context: CameraControllerService.context() })
  accessor cameraControllerService!: CameraControllerService;

  @consume({ context: GestureControlsService.context() })
  accessor gestureControlsService!: GestureControlsService;

  @state()
  accessor moveAmount = 200;

  @state()
  accessor interaction: Interactable | null = null;

  @state()
  accessor showTargetPoint = false;

  @state()
  accessor lockType: LockType = '';

  private gestureSubscription: Subscription | null = null;

  private zoomingIn = false;
  private zoomingOut = false;
  private unlistenFromPostRender: Event.RemoveCallback | null = null;
  private readonly stopZoomFunction: () => void = () => this.stopZoom();
  private refIcon: Entity = new Entity({
    position: Cartesian3.ZERO,
    show: false,
    billboard: {
      image: '/images/i_cam_tp.svg',
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      width: 40,
      height: 40,
    },
  });
  private moveRef = false;
  private readonly julianDate = new JulianDate();
  private axisDataSource: CustomDataSource | undefined;
  private axisCenter: Cartesian3 | undefined;
  private readonly oldPolylineUpdate: any = PolylineCollection.prototype.update;

  private readonly xyAxisCalculation = (axis, side) => [
    this.axisCenter,
    positionFromPxDistance(
      this.cesiumService.viewer.scene,
      this.axisCenter!,
      AXIS_LENGTH,
      axis,
      side,
    ),
  ];

  private readonly xAxisCallback = new CallbackProperty(
    () => this.xyAxisCalculation('x', -1),
    false,
  );

  private readonly yAxisCallback = new CallbackProperty(
    () => this.xyAxisCalculation('y', 1),
    false,
  );

  private readonly zAxisCallback = new CallbackProperty(
    () => this.xyAxisCalculation('z', -1),
    false,
  );
  private exaggeration = 1;

  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  async connectedCallback() {
    super.connectedCallback();
    const { viewer } = this.cesiumService;
    this.axisDataSource = await viewer.dataSources.add(
      new CustomDataSource('navigationAxes'),
    );
    this.toggleAxis(this.axisCenter);
    this.exaggeration = viewer.scene.verticalExaggeration;

    NavToolsStore.syncTargetPoint.subscribe(() => this.syncPoint());
    NavToolsStore.hideTargetPointListener.subscribe(() =>
      this.removeTargetPoint(),
    );
    NavToolsStore.cameraHeightUpdate.subscribe(async (height) => {
      this.showTargetPoint && this.stopTracking();
      const pc = viewer.camera.positionCartographic;
      viewer.camera.position = Cartesian3.fromRadians(
        pc.longitude,
        pc.latitude,
        height,
      );
      this.showTargetPoint && this.startTracking();
    });
    NavToolsStore.navLockType.subscribe((type) => {
      if (type !== '' && type !== 'elevation' && this.showTargetPoint)
        this.removeTargetPoint();
      this.lockType = type;
    });
    NavToolsStore.exaggerationChanged.subscribe((exaggeration) => {
      this.showTargetPoint && this.stopTracking();
      const exaggerationScale = exaggeration / this.exaggeration;
      const pc = viewer.camera.positionCartographic;
      const centerOfView = pickCenter(viewer.scene);
      if (centerOfView) {
        const cartographic = Cartographic.fromCartesian(centerOfView);
        const height = cartographic.height;
        const offset = height * exaggerationScale - height;
        viewer.camera.position = Cartesian3.fromRadians(
          pc.longitude,
          pc.latitude,
          pc.height + offset,
        );
      }
      if (this.showTargetPoint) {
        const iconPos = Cartographic.fromCartesian(
          this.refIcon.position!.getValue(this.julianDate)!,
        );
        iconPos.height = iconPos.height * exaggerationScale;
        this.refIcon.position = new ConstantPositionProperty(
          Cartographic.toCartesian(iconPos),
        );
        this.startTracking();
        syncTargetParam(iconPos);
      }
      this.exaggeration = exaggeration;
    });

    document.addEventListener('pointerup', this.stopZoomFunction);
    draggable(this, {
      allowFrom: '.ngm-drag-area',
    });

    // Create the rotate/tilt indicator.
    this.register(
      this.gestureControlsService.leftMouseButton$
        .pipe(
          filterByModifier(GestureModifier.Control),
          filterByButtonGesture(ButtonGesture.Down),
        )
        .subscribe(this.createTiltIndicator),
    );
    this.register(
      this.gestureControlsService.middleMouseButton$
        .pipe(filterByButtonGesture(ButtonGesture.Down))
        .subscribe(this.createTiltIndicator),
    );

    // Remove the indicator when the middle mouse button is released.
    this.register(
      this.gestureControlsService.middleMouseButton$
        .pipe(filterByButtonGesture(ButtonGesture.Up))
        .subscribe(() => {
          this.toggleAxis(undefined);
        }),
    );

    // Trigger the indicator when control is clicked after the mouse button.
    let activeLeftClick: ButtonGestureEvent | null = null;
    this.register(
      this.gestureControlsService.leftMouseButton$.subscribe((event) => {
        activeLeftClick = event;
      }),
    );
    const enableAxisHandler = (evt: KeyboardEvent) => {
      if (evt.key === 'Control' && activeLeftClick !== null) {
        this.createTiltIndicator(activeLeftClick);
        activeLeftClick = null;
      }
    };
    document.addEventListener('keydown', enableAxisHandler);
    this.register(() =>
      document.removeEventListener('keydown', enableAxisHandler),
    );

    // Remove the indicator when control is released.
    const disableAxisHandler = (evt: KeyboardEvent) => {
      if (evt.key === 'Control') this.toggleAxis(undefined);
    };
    document.addEventListener('keyup', disableAxisHandler);
    this.register(() =>
      document.removeEventListener('keyup', disableAxisHandler),
    );
  }

  disconnectedCallback() {
    if (this.unlistenFromPostRender) {
      this.unlistenFromPostRender();
    }
    document.removeEventListener('pointerup', this.stopZoomFunction);
    super.disconnectedCallback();
  }

  updated() {
    if (this.unlistenFromPostRender) {
      return;
    }

    const { viewer } = this.cesiumService;
    const { scene } = viewer;
    this.unlistenFromPostRender = scene.postRender.addEventListener(() => {
      const amount =
        Math.abs(scene.camera.positionCartographic.height) / this.moveAmount;
      if (this.zoomingIn) {
        scene.camera.moveForward(amount);
      } else if (this.zoomingOut) {
        scene.camera.moveBackward(amount);
      }
    });
    this.refIcon = viewer.entities.add(this.refIcon);

    this.syncPoint();
  }

  syncPoint() {
    const initialTarget = getTargetParam();
    if (!initialTarget && !this.showTargetPoint) return;
    this.toggleReference(initialTarget);
  }

  startZoomIn(event) {
    const { viewer } = this.cesiumService;
    this.zoomingIn = true;
    viewer.scene.requestRender();
    event.preventDefault();
  }

  startZoomOut(event) {
    const { viewer } = this.cesiumService;
    this.zoomingOut = true;
    viewer.scene.requestRender();
    event.preventDefault();
  }

  stopZoom() {
    this.zoomingIn = false;
    this.zoomingOut = false;
  }

  flyToHome() {
    const { viewer } = this.cesiumService;
    this.showTargetPoint && this.removeTargetPoint();
    viewer.camera.flyTo({
      ...DEFAULT_VIEW,
    });
  }

  toggleReference(forcePosition?: Cartesian3) {
    const { viewer } = this.cesiumService;
    let position: Cartesian3 | undefined = forcePosition;
    if (this.showTargetPoint && !forcePosition) {
      this.gestureSubscription?.unsubscribe();
      this.gestureSubscription = null;
      this.removeTargetPoint();
    } else if (!this.lockType || this.lockType === 'elevation') {
      this.gestureSubscription?.unsubscribe();
      const subscription = new Subscription();
      subscription.add(
        this.gestureControlsService.mouseMove$
          .pipe(debounceTime(250))
          .subscribe(this.onMouseMove.bind(this)),
      );
      subscription.add(
        this.gestureControlsService.leftMouseButton$
          .pipe(filterByButtonGesture(ButtonGesture.Down))
          .subscribe(this.onLeftDown.bind(this)),
      );
      subscription.add(
        this.gestureControlsService.leftMouseButton$
          .pipe(filterByButtonGesture(ButtonGesture.Up))
          .subscribe(this.onLeftUp.bind(this)),
      );
      this.gestureSubscription = subscription;

      position = position || pickCenterOnMapOrObject(viewer!.scene);
      if (!position) {
        showSnackbarError(i18next.t('nav_tools_out_glob_warn'));
        return;
      }
      this.addTargetPoint(position);
    }
    syncTargetParam(position && Cartographic.fromCartesian(position));
    NavToolsStore.setTargetPointPosition(position);
    this.toggleAxis(position);
  }

  addTargetPoint(center: Cartesian3) {
    this.showTargetPoint = true;
    this.refIcon.position = new ConstantPositionProperty(center);
    this.refIcon.show = true;
    document.addEventListener('keydown', this.ctrlListener);
  }

  removeTargetPoint() {
    const { viewer } = this.cesiumService;
    document.removeEventListener('keydown', this.ctrlListener);
    this.showTargetPoint = false;
    this.refIcon.show = false;
    viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
    this.toggleAxis(undefined);
  }

  ctrlListener = (evt) => {
    if (evt.key !== 'Control') return;
    this.removeTargetPoint();
  };

  onLeftDown(event: ButtonGestureEvent) {
    const { viewer } = this.cesiumService;
    const pickedObject = viewer.scene.pick(event.position);
    if (
      pickedObject &&
      pickedObject.id &&
      pickedObject.id.id === this.refIcon.id
    ) {
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
    const { viewer } = this.cesiumService;
    this.cameraControllerService.enableInputs = false;
    viewer.scene.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  startTracking() {
    const { viewer } = this.cesiumService;
    const center = this.refIcon.position!.getValue(this.julianDate)!;
    this.addTargetPoint(center);
    const camera = viewer.camera;
    lookAtPoint(center, camera);
    this.toggleAxis(center);

    this.cameraControllerService.enableInputs = true;

    if (this.gestureSubscription === null) {
      this.gestureSubscription = this.gestureControlsService.mouseMove$
        .pipe(debounceTime(250))
        .subscribe(this.onMouseMove.bind(this));
    }
    viewer.scene.requestRender();
  }

  onMouseMove(event: MoveGestureEvent) {
    const { viewer } = this.cesiumService;
    if (this.moveRef) {
      const position = pickPositionOrVoxel(viewer.scene, event.position);
      if (!position) return;
      this.addTargetPoint(position);
      syncTargetParam(Cartographic.fromCartesian(position));
      viewer.scene.requestRender();
    } else {
      const pickedObject = viewer.scene.pick(event.position);
      if (
        pickedObject &&
        pickedObject.id &&
        pickedObject.id.id === this.refIcon.id
      )
        viewer.canvas.style.cursor = 'pointer';
      else if (viewer.canvas.style.cursor === 'pointer')
        viewer.canvas.style.cursor = '';
    }
  }

  private readonly createTiltIndicator = (event: ButtonGestureEvent): void => {
    if (this.controlsService.is2DActive) {
      return;
    }
    const { viewer } = this.cesiumService;
    const pickedPosition = pickPositionOrVoxel(viewer.scene, event.position);
    this.toggleAxis(pickedPosition);
  };

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
        ...template,
      },
    });
    this.axisDataSource.entities.add({
      polyline: {
        positions: this.xAxisCallback,
        material: Color.RED,
        ...template,
      },
    });
    this.axisDataSource.entities.add({
      polyline: {
        positions: this.yAxisCallback,
        material: Color.GREEN,
        ...template,
      },
    });
  }

  toggleAxis(center: Cartesian3 | undefined) {
    if (this.axisDataSource === undefined) {
      return;
    }
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
    this.dispatchEvent(
      new CustomEvent('axisstate', { detail: { showAxis: !!this.axisCenter } }),
    );
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }

  render() {
    return html`
      <div class="ngm-nav-buttons">
        <div
          title="${i18next.t('nav_zoom_in')}"
          class="ngm-zoom-p-icon"
          @pointerdown=${(e) => this.startZoomIn(e)}
        ></div>
        <div
          title="${i18next.t('nav_fly_home')}"
          class="ngm-zoom-o-icon"
          @click=${() => this.flyToHome()}
        ></div>
        <div
          title="${i18next.t('nav_zoom_out')}"
          class="ngm-zoom-m-icon"
          @pointerdown=${(e) => this.startZoomOut(e)}
        ></div>
        <div class="ngm-divider"></div>
        <div
          title="${i18next.t('cam_configuration_header')}"
          class="ngm-cam-icon ${classMap({
            'ngm-active-icon': this.showCamConfig,
          })}"
          @click=${() => this.dispatchEvent(new CustomEvent('togglecamconfig'))}
        ></div>
        <control-2d></control-2d>
      </div>
      ${dragArea}
    `;
  }

  // TODO Fix the target point tool and then add this icon back to the toolbar.
  /*
  <div
    title="${i18next.t('nav_target_point')}"
    class="ngm-coords-icon ${classMap({
      'ngm-active-icon': this.showTargetPoint,
      'ngm-disabled':
        this.lockType !== '' && this.lockType !== 'elevation',
    })}"
    @click=${() => this.toggleReference()}
  ></div>
   */
}
