import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileFeature,
  Cesium3DTileset,
  Entity,
  Scene,
  Viewer,
} from 'cesium';
import { CoreElement } from 'src/features/core';
import { CesiumService } from 'src/services/cesium.service';
import { CameraControllerService } from 'src/features/controls/camera-controller.service';
import {
  ZoomClamp,
  ZoomTargetSource,
} from 'src/features/controls/approach-limited-zoom.controller';
import { handleScenePickingError } from 'src/services/pick.service';

/** How often the HUD re-reads the scene, in milliseconds. */
const SAMPLE_INTERVAL = 100;

const TARGET_SOURCE_LABELS: Record<ZoomTargetSource, string> = {
  geometry: 'depth buffer / terrain ray',
  fallback: 'ray fallback (nothing hit)',
  none: 'none',
};

const CLAMP_LABELS: Record<ZoomClamp, string> = {
  none: 'unclamped',
  maximumApproachRate: 'slowed — maximumApproachRate',
  maximumApproachFraction: 'slowed — maximumApproachFraction',
  minimumApproachStep: 'boosted — minimumApproachStep',
  targetSeparation: 'nudged — targetSeparation',
};

interface ZoomDebugView {
  readonly pickedObject: string;
  readonly depthBuffer: string;
  readonly targetSource: ZoomTargetSource;
  readonly origin: string;
  readonly distance: number;
  readonly height: number | null;
  readonly requestedStep: number;
  readonly appliedStep: number;
  readonly maximumStep: number;
  readonly clamp: ZoomClamp;
  readonly isZoomingIn: boolean;
  readonly frameSeconds: number;
  readonly zoomVelocity: number;
  readonly velocityScale: number;
}

/**
 * Debug overlay for the scroll-wheel zoom, enabled with the `zoomDebug` URL
 * flag (e.g. `?zoomDebug`).
 *
 * It visualises what {@link ApproachLimitedZoomCameraController} decided for the
 * most recent frame: which object the zoom is aimed at, how far away it is, how
 * far CesiumJS wanted to move, and which of our limits — if any — changed that.
 *
 * See `docs/camera-zoom.md` for how this differs from stock CesiumJS.
 */
@customElement('control-zoom-debug')
export class ControlZoomDebug extends CoreElement {
  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  @consume({ context: CameraControllerService.context() })
  accessor cameraControllerService!: CameraControllerService;

  @state()
  accessor view: ZoomDebugView | null = null;

  private viewer: Viewer | null = null;
  private removePostRenderListener: (() => void) | null = null;
  private lastSampleTime = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(() => this.removePostRenderListener?.());
    this.register(
      this.cesiumService.viewer$.subscribe((viewer) => {
        this.removePostRenderListener?.();
        this.viewer = viewer;
        this.removePostRenderListener =
          viewer.scene.postRender.addEventListener(this.handlePostRender);
      }),
    );
  }

  private readonly handlePostRender = (): void => {
    const viewer = this.viewer;
    if (viewer === null) {
      return;
    }

    const now = performance.now();
    if (now - this.lastSampleTime < SAMPLE_INTERVAL) {
      return;
    }
    this.lastSampleTime = now;

    const { scene } = viewer;
    const debug = this.cameraControllerService.zoomController.debug;
    const origin = debug.zoomOrigin;

    // Picking is expensive, so it runs at the sample rate rather than per frame.
    const pickedObject = describePickedObject(scene, origin);
    const depthBuffer = describeDepthBuffer(scene, origin);

    const cartographic = Cartographic.fromCartesian(
      scene.camera.positionWC,
      scene.ellipsoid,
    );
    const terrainHeight =
      cartographic === undefined
        ? null
        : (scene.globe?.getHeight(cartographic) ?? 0);

    this.view = {
      pickedObject,
      depthBuffer,
      targetSource: debug.targetSource,
      origin: `${Math.round(origin.x)}, ${Math.round(origin.y)}`,
      distance: debug.distance,
      height:
        cartographic === undefined || terrainHeight === null
          ? null
          : cartographic.height - terrainHeight,
      requestedStep: debug.requestedStep,
      appliedStep: debug.appliedStep,
      maximumStep: debug.maximumStep,
      clamp: debug.clamp,
      isZoomingIn: debug.isZoomingIn,
      frameSeconds: debug.frameSeconds,
      zoomVelocity: debug.zoomVelocity,
      velocityScale: debug.velocityScale,
    };
  };

  readonly render = () => {
    const view = this.view;
    if (view === null) {
      return nothing;
    }

    const { zoomController } = this.cameraControllerService;
    const stepRatio =
      view.distance > 0 ? (view.appliedStep / view.distance) * 100 : 0;

    return html`
      <h3>Zoom debug</h3>
      <dl>
        ${row('Picked object', view.pickedObject)}
        ${row('Depth buffer', view.depthBuffer)}
        ${row('Target source', TARGET_SOURCE_LABELS[view.targetSource])}
        ${row('Zoom origin (px)', view.origin)}
        ${row('Distance to target', formatMeters(view.distance))}
        ${row('Height above terrain', formatMeters(view.height))}
      </dl>
      <dl>
        ${row('Requested step', formatMeters(view.requestedStep))}
        ${row('Applied step', formatMeters(view.appliedStep))}
        ${row('Max step', formatMeters(view.maximumStep))}
        ${row('Applied / distance', `${stepRatio.toFixed(2)} %`)}
        ${row(
          'Limit',
          CLAMP_LABELS[view.clamp],
          view.clamp === 'none' ? '' : 'is-active',
        )}
        ${row('Input this frame', view.isZoomingIn ? 'zooming in' : 'glide')}
      </dl>
      <dl>
        ${row('Frame time', `${(view.frameSeconds * 1000).toFixed(1)} ms`)}
        ${row('Banked velocity', `${formatMeters(view.zoomVelocity)}/s`)}
        ${row(
          'Velocity rescaled to',
          `${(view.velocityScale * 100).toFixed(1)} %`,
          view.velocityScale < 0.999 ? 'is-active' : '',
        )}
      </dl>
      <dl>
        ${row('zoomDistanceRatio', zoomController.zoomDistanceRatio.toFixed(3))}
        ${row('zoomSensitivity', zoomController.zoomSensitivity.toFixed(3))}
        ${row(
          'maximumApproachRate',
          `${zoomController.maximumApproachRate.toFixed(2)} /s`,
        )}
        ${row(
          'maximumApproachFraction',
          zoomController.maximumApproachFraction.toFixed(2),
        )}
        ${row(
          'minimumApproachStep',
          formatMeters(zoomController.minimumApproachStep),
        )}
      </dl>
    `;
  };

  static readonly styles = css`
    :host {
      position: absolute;
      bottom: 12px;
      left: 12px;
      z-index: 10;
      width: 300px;
      padding: 8px 10px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.72);
      color: #e9ecef;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      line-height: 1.5;
      pointer-events: none;
    }

    h3 {
      margin: 0 0 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #adb5bd;
    }

    dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0 8px;
      margin: 0;
      padding: 6px 0 0;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }

    dl:first-of-type {
      border-top: none;
      padding-top: 0;
    }

    dt {
      color: #adb5bd;
      white-space: nowrap;
    }

    dd {
      margin: 0;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    dd.is-active {
      color: #ffd43b;
    }
  `;
}

