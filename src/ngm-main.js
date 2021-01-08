import {I18nMixin} from './i18n';
import {html} from 'lit-html';
import './elements/ngm-loading-mask';
import './elements/ngm-left-side-bar';
import './elements/ngm-slow-loading';
import './elements/ngm-navigation-widgets';
import './elements/ngm-full-screen-view';
import './elements/ngm-object-information';
import './elements/ngm-review-window';
import './elements/ngm-feature-height';

import {
  DEFAULT_VIEW,
  SWITZERLAND_RECTANGLE,
} from './constants.js';

import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid, setupBaseLayers} from './viewer.js';

import {getCameraView, syncCamera} from './permalink.js';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import {showMessage} from './message.js';
import i18next from 'i18next';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid';

import {LocalStorageController} from './LocalStorageController.js';
import {getZoomToPosition} from './permalink';
import Slicer from './Slicer.js';

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

class NgmMain extends I18nMixin {

  /**
   * @type {import('lit-element').PropertyDeclarations}
   */
  static get properties() {
    return {
      viewer: {type: Object},
      mapChooser: {type: Object},
    };
  }

  constructor() {
    super();
    this.slicer_ = null;
    this.viewer = null;
  }

  onLayerAdded(evt) {
    if (this.slicer_ && this.slicer_.active) {
      const layer = evt.detail.layer;
      if (layer && layer.promise) {
        this.slicer_.applyClippingPlanesToTileset(layer.promise);
      }
    }
  }

  onStep2Finished({loadingMask, viewer, auth}) {
    loadingMask.active = false;
    const loadingTime = performance.now() / 1000;
    console.log(`loading mask displayed ${(loadingTime).toFixed(3)}s`);
    this.querySelector('ngm-slow-loading').style.display = 'none';
    const slicer = this.slicer_ = new Slicer(viewer);
    // setup web components

    this.mapChooser = setupBaseLayers(viewer);
    this.viewer = viewer;

    const widgets = this.querySelector('ngm-navigation-widgets');
    widgets.viewer = viewer;
    widgets.slicer = slicer;
    const sideBar = this.querySelector('ngm-left-side-bar');
    sideBar.authenticated = !!auth.user;
    auth.addEventListener('refresh', (evt) => sideBar.authenticated = evt.detail.authenticated);

    addMantelEllipsoid(viewer);
    setupSearch(viewer, document.querySelector('ga-search'), sideBar);

    const sentryConfirmed = localStorageController.isSentryConfirmed;
    if (!sentryConfirmed) {
      const options = {
        displayTime: 0,
        position: 'bottom right',
        classActions: 'basic left',
        actions: [{
          text: i18next.t('sentry_ok_btn_label'),
          click: localStorageController.saveSentryConfirmation
        }]
      };
      showMessage(i18next.t('sentry_message'), options);
    }

    // Ugly hack: wait for the ngm-left-bar to be initialized
    setTimeout(() => {
      const aoiElement = this.querySelector('ngm-aoi-drawer');
      aoiElement.slicer = slicer;
      aoiElement.addStoredAreas(localStorageController.getStoredAoi());
      aoiElement.addEventListener('aoi_list_changed', evt =>
        localStorageController.setAoiInStorage(evt.detail.entities));
    });

    const reviewWindowElement = document.querySelector('ngm-review-window');
    reviewWindowElement.hideReviewWindow = localStorageController.hideReviewWindowValue;
    reviewWindowElement.addEventListener('review_window_changed', localStorageController.updateReviewWindowState);

    sideBar.zoomToPermalinkObject();
  }

  firstUpdated() {
    console.error('XXXXXXXXXXXXX');
    const cesiumContainer = this.querySelector('#cesium');
    const viewer = setupViewer(cesiumContainer, isLocalhost);

    const loadingMask = document.querySelector('ngm-loading-mask');
    const scene = viewer.scene;
    window.scene = scene;
    const globe = scene.globe;

    // Temporarily increasing the maximum screen space error to load low LOD tiles.
    const searchParams = new URLSearchParams(document.location.search);
    globe.maximumScreenSpaceError = parseFloat(searchParams.get('initialScreenSpaceError') || '2000');

    // setup auth component
    const auth = document.querySelector('ngm-auth');
    auth.endpoint = 'https://mylogin.auth.eu-central-1.amazoncognito.com/oauth2/authorize';
    auth.clientId = '5k1mgef7ggiremt415eecn95ki';

    let currentStep = 1;
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
            this.onStep2Finished({auth, loadingMask, viewer});
            unlisten();
          }
        }, SKIP_STEP2_TIMEOUT);
      } else if (currentStep === 2 && globe.tilesLoaded) {
        currentStep = 3;
        console.log('Step 2 finished');
        this.onStep2Finished({auth, loadingMask, viewer});
        unlisten();
      }
    });

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


    document.querySelector('ngm-feature-height').viewer = viewer;

    i18next.on('languageChanged', (lang) => {
      document.querySelector('#ngm-help-btn').href =
        lang === 'de' ? './manuals/manual_de.html' : './manuals/manual_en.html';
    });

    function showSlowLoadingWindow() {
      const timeout = 10000;
      if (loadingMask.active && performance.now() > timeout) {
        document.querySelector('ngm-slow-loading').style.display = 'block';
      } else {
        setTimeout(() => {
          if (loadingMask.active) {
            document.querySelector('ngm-slow-loading').style.display = 'block';
          }
        }, timeout - performance.now());
      }
    }

    i18next.on('initialized', () => {
      showSlowLoadingWindow();
    });

    const origin = window.location.origin;
    const pathname = window.location.pathname;
    document.querySelector('#ngm-home-link').href = `${origin}${pathname}`;

  }

  render() {
    return html`
    <ngm-loading-mask></ngm-loading-mask>
    <ngm-left-side-bar
      @welcome_panel_changed=${localStorageController.updateWelcomePanelState}
      .hideWelcome=${localStorageController.hideWelcomeValue}
      .hideCatalog=${localStorageController.hideCatalogValue}
       @catalog_panel_changed=${localStorageController.toggleCatalogState}
      .zoomTo=${zoomTo}
      @layeradded=${this.onLayerAdded}
      .viewer=${this.viewer}
      .mapChooser=${this.mapChooser}
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
        <ngm-review-window data-fs='no'></ngm-review-window>
        <ngm-object-position-popup></ngm-object-position-popup>
      </div>
      <div class='footer'>
        <div class='ui horizontal link list'>
          <ngm-feature-height class='item'></ngm-feature-height>
        </div>
        <div style='flex: auto;'></div>
        <div class='ui horizontal link list'>
          <a class='item' target='_blank' href='https://www.geologieportal.ch'>www.geologieportal.ch</a>
          <a class='item' target='_blank' data-i18n='[href]disclaimer_href;disclaimer_text'></a>
        </div>
      </div>
    </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-main', NgmMain);
