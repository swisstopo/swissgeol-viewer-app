// @ts-check
import {setupI18n} from './i18n.js';
import {SWITZERLAND_RECTANGLE, DRILL_PICK_LIMIT} from './constants.js';

import './style/index.css';
import {setupLayers} from './layers.js';
import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid} from './viewer.js';
import FirstPersonCameraMode from './FirstPersonCameraMode.js';

import './elements/ngm-object-information.js';
import ScreenSpaceEventHandler from 'cesium/Core/ScreenSpaceEventHandler.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import {extractPrimitiveAttributes} from './objectInformation.js';

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

const objectInfo = document.querySelector('ngm-object-information');

const handler = new ScreenSpaceEventHandler();
handler.setInputAction(function(click) {
  const objects = viewer.scene.drillPick(click.position, DRILL_PICK_LIMIT);
  if (objects.length > 0) {
    let object = objects[0];
    if (!object.getProperty) {
      object = object.primitive;
    }
    const data = extractPrimitiveAttributes(object.getProperty ? object : null);
    objectInfo.info = data;
  }
}, ScreenSpaceEventType.LEFT_CLICK);


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
