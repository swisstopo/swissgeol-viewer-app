import {LitElementI18n} from './i18n';
import {html} from 'lit-html';
import './elements/ngm-loading-mask';
import './elements/ngm-left-side-bar';
import './elements/ngm-slow-loading';
import './elements/ngm-navigation-widgets';
import './elements/ngm-full-screen-view';
import './elements/ngm-object-information';
import './elements/ngm-feature-height';
import './elements/ngm-auth';
import './elements/ngm-drop-files';
import './elements/ngm-tracking-consent';
import './elements/ngm-layer-legend-container';
import './elements/ngm-camera-information.js';

import {
  DEFAULT_VIEW,
} from './constants.js';

import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid, setupBaseLayers} from './viewer.js';

import {getCameraView, getSliceParam, syncCamera, syncSliceParam} from './permalink.js';
import i18next from 'i18next';
import {getZoomToPosition} from './permalink';
import Slicer from './slicer/Slicer.js';

import {setupI18n} from './i18n.js';
import QueryManager from './query/QueryManager';

import {initAnalytics} from './analytics.js';
import {initSentry} from './sentry.js';
import {showWarning} from './message';
import MainStore from './store/main.ts';
import SlicerStore from './store/slicer.ts';

const SKIP_STEP2_TIMEOUT = 5000;

const isLocalhost = document.location.hostname === 'localhost';

const onStep1Finished = (globe, searchParams) => {
  let sse = 2;
  if (isLocalhost) {
    sse = 20;
  }
  if (searchParams.has('maximumScreenSpaceError')) {
    sse = parseFloat(searchParams.get('maximumScreenSpaceError'));
  }
  globe.maximumScreenSpaceError = sse;
};

/**
 * This is the root component. It is useful for:
 * - wiring the attributes of all top-level components;
 * - distribute events vertically between components (non hierarchical).
 */
class NgmApp extends LitElementI18n {

  /**
   * @type {import('lit-element').PropertyDeclarations}
   */
  static get properties() {
    return {
      mapChooser: {type: Object, attribute: false},
      slicer_: {type: Object, attribute: false},
    };
  }

  constructor() {
    super();
    this.slicer_ = null;
    this.mapChooser = null;
  }

  /**
   * @param {CustomEvent} evt
   */
  onLayerAdded(evt) {
    const layer = evt.detail.layer;
    if (layer.backgroundId !== undefined && this.mapChooser.element) {
      this.mapChooser.selectMap(layer.backgroundId);
    }
    if (this.slicer_ && this.slicer_.active) {
      if (layer && layer.promise) {
        this.slicer_.applyClippingPlanesToTileset(layer.promise);
      }
    }
  }

  onShowLayerLegend(event) {
    this.querySelector('ngm-layer-legend-container').showLegend(event.detail.config);
  }

  onStep2Finished({loadingMask, viewer}) {
    loadingMask.active = false;
    const loadingTime = performance.now() / 1000;
    console.log(`loading mask displayed ${(loadingTime).toFixed(3)}s`);
    this.querySelector('ngm-slow-loading').style.display = 'none';
    this.slicer_ = new Slicer(viewer);
    const sliceOptions = getSliceParam();
    if (sliceOptions && sliceOptions.type && sliceOptions.slicePoints) {
      this.slicer_.sliceOptions = {
        ...this.slicer_.sliceOptions, ...sliceOptions,
        syncBoxPlanesCallback: (sliceInfo) => syncSliceParam(sliceInfo),
        deactivationCallback: () => {
          this.querySelector('ngm-slicer').onDeactivation();
        }
      };
      this.slicer_.active = true;
    }
    SlicerStore.setSlicer(this.slicer_);

    // setup web components
    this.mapChooser = setupBaseLayers(viewer);
    MainStore.setMapChooser(this.mapChooser);
    // Handle queries (local and Swisstopo)
    this.queryManager = new QueryManager(viewer);

    const sideBar = this.querySelector('ngm-left-side-bar');

    setupSearch(viewer, this.querySelector('ga-search'), sideBar);
  }


