// @ts-check
import {initSentry} from './sentry.js';
import {setupI18n} from './i18n.js';
import {DEFAULT_VIEW, DRILL_PICK_LIMIT, SWITZERLAND_RECTANGLE} from './constants.js';

import './style/index.css';
import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid} from './viewer.js';

import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import {extractPrimitiveAttributes, extractEntitiesAttributes, isPickable} from './objectInformation.js';

import {getCameraView, syncCamera} from './permalink.js';
import Color from 'cesium/Core/Color.js';
import PostProcessStageLibrary from 'cesium/Scene/PostProcessStageLibrary.js';
import HeadingPitchRange from 'cesium/Core/HeadingPitchRange.js';
import {showMessage} from './message.js';
import i18next from 'i18next';
import BoundingSphere from 'cesium/Core/BoundingSphere.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';

import './elements/ngm-object-information.js';
import './elements/ngm-navigation-widgets.js';
import './elements/ngm-camera-information.js';
import './elements/ngm-feature-height.js';
import './elements/ngm-left-side-bar.js';
import './elements/map-chooser/ngm-map-chooser.js';

initSentry();
setupI18n();

const viewer = setupViewer(document.querySelector('#cesium'));

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
viewer.scene.globe.maximumScreenSpaceError = 10000;

// setup web components
const sideBar = document.querySelector('ngm-left-side-bar');
sideBar.viewer = viewer;
sideBar.zoomTo = zoomTo;


const unlisten = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) {
    unlisten();
    let sse = 2;
    const searchParams = new URLSearchParams(document.location.search);
    if (document.location.hostname === 'localhost') {
      sse = 100;
    }
    if (searchParams.has('maximumScreenSpaceError')) {
      sse = parseFloat(searchParams.get('maximumScreenSpaceError'));
    }
    viewer.scene.globe.maximumScreenSpaceError = sse;
    window.requestAnimationFrame(() => {
      addMantelEllipsoid(viewer);
      setupSearch(viewer, document.querySelector('ga-search'), sideBar);
      document.getElementById('loader').style.display = 'none';
      console.log(`loading mask displayed ${(performance.now() / 1000).toFixed(3)}s`);

      const sentryConfirmed = localStorage.getItem('sentryConfirmed') === 'true';
      if (!sentryConfirmed) {
        const options = {
          displayTime: 0,
          position: 'bottom right',
          classActions: 'basic left',
          actions: [{
            text: i18next.t('ok_btn_label'),
            click: () => {
              localStorage.setItem('sentryConfirmed', 'true');
            }
          }]
        };
        showMessage(i18next.t('sentry_message'), options);
      }
    });
  }
});


const silhouette = PostProcessStageLibrary.createEdgeDetectionStage();
silhouette.uniforms.color = Color.LIME;
silhouette.uniforms.length = 0.01;
silhouette.selected = [];
viewer.scene.postProcessStages.add(PostProcessStageLibrary.createSilhouetteStage([silhouette]));

const objectInfo = document.querySelector('ngm-object-information');
objectInfo.addEventListener('closed', () => {
  silhouette.selected = [];
  viewer.scene.requestRender();
});


viewer.screenSpaceEventHandler.setInputAction(click => {
  silhouette.selected = [];

  const objects = viewer.scene.drillPick(click.position, DRILL_PICK_LIMIT);
  let attributes = null;

  if (objects.length > 0) {
    const object = objects[0];
    if (!isPickable(object)) {
      return;
    }
    if (object.getPropertyNames) {
      attributes = extractPrimitiveAttributes(object);
      // attributes.zoom = () => console.log('should zoom to', objects[0]);
      silhouette.selected = [object];
    } else if (object.id && object.id.properties) {
      const props = extractEntitiesAttributes(object.id);
      attributes = {...props};
      attributes.zoom = () => viewer.zoomTo(object.id, props.zoomHeadingPitchRange);
      if (attributes.zoomHeadingPitchRange) {
        // Don't show the value in the object info window
        delete attributes.zoomHeadingPitchRange;
      }
      silhouette.selected = [object];
    }
  }

  objectInfo.info = attributes;
  objectInfo.opened = !!attributes;

  viewer.scene.requestRender();

}, ScreenSpaceEventType.LEFT_CLICK);

const {destination, orientation} = getCameraView();
viewer.camera.flyTo({
  destination: destination || DEFAULT_VIEW.destination,
  orientation: orientation || DEFAULT_VIEW.orientation,
  duration: 0
});

viewer.camera.moveEnd.addEventListener(() => syncCamera(viewer.camera));

const widgets = document.querySelector('ngm-navigation-widgets');
widgets.viewer = viewer;

document.querySelector('ngm-camera-information').scene = viewer.scene;
document.querySelector('ngm-feature-height').viewer = viewer;
