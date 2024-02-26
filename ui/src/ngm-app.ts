import {LitElementI18n} from './i18n';
import type {PropertyValues} from 'lit';
import {html} from 'lit';
import './elements/ngm-side-bar';
import './elements/ngm-full-screen-view';
import './elements/ngm-object-information';
import './elements/ngm-auth';
import './elements/ngm-tracking-consent';
import './elements/ngm-cursor-information';
import './elements/ngm-nav-tools';
import './elements/ngm-minimap';
import './elements/ngm-cam-configuration';
import './elements/ngm-height-slider';
import './toolbox/ngm-topo-profile-modal';
import './toolbox/ngm-geometry-info';
import './elements/ngm-layer-legend';
import './elements/ngm-voxel-filter';
import './elements/ngm-voxel-simple-filter';
import './cesium-toolbar';
import './elements/ngm-project-popup';
import './elements/view-menu';
import './elements/project-selector';
import './elements/ngm-coordinate-popup';

import '@geoblocks/cesium-view-cube';

import {DEFAULT_VIEW} from './constants';

import {setupSearch} from './search.js';
import {addMantelEllipsoid, setupBaseLayers, setupViewer} from './viewer';

import {
  getCameraView,
  getCesiumToolbarParam,
  getTopicOrProject,
  getZoomToPosition,
  rewriteParams,
  syncCamera,
  syncStoredView
} from './permalink';
import i18next from 'i18next';
import Slicer from './geoblocks/cesium-helpers/slicer/Slicer';

import {setupI18n} from './i18n.js';
import QueryManager from './query/QueryManager';

import {initAnalytics} from './analytics.js';
import {initSentry} from './sentry.js';
import MainStore from './store/main';
import ToolboxStore from './store/toolbox';
import {classMap} from 'lit/directives/class-map.js';
import {customElement, query, state} from 'lit/decorators.js';
import {showSnackbarInfo} from './notifications';
import type MapChooser from './MapChooser';
import type {NgmSlowLoading} from './elements/ngm-slow-loading';
import type {Globe, Viewer} from 'cesium';
import type {Config} from './layers/ngm-layers-item';
import LocalStorageController from './LocalStorageController';
import DashboardStore from './store/dashboard';
import type {SideBar} from './elements/ngm-side-bar';

const SKIP_STEP2_TIMEOUT = 5000;

const isLocalhost = document.location.hostname === 'localhost';