  /**
   * @param file
   * @param {'toolbox'|'model'} type
   */
  onFileDrop(file, type) {
    if (type === 'toolbox') {
      const aoi = this.querySelector('ngm-aoi-drawer');
      if (file.name.toLowerCase().endsWith('.kml')) {
        aoi.uploadKml(file);
      } else if (file.name.toLowerCase().endsWith('.gpx')) {
        aoi.uploadGpx(file);
      }
    } else if (type === 'model') {
      if (file.name.toLowerCase().endsWith('.kml')) {
        const kmlUpload = this.querySelector('ngm-layers-upload');
        kmlUpload.uploadKml(file);
      } else {
        showWarning(i18next.t('dtd_file_not_kml'));
      }
    }
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
    const loadingMask = this.querySelector('ngm-loading-mask');
    const unlisten = globe.tileLoadProgressEvent.addEventListener(queueLength => {
      loadingMask.message = queueLength;
      if (currentStep === 1 && globe.tilesLoaded) {
        currentStep = 2;
        loadingMask.step = currentStep;
        console.log('Step 1 finished');
        onStep1Finished(globe, searchParams);
        setTimeout(() => {
          if (currentStep === 2) {
            console.log('Too long: going straight to step 3');
            currentStep = 3;
            this.onStep2Finished({loadingMask, viewer});
            unlisten();
          }
        }, SKIP_STEP2_TIMEOUT);
      } else if (currentStep === 2 && globe.tilesLoaded) {
        currentStep = 3;
        console.log('Step 2 finished');
        this.onStep2Finished({loadingMask, viewer});
        unlisten();
      }
    });


  }

  firstUpdated() {
    setupI18n();
    const cesiumContainer = this.querySelector('#cesium');
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
    this.querySelector('#ngm-home-link').href = `${origin}${pathname}`;
  }

  showSlowLoadingWindow() {
    const timeout = 10000;
    const loadingMask = this.querySelector('ngm-loading-mask');
    if (loadingMask.active && performance.now() > timeout) {
      this.querySelector('ngm-slow-loading').style.display = 'block';
    } else {
      setTimeout(() => {
        if (loadingMask.active) {
          this.querySelector('ngm-slow-loading').style.display = 'block';
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
          <i class="search icon"></i>
          <ul class="search-results"></ul>
        </ga-search>
        <ngm-camera-information .viewer="${this.viewer}"></ngm-camera-information>
      </header>
      <main>
        <!-- FIXME: move ngm-auth elsewhere  -->
        <ngm-auth style="display: none"
          endpoint='https://ngm-prod.auth.eu-west-1.amazoncognito.com/oauth2/authorize'
          clientId='6brvjsufv7fdubr12r9u0gajnj'
          @refresh=${(evt) => {
            this.authenticated = evt.detail.authenticated;
            this.userGroups = evt.detail.groups;
          }}
        ></ngm-auth>
        <ngm-drop-files @filedrop="${event => this.onFileDrop(event.detail.file, event.detail.type)}"
                        .target="${document.body}"></ngm-drop-files>
        <ngm-loading-mask></ngm-loading-mask>
        <ngm-left-side-bar
          .queryManager=${this.queryManager}
          @layeradded=${this.onLayerAdded}
          @showLayerLegend=${this.onShowLayerLegend}
          class='left sidebar'>
        </ngm-left-side-bar>
        <div class='map'>
          <div id='cesium'>
            <ngm-slow-loading style='display: none;'></ngm-slow-loading>
            <div class='navigation-widgets'>
              <ngm-navigation-widgets data-fs='no'></ngm-navigation-widgets>
              <ngm-full-screen-view></ngm-full-screen-view>
            </div>
            <ngm-object-information></ngm-object-information>
            <ngm-layer-legend-container></ngm-layer-legend-container>
          </div>
          <div class='footer'>
            <div class='ui horizontal link list'>
              <ngm-feature-height .viewer=${this.viewer} class='item'></ngm-feature-height>
            </div>
            <div style='flex: auto;'></div>
            <div class='ui horizontal link list'>
              <a class='item' target='_blank' href='https://www.geologieportal.ch'>www.geologieportal.ch</a>
              <a class='item' target='_blank' href="${i18next.t('disclaimer_href')}">${i18next.t('disclaimer_text')}</a>
            </div>
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

customElements.define('ngm-app', NgmApp);