const row = (label: string, value: string, valueClass = '') => html`
  <dt>${label}</dt>
  <dd class=${valueClass}>${value}</dd>
`;

const formatMeters = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }
  if (absolute >= 1) {
    return `${value.toFixed(2)} m`;
  }
  return `${(value * 100).toFixed(2)} cm`;
};

/**
 * Names whatever sits under the zoom origin. CesiumJS's `scene.pick` ignores the
 * globe, so terrain is detected separately via a ray/globe intersection.
 */
function describePickedObject(scene: Scene, position: Cartesian2): string {
  let picked: unknown;
  try {
    picked = scene.pick(position);
  } catch (e) {
    handleScenePickingError(e);
    return 'unavailable (tiles loading)';
  }

  if (picked !== undefined && picked !== null) {
    return describePrimitive(picked);
  }

  const ray = scene.camera.getPickRay(position);
  if (ray !== undefined && scene.globe?.pick(ray, scene) !== undefined) {
    return 'Terrain (globe)';
  }

  return 'nothing (sky)';
}

/**
 * Reports whether `Scene.pickPosition` can resolve the zoom target, and why not
 * when it cannot.
 *
 * A translucent globe does not write to the depth buffer, so over plain terrain
 * the depth pick yields nothing and the zoom target has to come from the
 * terrain ray cast instead (see `pickWorldPositionWithDepthBuffer`). Before that
 * fallback existed, the target dropped to the WGS84 ellipsoid and the zoom
 * throttling effectively stopped working.
 */
function describeDepthBuffer(scene: Scene, position: Cartesian2): string {
  const isGlobeTranslucent = scene.globe?.translucency?.enabled === true;
  let hasDepth = false;
  try {
    const depthPick = scene.pickPosition(position);
    hasDepth =
      depthPick !== undefined && !Cartesian3.equals(depthPick, Cartesian3.ZERO);
  } catch (e) {
    handleScenePickingError(e);
  }

  if (hasDepth) {
    return isGlobeTranslucent ? 'available (globe translucent)' : 'available';
  }
  return isGlobeTranslucent
    ? 'unavailable — globe translucent, using terrain ray'
    : 'unavailable — using terrain ray';
}

function describePrimitive(picked: unknown): string {
  if (picked instanceof Cesium3DTileFeature) {
    const name =
      picked.getProperty('name') ?? picked.getProperty('Name') ?? undefined;
    const tileset = describeTileset(picked.primitive);
    return name === undefined
      ? `3D Tile feature — ${tileset}`
      : `3D Tile feature "${name}" — ${tileset}`;
  }

  const primitive = (picked as { primitive?: unknown }).primitive;
  const id = (picked as { id?: unknown }).id;

  if (id instanceof Entity) {
    return `Entity "${id.name ?? id.id}"`;
  }
  if (primitive instanceof Cesium3DTileset) {
    return `Tileset — ${describeTileset(primitive)}`;
  }
  if (primitive !== undefined && primitive !== null) {
    return (primitive as object).constructor.name;
  }
  return (picked as object).constructor.name;
}

function describeTileset(tileset: unknown): string {
  if (!(tileset instanceof Cesium3DTileset)) {
    return 'unknown tileset';
  }
  const url = tileset.resource?.url;
  if (typeof url !== 'string') {
    return 'unknown tileset';
  }
  return url.split('/').filter(Boolean).slice(-2).join('/');
}