const onStep1Finished = (globe: Globe, searchParams: URLSearchParams) => {
  let sse = 2;
  if (isLocalhost) {
    sse = 20;
  }
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
  accessor mapChooser: MapChooser | undefined;
  @state()
  accessor slicer_: Slicer | undefined;
  @state()
  accessor showMinimap = false;
  @state()
  accessor showCamConfig = false;
  @state()
  accessor showMobileSearch = false;
  @state()
  accessor loading = true;
  @state()
  accessor determinateLoading = false;
  @state()
  accessor queueLength = 0;
  @state()
  accessor legendConfigs: Config[] = [];
  @state()
  accessor showTrackingConsent = false;
  @state()
  accessor showProjectPopup = false;
  @state()
  accessor mobileView = false;
  @state()
  accessor showAxisOnMap = false;
  @state()
  accessor showProjectSelector = false;
  @query('ngm-cam-configuration')
  accessor camConfigElement;
  @query('ngm-voxel-filter')
  accessor voxelFilterElement;
  @query('ngm-voxel-simple-filter')
  accessor voxelSimpleFilterElement;
  private viewer: Viewer | undefined;
  private queryManager: QueryManager | undefined;
  private showCesiumToolbar = getCesiumToolbarParam();
  private waitForViewLoading = false;

  constructor() {
    super();

    const boundingRect = document.body.getBoundingClientRect();
    this.mobileView = boundingRect.width < 600 || boundingRect.height < 630;
    window.addEventListener('resize', () => {
      const boundingRect = document.body.getBoundingClientRect();
      this.mobileView = boundingRect.width < 600 || boundingRect.height < 630;
    });
  }

  /**
   * @param {CustomEvent} evt
   */
  onLayerAdded(evt) {
    const layer = evt.detail.layer;
    if (layer.backgroundId !== undefined && this.mapChooser!.elements) {
      this.mapChooser!.selectMap(layer.backgroundId);
    }
    if (this.slicer_ && this.slicer_!.active) {
      if (layer && layer.promise) {
        this.slicer_!.applyClippingPlanesToTileset(layer.promise);
      }
    }
  }

  onShowLayerLegend(event) {
    const config = event.detail.config;
    if (!this.legendConfigs.find(c => c && c.layer === config.layer)) {
      this.legendConfigs.push(config);
      this.requestUpdate();
    }
  }

  onShowVoxelFilter(event: CustomEvent) {
    const config = event.detail.config;
    if (config.voxelFilter) {
      this.voxelFilterElement.config = config;
    } else {
      this.voxelSimpleFilterElement.config = config;
    }
  }

  onCloseLayerLegend(event) {
    const config = event.target.config;
    const index = this.legendConfigs.findIndex(c => c && c.layer === config.layer);
    console.assert(index !== -1);
    delete this.legendConfigs[index];
    if (!this.legendConfigs.filter(c => !!c).length)
      this.legendConfigs = [];
    this.requestUpdate();
  }

  onStep2Finished(viewer) {
    if (!this.waitForViewLoading) {
      this.removeLoading();
    } else {
      const subscription = DashboardStore.viewIndex.subscribe(indx => {
        if (typeof indx !== 'number') return;
        this.removeLoading();
        this.waitForViewLoading = false;
        subscription.unsubscribe();
      });
    }
    this.slicer_ = new Slicer(viewer);
    this.slicer_.draw.addEventListener('drawerror', evt => {
      if (this.slicer_?.draw.ERROR_TYPES.needMorePoints === (<CustomEvent>evt).detail.error) {
        showSnackbarInfo(i18next.t('tbx_error_need_more_points_warning'));
      }
    });
    ToolboxStore.setSlicer(this.slicer_);

    // setup web components
    this.mapChooser = setupBaseLayers(viewer);
    this.mapChooser.addMapChooser(this.querySelector('.ngm-bg-chooser-map')!);
    MainStore.setMapChooser(this.mapChooser);
    // Handle queries (local and Swisstopo)
    this.queryManager = new QueryManager(viewer);

    const sideBar = this.querySelector('ngm-side-bar');

    setupSearch(viewer, this.querySelector('ga-search')!, sideBar);
  }

  removeLoading() {
    this.loading = false;
    this.showTrackingConsent = true;
    const loadingTime = performance.now() / 1000;
    console.log(`loading mask displayed ${(loadingTime).toFixed(3)}s`);
    (<NgmSlowLoading> this.querySelector('ngm-slow-loading')).style.display = 'none';
  }

  /**
   * @param {import ('cesium').Viewer} viewer
   */
  startCesiumLoadingProcess(viewer) {
    const globe = viewer.scene.globe;

    addMantelEllipsoid(viewer);

    // Temporarily increasing the maximum screen space error to load low LOD tiles.
    const searchParams = new URLSearchParams(document.location.search);
    globe.maximumScreenSpaceError = parseFloat(searchParams.get('initialScreenSpaceError') || '2000');

    let currentStep = 1;
    const unlisten = globe.tileLoadProgressEvent.addEventListener(queueLength => {
      this.queueLength = queueLength;
      if (currentStep === 1 && globe.tilesLoaded) {
        currentStep = 2;
        console.log('Step 1 finished');
        onStep1Finished(globe, searchParams);
        setTimeout(() => {
          if (currentStep === 2) {
            console.log('Too long: going straight to step 3');
            currentStep = 3;
            this.onStep2Finished(viewer);
            unlisten();
          }
        }, SKIP_STEP2_TIMEOUT);
      } else if (currentStep === 2 && globe.tilesLoaded) {
        currentStep = 3;
        console.log('Step 2 finished');
        this.onStep2Finished(viewer);
        unlisten();
      }
    });
  }

  async firstUpdated() {
    setTimeout(() => this.determinateLoading = true, 3000);
    setupI18n();
    rewriteParams();
    const cesiumContainer = this.querySelector('#cesium')!;
    const viewer = await setupViewer(cesiumContainer, isLocalhost);
    this.viewer = viewer;
    window['viewer'] = viewer; // for debugging

    this.startCesiumLoadingProcess(viewer);
    const topicOrProjectParam = getTopicOrProject();
    if (topicOrProjectParam) {
      this.waitForViewLoading = !!topicOrProjectParam.param.viewId;
      !this.waitForViewLoading && (<SideBar> this.querySelector('ngm-side-bar')).togglePanel('dashboard');
      DashboardStore.setTopicOrProjectParam(topicOrProjectParam);
    } else {
      const storedView = LocalStorageController.storedView;
      if (storedView) {
        syncStoredView(storedView);
        LocalStorageController.removeStoredView();
      }
    }

    viewer.camera.moveEnd.addEventListener(() => syncCamera(viewer.camera));
    const {destination, orientation} = getCameraView();
    const zoomToPosition = getZoomToPosition();
    if (!zoomToPosition) {
      viewer.camera.flyTo({
        destination: destination || DEFAULT_VIEW.destination,
        orientation: orientation || DEFAULT_VIEW.orientation,
        duration: 0,
        complete: () => {
          const {destination, orientation} = getCameraView();
          if (!destination || !orientation) {
            syncCamera(viewer.camera);
          }
        }
      });
    }

    MainStore.setViewer(viewer);

    i18next.on('initialized', () => {
      this.showSlowLoadingWindow();
    });

    const origin = window.location.origin;
    const pathname = window.location.pathname;
    (<any> this.querySelector('#ngm-home-link')).href = `${origin}${pathname}`;

    window.addEventListener('resize', () => {
      (<any> this.querySelectorAll('.ngm-floating-window')).forEach(flWin => {
        if (flWin.interaction) {
          flWin.interaction.reflow({name: 'drag', axis: 'xy'});
        }
      });
    });
  }

  protected updated(changedProperties: PropertyValues) {
    if (changedProperties.has('showCamConfig')) {
      if (this.showCamConfig) {
        (<HTMLElement>document.querySelector('.ngm-cam-lock-info'))?.parentElement?.remove();
      } else if (this.camConfigElement.lockType) {
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
        showSnackbarInfo(message,
          {
            displayTime: 0,
            class: 'ngm-cam-lock-info',
            actions: [
              {
                text: i18next.t('app_cancel_btn_label'),
                click: () => this.camConfigElement.disableLock()
              }]
          });
        // closeOnClick doesn't work with actions
        document.querySelector('.ngm-cam-lock-info')?.addEventListener('click', () => {
          (<HTMLElement>document.querySelector('.ngm-cam-lock-info'))?.parentElement?.remove();
        });
      }
    }
    super.updated(changedProperties);
  }

  showSlowLoadingWindow() {
    const timeout = 10000;
    if (this.loading && performance.now() > timeout) {
      (<NgmSlowLoading> this.querySelector('ngm-slow-loading'))!.style.display = 'block';
    } else {
      setTimeout(() => {
        if (this.loading) {
          (<NgmSlowLoading> this.querySelector('ngm-slow-loading'))!.style.display = 'block';
        }
      }, timeout - performance.now());
    }
  }

  onTrackingAllowedChanged(event) {
    this.showNavigationHint();
    initSentry(event.detail.allowed);
    initAnalytics(event.detail.allowed);
  }

  showNavigationHint() {
    const ctrlHandler = evt => {
      if (evt.key === 'Control') {
        (<HTMLElement | null>document.querySelector('.ngm-nav-hint'))?.click();
      }
    };
    showSnackbarInfo(i18next.t('navigation_hint'), {
      class: 'ngm-nav-hint',
      displayTime: 20000,
      onHidden: () => document.removeEventListener('keydown', ctrlHandler)
    });
    document.addEventListener('keydown', ctrlHandler);
  }

  render() {
    return html`
      <header class="${classMap({'mobile-search-active': this.showMobileSearch})}">
        <a id="ngm-home-link" href="" .hidden="${this.showMobileSearch}">
          <img class="hidden-mobile" src="src/images/logo-CH.svg">
          <img class="visible-mobile" src="src/images/logo-CH-small.svg">
          <div class="logo-text visible-mobile">swissgeol</div>
        </a>
        <ga-search class="ui big icon input ${classMap({'active': this.showMobileSearch})}" types="location,additionalSource,layer, feature"
                   locationOrigins="zipcode,gg25,gazetteer">
          <input type="search" placeholder="${i18next.t('header_search_placeholder')}">
          <div class="ngm-search-icon-container ngm-search-icon"></div>
          <ul class="search-results"></ul>
        </ga-search>
        <div style="flex: 1;" .hidden="${this.showMobileSearch}"></div>
        <div
          class="ngm-search-icon-mobile ngm-search-icon visible-mobile ${classMap({'active': this.showMobileSearch})}"
          @click="${() => this.showMobileSearch = !this.showMobileSearch}"></div>
        <div title="${i18next.t('header_show_minimap')}" class="ngm-map-icon ${classMap({'active': this.showMinimap})}" .hidden="${this.showMobileSearch}"
             @click=${() => this.showMinimap = !this.showMinimap}></div>
        <ngm-cursor-information class="hidden-mobile" .viewer="${this.viewer}"></ngm-cursor-information>
      </header>
      <main>
        <div class="ui dimmer ngm-main-load-dimmer ${classMap({active: this.loading})}">
          <div ?hidden=${!this.loading} class="ngm-determinate-loader">
            <div
              class="ui inline mini loader ${classMap({
                active: this.loading,
                determinate: this.determinateLoading
              })}">
            </div>
            <span ?hidden=${!this.determinateLoading} class="ngm-load-counter">${this.queueLength}</span>
          </div>
        </div>
        <ngm-side-bar
          .queryManager=${this.queryManager}
          .mobileView=${this.mobileView}
          @layeradded=${this.onLayerAdded}
          @showLayerLegend=${this.onShowLayerLegend}
          @showVoxelFilter=${this.onShowVoxelFilter}>
        </ngm-side-bar>
        <div class='map' oncontextmenu="return false;">
          <div id='cesium'>
            <ngm-slow-loading style='display: none;'></ngm-slow-loading>
            <ngm-geometry-info class="ngm-floating-window"></ngm-geometry-info>
            <ngm-object-information class="ngm-floating-window"></ngm-object-information>
            <ngm-topo-profile-modal class="ngm-floating-window"></ngm-topo-profile-modal>
            <ngm-nav-tools class="ngm-floating-window" .showCamConfig=${this.showCamConfig}
                           @togglecamconfig=${() => this.showCamConfig = !this.showCamConfig}
                           @axisstate=${evt => this.showAxisOnMap = evt.detail.showAxis}>
            </ngm-nav-tools>
            <ngm-minimap class="ngm-floating-window" .viewer=${this.viewer} .hidden=${!this.showMinimap}
                         @close=${() => this.showMinimap = false}>
            </ngm-minimap>
            <ngm-cam-configuration class="ngm-floating-window"
                                   .hidden=${!this.showCamConfig}
                                   .viewer=${this.viewer}
                                   @close=${() => this.showCamConfig = false}>
            </ngm-cam-configuration>
            <ngm-project-popup class="ngm-floating-window ${classMap({'compact': this.mobileView})}"
                               .hidden=${!this.showProjectPopup}
                               @close=${() => this.showProjectPopup = false}>
            </ngm-project-popup>
            <ngm-height-slider .viewer=${this.viewer}></ngm-height-slider>
            ${[...this.legendConfigs].map(config => config ? html`
              <ngm-layer-legend class="ngm-floating-window" .config=${config}
                                @close=${this.onCloseLayerLegend}></ngm-layer-legend>
            ` : '')}
            <project-selector class="ngm-floating-window"
                              .hidden=${!this.showProjectSelector}
                              .showProjectSelector=${this.showProjectSelector}
                              @close=${() => this.showProjectSelector = false}>
            </project-selector>
            <ngm-voxel-filter class="ngm-floating-window" .viewer=${this.viewer} hidden></ngm-voxel-filter>
            <ngm-voxel-simple-filter class="ngm-floating-window" .viewer=${this.viewer} hidden></ngm-voxel-simple-filter>
            <ngm-coordinate-popup class="ngm-floating-window"></ngm-coordinate-popup>
            <div class="on-map-menu">
              <cesium-view-cube ?hidden=${this.mobileView || this.showAxisOnMap}
                                .scene="${this.viewer?.scene}"></cesium-view-cube>

              <ngm-map-chooser .hidden=${this.mobileView} class="ngm-bg-chooser-map"
                              .initiallyOpened=${false}></ngm-map-chooser>
              <view-menu class="view-menu"
                         @toggleProjectSelector=${() => this.showProjectSelector = !this.showProjectSelector}>
              </view-menu>
            </div>
            <a class="contact-mailto-link" target="_blank"
               href="mailto:swissgeol@swisstopo.ch">${i18next.t('contact_mailto_text')}</a>
            <a class="disclaimer-link" target="_blank"
               href="${i18next.t('disclaimer_href')}">${i18next.t('disclaimer_text')}</a>
          </div>
          ${this.showCesiumToolbar ? html`
            <cesium-toolbar></cesium-toolbar>` : ''}
          ${this.showTrackingConsent ? html`
            <ngm-tracking-consent @change=${this.onTrackingAllowedChanged}></ngm-tracking-consent>` : ''}
        </div>
      </main>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
