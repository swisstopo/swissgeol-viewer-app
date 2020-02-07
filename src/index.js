// @ts-check
import {setupI18n} from './i18n.js';
import {SWITZERLAND_RECTANGLE} from './constants.js';

import './style/index.css';
import {setupLayers} from './layers.js';
import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid} from './viewer.js';
import FirstPersonCameraMode from './FirstPersonCameraMode.js';

import './elements/ngm-object-information.js';

import {getCameraView, syncCamera} from './permalink.js';

setupI18n();

const viewer = setupViewer(document.querySelector('#cesium'));

const unlisten = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) {
    unlisten();
    addMantelEllipsoid(viewer);
    setupLayers(viewer, document.getElementById('layers'));
  }
});

const {destination, orientation} = getCameraView();

viewer.camera.flyTo({
  destination: destination || SWITZERLAND_RECTANGLE,
  orientation: orientation,
  duration: 0
});

viewer.camera.moveEnd.addEventListener(() => syncCamera(viewer.camera));

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


const objectInfo = document.querySelector('ngm-object-information');

objectInfo.info = {
  id: 3554,
  name: 'Le Foulet',
  domain: 'Bereich A (dient der Fortpflanzung der Amphibien – alle Gewässer welche sicher oder potentiell der Fortpflanzung dienen)',
  area: 12.3,
  zoom: () => {
    alert('zoom zoom');
  }
};
