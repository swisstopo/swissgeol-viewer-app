import {initSentry} from './sentry.js';
import {setupI18n} from './i18n.js';
import {
  DEFAULT_VIEW,
  SWITZERLAND_RECTANGLE,
} from './constants.js';

import './style/index.css';
import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid, setupBaseLayers} from './viewer.js';

import {getCameraView, syncCamera} from './permalink.js';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import {showMessage} from './message.js';
import i18next from 'i18next';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid';

import Auth from './auth.js';

import './elements/ngm-auth.js';
import './elements/ngm-object-information.js';
import './elements/ngm-navigation-widgets.js';
import './elements/ngm-feature-height.js';
import './elements/ngm-left-side-bar.js';
import './elements/ngm-review-window.js';
import './elements/ngm-position-edit.js';
import './elements/ngm-slow-loading.js';
import './elements/ngm-full-screen-view.js';
import './elements/ngm-loading-mask.js';
import {LocalStorageController} from './LocalStorageController.js';
import {getZoomToPosition} from './permalink';
import Slicer from './Slicer.js';

const SKIP_STEP2_TIMEOUT = 5000;

Auth.initialize();

initSentry();
setupI18n();

const viewer = setupViewer(document.querySelector('#cesium'));

const loadingMask = document.querySelector('ngm-loading-mask');

async function zoomTo(config) {
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

/**
 * @type {import('cesium/Source/Scene/Scene.js').default}
 */
const scene = viewer.scene;

/**
 * @type {import('cesium/Source/Scene/Globe.js').default}
 */
const globe = scene.globe;

// Temporarily increasing the maximum screen space error to load low LOD tiles.
const searchParams = new URLSearchParams(document.location.search);
globe.maximumScreenSpaceError = parseFloat(searchParams.get('initialScreenSpaceError') || '2000');

// setup auth component
const auth = document.querySelector('ngm-auth');
auth.endpoint = 'https://mylogin.auth.eu-central-1.amazoncognito.com/oauth2/authorize';
auth.clientId = '5k1mgef7ggiremt415eecn95ki';

const onStep1Finished = () => {
  let sse = 2;
  if (document.location.hostname === 'localhost') {
    sse = 20;
  }
  if (searchParams.has('maximumScreenSpaceError')) {
    sse = parseFloat(searchParams.get('maximumScreenSpaceError'));
  }
  globe.maximumScreenSpaceError = sse;
};

const onStep2Finished = () => {
  loadingMask.active = false;
  const loadingTime = performance.now() / 1000;
  console.log(`loading mask displayed ${(loadingTime).toFixed(3)}s`);
  document.querySelector('ngm-slow-loading').style.display = 'none';

  const slicer = new Slicer(viewer);

  // setup web components
  const sideBar = document.querySelector('ngm-left-side-bar');
  sideBar.zoomTo = zoomTo;

  const mapChooser = setupBaseLayers(viewer);

  sideBar.viewer = viewer;
  sideBar.mapChooser = mapChooser;
  sideBar.addEventListener('layeradded', (evt) => {
    if (slicer && slicer.active) {
      const layer = evt.detail.layer;
      if (layer && layer.promise) {
        slicer.applyClippingPlanesToTileset(layer.promise);
      }
    }
  });

  const widgets = document.querySelector('ngm-navigation-widgets');
  widgets.viewer = viewer;
  widgets.slicer = slicer;

  sideBar.authenticated = !!auth.user;
  auth.addEventListener('refresh', (evt) => sideBar.authenticated = evt.detail.authenticated);

  addMantelEllipsoid(viewer);
  setupSearch(viewer, document.querySelector('ga-search'), sideBar);

  const localStorageController = new LocalStorageController();

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
    const aoiElement = document.querySelector('ngm-aoi-drawer');
    aoiElement.slicer = slicer;
    aoiElement.addStoredAreas(localStorageController.getStoredAoi());
    aoiElement.addEventListener('aoi_list_changed', evt =>
      localStorageController.setAoiInStorage(evt.detail.entities));
  });

  sideBar.hideWelcome = localStorageController.hideWelcomeValue;
  sideBar.addEventListener('welcome_panel_changed', localStorageController.updateWelcomePanelState);

  sideBar.hideCatalog = localStorageController.hideCatalogValue;
  sideBar.addEventListener('catalog_panel_changed', localStorageController.toggleCatalogState);

  const reviewWindowElement = document.querySelector('ngm-review-window');
  reviewWindowElement.hideReviewWindow = localStorageController.hideReviewWindowValue;
  reviewWindowElement.addEventListener('review_window_changed', localStorageController.updateReviewWindowState);

  sideBar.zoomToPermalinkObject();
};

let currentStep = 1;
const unlisten = globe.tileLoadProgressEvent.addEventListener(queueLength => {
  loadingMask.message = queueLength;
  if (currentStep === 1 && globe.tilesLoaded) {
    currentStep = 2;
    loadingMask.step = currentStep;
    console.log('Step 1 finished');
    onStep1Finished();
    setTimeout(() => {
      if (currentStep === 2) {
        console.log('Too long: going straight to step 3');
        currentStep = 3;
        onStep2Finished();
        unlisten();
      }
    }, SKIP_STEP2_TIMEOUT);
  } else if (currentStep === 2 && globe.tilesLoaded) {
    currentStep = 3;
    console.log('Step 2 finished');
    onStep2Finished();
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

