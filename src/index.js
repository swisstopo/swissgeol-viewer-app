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

Auth.initialize();

import './elements/ngm-auth.js';
import './elements/ngm-object-information.js';
import './elements/ngm-navigation-widgets.js';
import './elements/ngm-feature-height.js';
import './elements/ngm-left-side-bar.js';
import './elements/ngm-review-window.js';
import './elements/ngm-position-edit.js';
import './elements/ngm-slow-loading.js';
import './elements/ngm-full-screen-view.js';
import {LocalStorageController} from './LocalStorageController.js';
import {getZoomToPosition} from './permalink';


initSentry();
setupI18n();

const viewer = setupViewer(document.querySelector('#cesium'));
const mapChooser = setupBaseLayers(viewer);

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

// Temporarily increasing the maximum screen space error to load low LOD tiles.
/**
 * @type {import('cesium/Source/Scene/Scene.js').default}
 */
const scene = viewer.scene;
/**
 * @type {import('cesium/Source/Scene/Globe.js').default}
 */
const globe = scene.globe;
globe.maximumScreenSpaceError = 10000;

// setup auth component
const auth = document.querySelector('ngm-auth');
auth.endpoint = 'https://mylogin.auth.eu-central-1.amazoncognito.com/oauth2/authorize';
auth.clientId = '5k1mgef7ggiremt415eecn95ki';

// setup web components
const sideBar = document.querySelector('ngm-left-side-bar');
sideBar.viewer = viewer;
sideBar.zoomTo = zoomTo;

const unlisten = globe.tileLoadProgressEvent.addEventListener(() => {
  if (globe.tilesLoaded) {
    unlisten();
    let sse = 2;
    const searchParams = new URLSearchParams(document.location.search);
    if (document.location.hostname === 'localhost') {
      sse = 20;
    }
    if (searchParams.has('maximumScreenSpaceError')) {
      sse = parseFloat(searchParams.get('maximumScreenSpaceError'));
    }
    globe.maximumScreenSpaceError = sse;
    window.requestAnimationFrame(() => {
      addMantelEllipsoid(viewer);
      setupSearch(viewer, document.querySelector('ga-search'), sideBar);
      document.getElementById('loader').style.display = 'none';
      const loadingTime = performance.now() / 1000;
      console.log(`loading mask displayed ${(loadingTime).toFixed(3)}s`);
      document.querySelector('ngm-slow-loading').style.display = 'none';

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

      const aoiElement = document.querySelector('ngm-aoi-drawer');
      aoiElement.addStoredAreas(localStorageController.getStoredAoi());
      aoiElement.addEventListener('aoi_list_changed', evt =>
        localStorageController.setAoiInStorage(evt.detail.entities));

      const sideBarElement = document.querySelector('ngm-left-side-bar');
      sideBarElement.hideWelcome = localStorageController.hideWelcomeValue;
      sideBarElement.addEventListener('welcome_panel_changed', localStorageController.updateWelcomePanelState);

      const reviewWindowElement = document.querySelector('ngm-review-window');
      reviewWindowElement.hideReviewWindow = localStorageController.hideReviewWindowValue;
      reviewWindowElement.addEventListener('review_window_changed', localStorageController.updateReviewWindowState);

      sideBar.zoomToPermalinkObject();
    });
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

const widgets = document.querySelector('ngm-navigation-widgets');
widgets.viewer = viewer;

document.querySelector('ngm-feature-height').viewer = viewer;
document.querySelector('ngm-left-side-bar').mapChooser = mapChooser;

i18next.on('languageChanged', (lang) => {
  document.querySelector('#ngm-help-btn').href =
    lang === 'de' ? './manuals/manual_de.html' : './manuals/manual_en.html';
});

function showSlowLoadingWindow() {
  const timeout = 10000;
  const loaderDisplayed = () => document.querySelector('#loader').style.display !== 'none';
  if (loaderDisplayed() && performance.now() > timeout) {
    document.querySelector('ngm-slow-loading').style.display = 'block';
  } else {
    setTimeout(() => {
      if (loaderDisplayed()) {
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

