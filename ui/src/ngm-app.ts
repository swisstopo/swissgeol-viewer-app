import { LitElementI18n } from 'src/i18n';
import { html, PropertyValues } from 'lit';
import './elements/ngm-full-screen-view';
import './elements/ngm-nav-tools';
import './elements/ngm-cam-configuration';
import './toolbox/ngm-topo-profile-modal';
import './toolbox/ngm-geometry-info';
import './cesium-toolbar';
import './elements/ngm-project-popup';
import './elements/ngm-coordinate-popup';
import './elements/ngm-ion-modal';
import './elements/ngm-map-chooser';
import './elements/ngm-confirmation-modal';

import 'src/features/core/core.module';
import 'src/features/layer/layer.module';
import 'src/features/controls/controls.module';
import 'src/features/layout/layout.module';
import 'src/features/navigation/navigation.module';
import 'src/features/session/session.module';
import 'src/features/ogc/ogc.module';

import { DEFAULT_VIEW } from './constants';

import { setupViewer } from './viewer';

import {
  getCameraView,
  getTopicOrProject,
  getZoomToPosition,
  rewriteParams,
  setCesiumToolbarParam,
  syncCamera,
  syncStoredView,
} from './permalink';
import i18next from 'i18next';
import Slicer from './slicer/Slicer';

import { initAnalytics } from './analytics.js';
import MainStore from './store/main';
import ToolboxStore from './store/toolbox';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, query, state } from 'lit/decorators.js';
import { showSnackbarInfo } from './notifications';
import type { NgmSlowLoading } from './elements/ngm-slow-loading';
import { Event, FrameRateMonitor, Globe, Viewer } from 'cesium';
import LocalStorageController from './LocalStorageController';
import DashboardStore from './store/dashboard';
import { clientConfigContext } from './context';
import { consume } from '@lit/context';
import { AppEnv, ClientConfig } from './api/client-config';
import { CoreModal, CoreWindow } from 'src/features/core';
import { TrackingConsentModalEvent } from 'src/features/layout/layout-consent-modal.element';
import { LayerService } from 'src/features/layer/layer.service';
import { LayerInfoService } from 'src/features/layer/info/layer-info.service';
import { BaseService } from 'src/services/base.service';
import { CesiumService } from 'src/services/cesium.service';
import { LexicVocabularyService } from 'src/features/lexic';
import { when } from 'lit/directives/when.js';
import { until } from 'lit/directives/until.js';

const SKIP_STEP2_TIMEOUT = 5000;

const CONSENT_COOKIE_NAME = 'swissgeol_consent';
const CONSENT_SCHEMA_VERSION = 1;
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const readConsent = (): { isAllowed: boolean } | null => {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(match.slice(CONSENT_COOKIE_NAME.length + 1)),
    );
    if (parsed?.v !== CONSENT_SCHEMA_VERSION) return null;
    return { isAllowed: Boolean(parsed.isAllowed) };
  } catch {
    return null;
  }
};

const writeConsent = (isAllowed: boolean): void => {
  const payload = encodeURIComponent(
    JSON.stringify({ v: CONSENT_SCHEMA_VERSION, isAllowed }),
  );
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE_NAME}=${payload}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
};

const storedConsent = readConsent();
const shouldShowDisclaimer = storedConsent === null;

const onStep1Finished = (globe: Globe, searchParams: URLSearchParams) => {
  let sse = 2;
  if (searchParams.has('maximumScreenSpaceError')) {
    sse = parseFloat(searchParams.get('maximumScreenSpaceError')!);
  }
  globe.maximumScreenSpaceError = sse;
};

/**
 * This is the root component. It is useful for:
 * - wiring the attributes of all top-level components;
 * - distribute events vertically between components (non hierarchical).
 */
@customElement('ngm-app')
export class NgmApp extends LitElementI18n {
  @state()
  accessor slicer_: Slicer | undefined;

  @state()
  accessor showCamConfig = false;

  @state()
  accessor loading = false;

  @state()
  accessor determinateLoading = false;

  @state()
  accessor queueLength = 0;

  @state()
  accessor showProjectPopup = false;

  @state()
  accessor mobileView = false;

  @state()
  accessor showAxisOnMap = false;

  @state()
  accessor showProjectSelector = false;

  @state()
  accessor showCesiumToolbar = false;

  @query('ngm-cam-configuration')
  accessor camConfigElement;

