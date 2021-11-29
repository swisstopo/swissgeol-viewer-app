import {LitElementI18n} from './i18n';
import {html} from 'lit';
import './elements/ngm-side-bar';
import './elements/ngm-full-screen-view';
import './elements/ngm-object-information';
import './elements/ngm-feature-height';
import './elements/ngm-auth';
import './elements/ngm-tracking-consent';
import './elements/ngm-camera-information.js';
import './elements/ngm-nav-tools';
import './elements/ngm-minimap';
import './elements/ngm-cam-configuration';
import './elements/ngm-height-slider';
import './elements/ngm-layer-legend-container';
import './toolbox/ngm-geometry-info';

import {DEFAULT_VIEW} from './constants';

import {setupSearch} from './search.js';
import {addMantelEllipsoid, setupBaseLayers, setupViewer} from './viewer';

import {getCameraView, getZoomToPosition, syncCamera} from './permalink';
import i18next from 'i18next';
import Slicer from './slicer/Slicer';

import {setupI18n} from './i18n.js';
import QueryManager from './query/QueryManager';

import {initAnalytics} from './analytics.js';
import {initSentry} from './sentry.js';
import MainStore from './store/main';
import ToolboxStore from './store/toolbox';
import {classMap} from 'lit/directives/class-map.js';
import {customElement, state} from 'lit/decorators.js';
import MapChooser from './MapChooser';
import {NgmLayerLegendContainer} from './elements/ngm-layer-legend-container';
import {NgmSlowLoading} from './elements/ngm-slow-loading';
import {Viewer} from 'cesium';

const SKIP_STEP2_TIMEOUT = 5000;

const isLocalhost = document.location.hostname === 'localhost';

const onStep1Finished = (globe, searchParams: URLSearchParams) => {
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
  @state() mapChooser: MapChooser | undefined;
  @state() slicer_: Slicer | undefined;
  @state() showMinimap = false;
  @state() showCamConfig = false;
  @state() loading = true;
  @state() determinateLoading = false;
  @state() queueLength = 0;
  private viewer: Viewer | undefined;
  private queryManager: QueryManager | undefined;

  constructor() {
    super();
    // disable drag events to avoid appearing of drag&drop zone
    this.addEventListener('dragstart', e => e.preventDefault());
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
    (<NgmLayerLegendContainer> this.querySelector('ngm-layer-legend-container')).showLegend(event.detail.config);
  }

  onStep2Finished(viewer) {
    this.loading = false;
    const loadingTime = performance.now() / 1000;
    console.log(`loading mask displayed ${(loadingTime).toFixed(3)}s`);
    (<NgmSlowLoading> this.querySelector('ngm-slow-loading')).style.display = 'none';
    this.slicer_ = new Slicer(viewer);
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

  firstUpdated() {
    setTimeout(() => this.determinateLoading = true, 3000);
    setupI18n();
    const cesiumContainer = this.querySelector('#cesium')!;
    const viewer = setupViewer(cesiumContainer, isLocalhost);
    this.viewer = viewer;
    window['viewer'] = viewer; // for debugging

    this.startCesiumLoadingProcess(viewer);

    const {destination, orientation} = getCameraView();
    const zoomToPosition = getZoomToPosition();
    if (!zoomToPosition) {
      viewer.camera.flyTo({
        destination: destination || DEFAULT_VIEW.destination,
        orientation: orientation || DEFAULT_VIEW.orientation,
        duration: 0
      });
    }

    viewer.camera.moveEnd.addEventListener(() => syncCamera(viewer.camera));

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
    initSentry(event.detail.allowed);
    initAnalytics(event.detail.allowed);
  }

  render() {
    return html`
      <header>
        <a id="ngm-home-link" href=""><img class="logo" src="src/images/logo-CH.svg"></a>
        <ga-search class="ui big icon input" types="location,layer" locationOrigins="zipcode,gg25,gazetteer">
          <input type="search" placeholder="${i18next.t('header_search_placeholder')}">
          <div class="ngm-search-icon-container ngm-search-icon"></div>
          <ul class="search-results"></ul>
        </ga-search>
        <div class="ngm-map-icon ${classMap({'ngm-map-active': this.showMinimap})}"
             @click=${() => this.showMinimap = !this.showMinimap}></div>
        <ngm-camera-information .viewer="${this.viewer}"></ngm-camera-information>
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
          @layeradded=${this.onLayerAdded}
          @showLayerLegend=${this.onShowLayerLegend}>
        </ngm-side-bar>
        <div class='map'>
          <div id='cesium'>
            <ngm-slow-loading style='display: none;'></ngm-slow-loading>
            <ngm-geometry-info class="ngm-floating-window"></ngm-geometry-info>
            <ngm-object-information class="ngm-floating-window"></ngm-object-information>
            <ngm-nav-tools class="ngm-floating-window" .viewer=${this.viewer} .showCamConfig=${this.showCamConfig}
                           @togglecamconfig=${() => this.showCamConfig = !this.showCamConfig}>
            </ngm-nav-tools>
            <ngm-minimap class="ngm-floating-window" .viewer=${this.viewer} .hidden=${!this.showMinimap}
                         @close=${() => this.showMinimap = false}>
            </ngm-minimap>
            <ngm-cam-configuration class="ngm-floating-window"
                                   .hidden=${!this.showCamConfig}
                                   .viewer=${this.viewer}
                                   @close=${() => this.showCamConfig = false}>
            </ngm-cam-configuration>
            <ngm-height-slider .viewer=${this.viewer}></ngm-height-slider>
            <ngm-layer-legend-container></ngm-layer-legend-container>
            <ngm-map-chooser class="ngm-bg-chooser-map" .initiallyOpened=${false}></ngm-map-chooser>
            <a class="disclaimer-link" target="_blank"
               href="${i18next.t('disclaimer_href')}">${i18next.t('disclaimer_text')}</a>
          </div>
          <ngm-tracking-consent @change=${this.onTrackingAllowedChanged}></ngm-tracking-consent>
        </div>
      </main>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
