// @ts-check
import '@webcomponents/webcomponentsjs/webcomponents-loader.js';
import '@geoblocks/ga-search';

import {init as i18nInit} from './i18n.js';
import {getLayersConfig, containsSwisstopoImagery, getSwisstopoImagery} from './swisstopoImagery.js';
import LimitCameraHeightToDepth from './LimitCameraHeightToDepth.js';
import {SWITZERLAND_RECTANGLE} from './constants.js';

import Rectangle from 'cesium/Core/Rectangle.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import Math from 'cesium/Core/Math.js';

import './index.css';
import {setupLayers} from './layers.js';
import {setupViewer, addMantelEllipsoid} from './viewer.js';

i18nInit();

const viewer = setupViewer(document.querySelector('#cesium'));

const unlisten = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) {
    unlisten();
    addMantelEllipsoid(viewer);
    setupLayers(viewer, 'layers');
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

new LimitCameraHeightToDepth(viewer.scene, mantelDepth);

document.querySelector('#fpsMode').addEventListener('click', event => {
  firstPersonCameraMode.active = true;
});

const search = document.querySelector('ga-search');

// search filter configuration
getLayersConfig().then(layersConfig => {
  search.filterResults = result => {
    if (result.properties.origin === 'layer') {
      return layersConfig[result.properties.layer].type === 'wmts';
    } else {
      return true;
    }
  };
});

// location search result
search.addEventListener('submit', event => {
  const result = event.detail.result;
  const origin = result.properties.origin;
  const rectangle = Rectangle.fromDegrees(...result.bbox);
  if (origin === 'layer') {
    // add layer
    getSwisstopoImagery(result.properties.layer, rectangle).then(imageryLayer => {
      if (!containsSwisstopoImagery(viewer.scene.imageryLayers, imageryLayer)) {
        viewer.scene.imageryLayers.add(imageryLayer);
      }
    });
  } else {
    // recenter to location
    if (rectangle.width < Math.EPSILON3 || rectangle.height < Math.EPSILON3) {
      // rectangle is too small
      const center = Rectangle.center(rectangle);
      center.height = 5000;
      viewer.camera.flyTo({
        destination: Cartographic.toCartesian(center)
      });
    } else {
      // rectangle
      viewer.camera.flyTo({
        destination: rectangle
      });
    }
  }
  event.target.autocomplete.input.blur();
});
