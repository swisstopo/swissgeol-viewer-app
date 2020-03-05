// @ts-check
import {setupI18n} from './i18n.js';
import {SWITZERLAND_RECTANGLE, DRILL_PICK_LIMIT} from './constants.js';

import './style/index.css';
import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid} from './viewer.js';
import FirstPersonCameraMode from './FirstPersonCameraMode.js';

import './elements/ngm-object-information.js';
import './elements/ngm-gst-interaction.js';
import './elements/cesium-compass.js';
import './elements/ngm-zoom-buttons.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import {extractPrimitiveAttributes, extractEntitiesAttributes, isPickable} from './objectInformation.js';

import {getCameraView, syncCamera} from './permalink.js';
import AreaOfInterestDrawer from './areaOfInterest/AreaOfInterestDrawer.js';
import Color from 'cesium/Core/Color.js';
import PostProcessStageLibrary from 'cesium/Scene/PostProcessStageLibrary.js';
import {initInfoPopup} from './elements/keyboard-info-popup.js';
import LayerTree from './layers/layers.js';
import HeadingPitchRange from 'cesium/Core/HeadingPitchRange.js';

setupI18n();

const viewer = setupViewer(document.querySelector('#cesium'));


async function zoomTo(config) {
  const p = await config.promise;
  if (p.boundingSphere) {
    const zoomHeadingPitchRange = new HeadingPitchRange(0, Math.PI / 4, 3 * p.boundingSphere.radius);
    this.viewer.zoomTo(p, zoomHeadingPitchRange);
  } else {
    this.viewer.zoomTo(p);
  }
}

const unlisten = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) {
    unlisten();
    window.requestAnimationFrame(() => {
      addMantelEllipsoid(viewer);

      const layerTree = new LayerTree(viewer, document.getElementById('layers'), zoomTo);
      setupSearch(viewer, document.querySelector('ga-search'), layerTree);
      document.getElementById('loader').style.display = 'none';
    });
  }
});

const objectInfo = document.querySelector('ngm-object-information');

const silhouette = PostProcessStageLibrary.createEdgeDetectionStage();
silhouette.uniforms.color = Color.LIME;
silhouette.uniforms.length = 0.01;
silhouette.selected = [];

objectInfo.addEventListener('closed', () => {
  silhouette.selected = [];
  viewer.scene.requestRender();
});

viewer.scene.postProcessStages.add(PostProcessStageLibrary.createSilhouetteStage([silhouette]));

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

new AreaOfInterestDrawer(viewer);

initInfoPopup();

const gstInteraction = document.querySelector('ngm-gst-interaction');
gstInteraction.viewer = viewer;


const compass = document.querySelector('cesium-compass');
compass.scene = viewer.scene;
compass.clock = viewer.clock;

const zoomButtons = document.querySelector('ngm-zoom-buttons');
zoomButtons.scene = viewer.scene;
