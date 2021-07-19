import {LitElementI18n} from './i18n';
import {html} from 'lit-html';
import './elements/ngm-loading-mask';
import './elements/ngm-left-side-bar';
import './elements/ngm-slow-loading';
import './elements/ngm-navigation-widgets';
import './elements/ngm-full-screen-view';
import './elements/ngm-object-information';
import './elements/ngm-review-window';
import './elements/ngm-feature-height';
import './elements/ngm-auth';
import './elements/ngm-drop-files';
import './elements/ngm-tracking-consent';
import './elements/ngm-layer-legend-container';

import {
  DEFAULT_VIEW,
  SWITZERLAND_RECTANGLE,
} from './constants.js';

import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid, setupBaseLayers} from './viewer.js';

import {getCameraView, getSliceParam, syncCamera, syncSliceParam} from './permalink.js';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import i18next from 'i18next';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid';

import {LocalStorageController} from './LocalStorageController.js';
import {getZoomToPosition} from './permalink';
import Slicer from './slicer/Slicer.js';

import {setupI18n} from './i18n.js';
import QueryManager from './query/QueryManager';

import {initAnalytics} from './analytics.js';
import {initSentry} from './sentry.js';
import {getMeasurements} from './cesiumutils';

const SKIP_STEP2_TIMEOUT = 5000;

const localStorageController = new LocalStorageController();
const isLocalhost = document.location.hostname === 'localhost';

