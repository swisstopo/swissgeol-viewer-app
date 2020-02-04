// @ts-check
import {init as i18nInit} from './i18n.js';
import {SWITZERLAND_RECTANGLE} from './constants.js';

import './index.css';
import {setupLayers} from './layers.js';
import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid} from './viewer.js';
import FirstPersonCameraMode from './FirstPersonCameraMode.js';

i18nInit();

const viewer = setupViewer(document.querySelector('#cesium'));

const unlisten = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) {
    unlisten();
    addMantelEllipsoid(viewer);
    setupLayers(viewer, document.getElementById('layers'));
  }
});

viewer.camera.flyTo({
  destination: SWITZERLAND_RECTANGLE,
  duration: 0
});

document.querySelector('#zoomToHome').addEventListener('click', event => {
  viewer.scene.camera.flyTo({
    destination: SWITZERLAND_RECTANGLE
  });
});

const firstPersonCameraMode = new FirstPersonCameraMode(viewer.scene);

document.querySelector('#fpsMode').addEventListener('click', event => {
  firstPersonCameraMode.active = true;
});

setupSearch(viewer, document.querySelector('ga-search'));
