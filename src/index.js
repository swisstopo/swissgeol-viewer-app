// @ts-check
import {setupI18n} from './i18n.js';
import {SWITZERLAND_RECTANGLE, DRILL_PICK_LIMIT} from './constants.js';

import './style/index.css';
import {setupLayers} from './layers.js';
import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid} from './viewer.js';
import FirstPersonCameraMode from './FirstPersonCameraMode.js';

import './elements/ngm-object-information.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import {extractPrimitiveAttributes} from './objectInformation.js';

import {getCameraView, syncCamera} from './permalink.js';

setupI18n();

const viewer = setupViewer(document.querySelector('#cesium'));

const unlisten = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) {
    unlisten();
    window.requestAnimationFrame(() => {
      addMantelEllipsoid(viewer);
      setupLayers(viewer, document.getElementById('layers'));
      document.getElementById('loader').style.display = 'none';
    });
  }
});

const objectInfo = document.querySelector('ngm-object-information');

viewer.screenSpaceEventHandler.setInputAction(click => {
  const objects = viewer.scene.drillPick(click.position, DRILL_PICK_LIMIT);
  let attributes = null;

  if (objects.length > 0) {
    let object = objects[0];
    if (!object.getProperty) {
      object = object.primitive;
    }
    if (object.getPropertyNames) {
      attributes = extractPrimitiveAttributes(object);
     // attributes.zoom = () => console.log('should zoom to', objects[0]);
    }
  }

  objectInfo.info = attributes;
  objectInfo.opened = !!attributes;

}, ScreenSpaceEventType.LEFT_CLICK);


viewer.screenSpaceEventHandler.setInputAction(movement => {
  viewer.scene.canvas.style.cursor = viewer.scene.pick(movement.endPosition) ? 'pointer' : 'default';
}, ScreenSpaceEventType.MOUSE_MOVE);


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