async function zoomTo(viewer, config) {
  const p = await config.promise;
  if (p.boundingSphere) {
    const switzerlandBS = BoundingSphere.fromRectangle3D(SWITZERLAND_RECTANGLE, Ellipsoid.WGS84);
    let radiusCoef = switzerlandBS.radius / p.boundingSphere.radius;
    radiusCoef = radiusCoef > 3 ? 3 : radiusCoef;
    let boundingSphere = p.boundingSphere;
    const zoomHeadingPitchRange = new HeadingPitchRange(0, Math.PI / 8, radiusCoef * p.boundingSphere.radius);
    if (radiusCoef <= 1) {
      zoomHeadingPitchRange.range = p.boundingSphere.radius * 0.8;
      zoomHeadingPitchRange.heading = Math.PI / 2;
      boundingSphere = switzerlandBS;
    }
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange
    });
  } else {
    viewer.zoomTo(p);
  }
}


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
      viewer: {type: Object, attribute: false},
      mapChooser: {type: Object, attribute: false},
      slicer_: {type: Object, attribute: false},
      authenticated: {type: Boolean, attribute: false},
      userGroups: {type: Object, attribute: false},
    };
  }

  constructor() {
    super();
    this.slicer_ = null;
    this.viewer = null;
    this.mapChooser = null;
  }

  /**
   * @param {CustomEvent} evt
   */
  onLayerAdded(evt) {
    const layer = evt.detail.layer;
    if (layer.backgroundId !== undefined) {
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
          syncSliceParam();
          this.querySelector('ngm-slicer').requestUpdate();
        }
      };
      this.slicer_.active = true;
    }

    // setup web components
    this.mapChooser = setupBaseLayers(viewer);
    this.viewer = viewer;
    const auth = this.querySelector('ngm-auth');
    this.authenticated = !!auth.user;
    this.userGroups = auth.userGroups;
    // Handle queries (local and Swisstopo)
    this.queryManager = new QueryManager(this.viewer, this.querySelector('ngm-object-information'));

    const sideBar = this.querySelector('ngm-left-side-bar');

    setupSearch(viewer, this.querySelector('ga-search'), sideBar);
  }


  onFileDrop(file) {
    const aoi = this.querySelector('ngm-aoi-drawer');
    if (file.name.toLowerCase().endsWith('.kml')) {
      aoi.uploadKml(file);
    } else if (file.name.toLowerCase().endsWith('.gpx')) {
      aoi.uploadGpx(file);
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

    i18next.on('languageChanged', (lang) => {
      this.querySelector('#ngm-help-btn').href =
        lang === 'de' ? './manuals/manual_de.html' : './manuals/manual_en.html';
    });

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

  onCreateRectangle() {
    const aoi = this.querySelector('ngm-aoi-drawer');
    const bbox = this.slicer_.slicingBox.bbox;
    const type = 'rectangle';
    const positions = [
      bbox.corners.bottomRight,
      bbox.corners.bottomLeft,
      bbox.corners.topLeft,
      bbox.corners.topRight
    ];
    aoi.increaseAreasCounter(type);
    aoi.addAreaEntity({
      type: type,
      positions: positions,
      volumeHeightLimits: {
        height: bbox.height,
        lowerLimit: bbox.lowerLimit - bbox.altitude
      },
      volumeShowed: true,
      ...getMeasurements(positions, type)
    });
    this.slicer_.active = false;
    this.querySelector('#ngm-toolbox > .title').classList.add('active');
    this.querySelector('#ngm-toolbox > .content').classList.add('active');
  }

  render() {
    return html`
      <header>
        <a id="ngm-home-link" href=""><img class="logo" src="src/images/logo-CH.svg"></a>
        <ga-search class="ui small left icon input" types="location,layer" locationOrigins="zipcode,gg25,gazetteer">
          <input type="search" placeholder="${i18next.t('header_search_placeholder')}">
          <i class="search icon"></i>
          <ul class="search-results"></ul>
        </ga-search>
        <div style="flex: auto;"></div>
        <div class="ngm-header-links">
          <div id="langs" class="ui horizontal selection list"></div>
          <a id="ngm-help-btn" href="/manuals/manual_en.html" target="_blank">${i18next.t('header_help_link')}</a>
          <ngm-auth
            endpoint='https://ngm-prod.auth.eu-west-1.amazoncognito.com/oauth2/authorize'
            clientId='6brvjsufv7fdubr12r9u0gajnj'
            @refresh=${(evt) => {
              this.authenticated = evt.detail.authenticated;
              this.userGroups = evt.detail.groups;
            }}
          ></ngm-auth>
        </div>
      </header>
      <main>
        <ngm-drop-files @filedrop="${event => this.onFileDrop(event.detail.file)}"
                        .target="${document.body}"></ngm-drop-files>
        <ngm-loading-mask></ngm-loading-mask>
        <ngm-left-side-bar
          .authenticated=${this.authenticated}
          .userGroups=${this.userGroups}
          @welcome_panel_changed=${localStorageController.updateWelcomePanelState}
          .hideWelcome=${localStorageController.hideWelcomeValue}
          .hideCatalog=${localStorageController.hideCatalogValue}
          @catalog_panel_changed=${localStorageController.toggleCatalogState}
          .zoomTo=${zoomTo}
          .localStorageController=${localStorageController}
          @layeradded=${this.onLayerAdded}
          @showLayerLegend=${this.onShowLayerLegend}
          .slicer=${this.slicer_}
          .viewer=${this.viewer}
          .mapChooser=${this.mapChooser}
          .queryManager=${this.queryManager}
          class='left sidebar'>
        </ngm-left-side-bar>
        <div class='map'>
          <div id='cesium'>
            <ngm-slow-loading style='display: none;'></ngm-slow-loading>
            <div class='navigation-widgets'>
              <ngm-navigation-widgets
                .viewer=${this.viewer}
                .slicer=${this.slicer_}
                @createrectangle=${this.onCreateRectangle}
                data-fs='no'>
              </ngm-navigation-widgets>
              <ngm-full-screen-view></ngm-full-screen-view>
            </div>
            <ngm-object-information></ngm-object-information>
            <ngm-layer-legend-container></ngm-layer-legend-container>
            <ngm-review-window
              .hideReviewWindow=${localStorageController.hideReviewWindowValue}
              @review_window_changed=${localStorageController.updateReviewWindowState};
              data-fs='no'>
            </ngm-review-window>
          </div>
          <div class='footer'>
            <div class='ui horizontal link list'>
              <ngm-feature-height class='item'
                                  .viewer=${this.viewer}
              ></ngm-feature-height>
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