  @consume({ context: clientConfigContext })
  accessor clientConfig!: ClientConfig;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: LayerInfoService.context() })
  accessor layerInfoService!: LayerInfoService;

  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  constructor() {
    super();

    this.handleTrackingAllowedChanged =
      this.handleTrackingAllowedChanged.bind(this);

    const boundingRect = document.body.getBoundingClientRect();
    this.mobileView = boundingRect.width < 600 || boundingRect.height < 630;
    window.addEventListener('resize', () => {
      const boundingRect = document.body.getBoundingClientRect();
      this.mobileView = boundingRect.width < 600 || boundingRect.height < 630;
    });

    MainStore.isDebugActive$.subscribe((isDebugActive) => {
      this.showCesiumToolbar = isDebugActive;
      setCesiumToolbarParam(isDebugActive);
    });
  }

  private waitForViewLoading = false;
  private resolutionScaleRemoveCallback: Event.RemoveCallback | undefined;
  private disclaimer: CoreModal | null = null;

  private openDisclaimer(): void {
    this.disclaimer = CoreModal.open(
      { isPersistent: true, size: 'large', hasNoPadding: true },
      html`
        <ngm-layout-consent-modal
          @confirm="${this.handleTrackingAllowedChanged}"
        ></ngm-layout-consent-modal>
      `,
    );
  }

  connectedCallback(): void {
    super.connectedCallback();

    BaseService.initializeWith(this);

    i18next.on('initialized', () => {
      LexicVocabularyService.inject().then((service) =>
        service.preloadVocabularies(i18next.language),
      );
    });

    let infoWindow: CoreWindow | null = null;
    this.layerInfoService.infos$.subscribe((layers) => {
      if (layers.length === 0) {
        infoWindow?.close();
        infoWindow = null;
        return;
      } else if (infoWindow !== null) {
        return;
      }

      infoWindow = CoreWindow.open({
        title: () => i18next.t('layers:info_window.title'),
        body: () => html`<ngm-layer-info-list></ngm-layer-info-list>`,
        onClose: () => {
          infoWindow = null;
          this.layerInfoService.reset();
        },
      });
    });

    if (shouldShowDisclaimer) {
      this.openDisclaimer();
    } else if (
      storedConsent !== null &&
      this.clientConfig.env === AppEnv.Prod
    ) {
      initAnalytics(storedConsent.isAllowed);
    }
  }

  onStep2Finished(viewer) {
    if (!this.waitForViewLoading) {
      this.removeLoading();
    } else {
      const subscription = DashboardStore.viewIndex.subscribe((indx) => {
        if (typeof indx !== 'number') return;
        this.removeLoading();
        this.waitForViewLoading = false;
        subscription.unsubscribe();
      });
    }
    this.slicer_ = new Slicer(viewer);
    ToolboxStore.setSlicer(this.slicer_);
  }

  removeLoading() {
    this.loading = false;
    (<NgmSlowLoading>this.querySelector('ngm-slow-loading')).style.display =
      'none';
  }

  startCesiumLoadingProcess(viewer: Viewer) {
    const globe = viewer.scene.globe;

    // Temporarily increasing the maximum screen space error to load low LOD tiles.
    const searchParams = new URLSearchParams(document.location.search);
    globe.maximumScreenSpaceError = parseFloat(
      searchParams.get('initialScreenSpaceError') ?? '2000',
    );

    let currentStep = 1;
    const unlisten = globe.tileLoadProgressEvent.addEventListener(
      (queueLength) => {
        this.queueLength = queueLength;
        if (currentStep === 1 && globe.tilesLoaded) {
          currentStep = 2;
          onStep1Finished(globe, searchParams);
          setTimeout(() => {
            if (currentStep === 2) {
              currentStep = 3;
              this.onStep2Finished(viewer);
              unlisten();
            }
          }, SKIP_STEP2_TIMEOUT);
        } else if (currentStep === 2 && globe.tilesLoaded) {
          currentStep = 3;
          this.onStep2Finished(viewer);
          unlisten();
        }
      },
    );
  }

  async firstUpdated() {
    setTimeout(() => (this.determinateLoading = true), 3000);
    rewriteParams();
    const cesiumContainer = this.querySelector('#cesium')!;
    const viewer = await setupViewer(cesiumContainer);

    if (!this.showCesiumToolbar && !this.resolutionScaleRemoveCallback) {
      this.setResolutionScale(viewer);
    }

    const l = (count: number) => {
      if (count === 0) {
        this.cesiumService.initialize(viewer);
        viewer.scene.globe.tileLoadProgressEvent.removeEventListener(l);
        this.requestUpdate();
      }
    };
    viewer.scene.globe.tileLoadProgressEvent.addEventListener(l);

    window['viewer'] = viewer; // for debugging

    this.startCesiumLoadingProcess(viewer);
    const topicOrProjectParam = getTopicOrProject();
    if (topicOrProjectParam) {
      this.waitForViewLoading = !!topicOrProjectParam.param.viewId;
      DashboardStore.setTopicOrProjectParam(topicOrProjectParam);
    } else {
      const storedView = LocalStorageController.storedView;
      if (storedView) {
        syncStoredView(storedView);
        LocalStorageController.removeStoredView();
      }
    }

    viewer.camera.moveEnd.addEventListener(() => syncCamera(viewer.camera));
    const { destination, orientation } = getCameraView();
    const zoomToPosition = getZoomToPosition();
    if (!zoomToPosition) {
      viewer.camera.flyTo({
        destination: destination || DEFAULT_VIEW.destination,
        orientation: orientation || DEFAULT_VIEW.orientation,
        duration: 0,
        complete: () => {
          const { destination, orientation } = getCameraView();
          if (!destination || !orientation) {
            syncCamera(viewer.camera);
          }
        },
      });
    }

    i18next.on('initialized', () => {
      this.showSlowLoadingWindow();
    });

    const origin = window.location.origin;
    const pathname = window.location.pathname;
    (<any>this.querySelector('#ngm-home-link')).href = `${origin}${pathname}`;

    window.addEventListener('resize', () => {
      (<any>this.querySelectorAll('.ngm-floating-window')).forEach((flWin) => {
        if (flWin.interaction) {
          flWin.interaction.reflow({ name: 'drag', axis: 'xy' });
        }
      });
    });
  }

  protected updated(changedProperties: PropertyValues) {
    if (changedProperties.has('showCamConfig')) {
      if (this.showCamConfig) {
        (<HTMLElement>(
          document.querySelector('.ngm-cam-lock-info')
        ))?.parentElement?.remove();
      } else if (this.camConfigElement?.lockType) {
        let message = '';
        switch (this.camConfigElement.lockType) {
          case 'angle':
            message = i18next.t('cam_lock_info_angle');
            break;
          case 'elevation':
            message = i18next.t('cam_lock_info_elevation');
            break;
          case 'move':
            message = i18next.t('cam_lock_info_move');
            break;
          case 'pitch':
            message = i18next.t('cam_lock_info_pitch');
            break;
        }
        showSnackbarInfo(message, {
          displayTime: 0,
          class: 'ngm-cam-lock-info',
          actions: [
            {
              text: i18next.t('cancel'),
              click: () => this.camConfigElement.disableLock(),
            },
          ],
        });
        // closeOnClick doesn't work with actions
        document
          .querySelector('.ngm-cam-lock-info .close.icon')
          ?.addEventListener('click', () => {
            (<HTMLElement>(
              document.querySelector('.ngm-cam-lock-info')
            ))?.parentElement?.remove();
          });
      }
    }

    if (changedProperties.has('showCesiumToolbar')) {
      if (!this.showCesiumToolbar && !this.resolutionScaleRemoveCallback) {
        this.setResolutionScale();
      } else if (this.showCesiumToolbar && this.resolutionScaleRemoveCallback) {
        this.resolutionScaleRemoveCallback();
        this.resolutionScaleRemoveCallback = undefined;
      }
    }
    super.updated(changedProperties);
  }

  showSlowLoadingWindow() {
    const timeout = 10000;
    if (this.loading && performance.now() > timeout) {
      (<NgmSlowLoading>this.querySelector('ngm-slow-loading'))!.style.display =
        'block';
    } else {
      setTimeout(() => {
        if (this.loading) {
          (<NgmSlowLoading>(
            this.querySelector('ngm-slow-loading')
          ))!.style.display = 'block';
        }
      }, timeout - performance.now());
    }
  }

  setResolutionScale(viewer?: Viewer) {
    viewer ??= this.cesiumService.viewerOrNull ?? undefined;
    if (viewer === undefined) {
      return;
    }
    const frameRateMonitor = FrameRateMonitor.fromScene(viewer.scene);
    const scaleDownFps = 20;
    const scaleUpFps = 30;
    this.resolutionScaleRemoveCallback =
      viewer.scene.postRender.addEventListener(() => {
        if (
          frameRateMonitor.lastFramesPerSecond < scaleDownFps &&
          viewer.resolutionScale > 0.45
        ) {
          viewer.resolutionScale = Number(
            (viewer.resolutionScale - 0.05).toFixed(2),
          );
        } else if (
          frameRateMonitor.lastFramesPerSecond > scaleUpFps &&
          viewer.resolutionScale < 1
        ) {
          viewer.resolutionScale = Number(
            (viewer.resolutionScale + 0.05).toFixed(2),
          );
        }
      });
  }

  handleTrackingAllowedChanged(event: TrackingConsentModalEvent) {
    this.disclaimer?.close();
    this.disclaimer = null;
    this.showNavigationHint();

    writeConsent(event.detail.isAllowed);

    if (this.clientConfig.env === AppEnv.Prod) {
      initAnalytics(event.detail.isAllowed);
    }
  }

  showNavigationHint() {
    const ctrlHandler = (evt) => {
      if (evt.key === 'Control') {
        (<HTMLElement | null>document.querySelector('.ngm-nav-hint'))?.click();
      }
    };
    showSnackbarInfo(i18next.t('navigation_hint'), {
      class: 'ngm-nav-hint',
      displayTime: 20000,
      onHidden: () => document.removeEventListener('keydown', ctrlHandler),
    });
    document.addEventListener('keydown', ctrlHandler);
  }

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <layout-env-ribbon></layout-env-ribbon>
      <header>
        <div class="left">
          <a id="ngm-home-link" href="">
            <img
              class="hidden-mobile"
              src="/images/swissgeol_viewer.svg"
              height="36"
            />
            <img
              class="visible-mobile"
              src="/images/swissgeol_favicon_viewer.svg"
            />
            <div class="logo-text visible-mobile">swissgeol</div>
          </a>
          <ngm-navigation-search
            .viewer="${this.cesiumService.viewerOrNull}"
          ></ngm-navigation-search>
        </div>
        <ngm-layout-header-actions></ngm-layout-header-actions>
      </header>
      <main>
        <div
          class="ui dimmer ngm-main-load-dimmer ${classMap({
            active: this.loading,
          })}"
        >
          <div ?hidden=${!this.loading} class="ngm-determinate-loader">
            <div
              class="ui inline mini loader ${classMap({
                active: this.loading,
                determinate: this.determinateLoading,
              })}"
            ></div>
            <span ?hidden=${!this.determinateLoading} class="ngm-load-counter"
              >${this.queueLength}</span
            >
          </div>
        </div>
        ${until(
          this.cesiumService.ready.then(
            () => html`<ngm-layout-sidebar></ngm-layout-sidebar> `,
          ),
        )}
        <div class="map" oncontextmenu="return false;">
          <div id="cesium">
            <ngm-slow-loading style="display: none;"></ngm-slow-loading>
            ${until(
              this.cesiumService.ready.then(
                () => html`
                  <ngm-geometry-info
                    class="ngm-floating-window"
                  ></ngm-geometry-info>
                  <ngm-topo-profile-modal
                    class="ngm-floating-window"
                  ></ngm-topo-profile-modal>
                  <ngm-nav-tools
                    class="ngm-floating-window"
                    .showCamConfig=${this.showCamConfig}
                    @togglecamconfig=${() =>
                      (this.showCamConfig = !this.showCamConfig)}
                    @axisstate=${(evt) =>
                      (this.showAxisOnMap = evt.detail.showAxis)}
                  >
                  </ngm-nav-tools>
                `,
              ),
            )}
            <ngm-cam-configuration
              class="ngm-floating-window"
              .hidden=${!this.showCamConfig}
              .viewer=${this.cesiumService.viewerOrNull}
              @close=${() => (this.showCamConfig = false)}
            >
            </ngm-cam-configuration>
            <ngm-project-popup
              class="ngm-floating-window ${classMap({
                compact: this.mobileView,
              })}"
              .hidden=${!this.showProjectPopup}
              @close=${() => (this.showProjectPopup = false)}
            >
            </ngm-project-popup>
            ${until(
              this.cesiumService.ready.then(
                () => html`
                  <ngm-coordinate-popup
                    class="ngm-floating-window"
                  ></ngm-coordinate-popup>
                `,
              ),
            )}

            <div class="on-map-menu">
              <control-compass></control-compass>
              <ngm-map-chooser
                .hidden=${this.mobileView}
                class="ngm-bg-chooser-map"
                .initiallyOpened=${false}
              ></ngm-map-chooser>
            </div>

            <ngm-ogc-queue></ngm-ogc-queue>
          </div>
          ${when(
            this.showCesiumToolbar,
            () => html`<cesium-toolbar></cesium-toolbar>`,
          )}
        </div>
      </main>
    `;
  }
}
