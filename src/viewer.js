// @ts-check
import {SWITZERLAND_RECTANGLE} from './constants.js';

import Viewer from 'cesium/Widgets/Viewer/Viewer.js';
import RequestScheduler from 'cesium/Core/RequestScheduler.js';
import UrlTemplateImageryProvider from 'cesium/Scene/UrlTemplateImageryProvider.js';
import Credit from 'cesium/Core/Credit.js';
import CesiumTerrainProvider from 'cesium/Core/CesiumTerrainProvider.js';
import IonResource from 'cesium/Core/IonResource.js';
import JulianDate from 'cesium/Core/JulianDate.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Color from 'cesium/Core/Color.js';
import Ion from 'cesium/Core/Ion.js';
import Camera from 'cesium/Scene/Camera.js';
import Cartesian2 from 'cesium/Core/Cartesian2.js';
import NavigableVolumeLimiter from './NavigableVolumeLimiter.js';
import ImageryLayer from 'cesium/Scene/ImageryLayer.js';
import LimitCameraHeightToDepth from './LimitCameraHeightToDepth.js';
import KeyboardNavigation from './KeyboardNavigation.js';


window['CESIUM_BASE_URL'] = '.';

Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(RequestScheduler.requestsByServer, {
  'wmts.geo.admin.ch:443': 18,
  'vectortiles0.geo.admin.ch:443': 18
});


export function setupViewer(container) {

  const viewer = new Viewer(container, {
    scene3DOnly: true,
    useBrowserRecommendedResolution: true,
    contextOptions: {
      webgl: {
        powerPreference: 'high-performance'
      }
    },
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,

    // Avoid using 100% of the available rources all the time
    requestRenderMode: true,
    imageryProvider: false,
    terrainProvider: new CesiumTerrainProvider({
      url: IonResource.fromAssetId(1)
    })
  });

  const scene = viewer.scene;

  // Position the sun the that shadows look nice
  viewer.clock.currentTime = JulianDate.fromDate(new Date('June 21, 2018 12:00:00 GMT+0200'));

  // Set the fly home rectangle
  Camera.DEFAULT_VIEW_RECTANGLE = SWITZERLAND_RECTANGLE;


  // Limit the volume inside which the user can navigate
  new NavigableVolumeLimiter(scene, SWITZERLAND_RECTANGLE, 193, height => (height > 3000 ? 9 : 3));

  new KeyboardNavigation(viewer.scene);

  scene.screenSpaceCameraController.enableCollisionDetection = false;

  const globe = scene.globe;
  globe.baseColor = Color.WHITE;
  globe.depthTestAgainstTerrain = true;
  globe.showGroundAtmosphere = false;
  globe.showWaterEffect = false;
  globe.backFaceCulling = false;

  scene.imageryLayers.add(new ImageryLayer(
    new UrlTemplateImageryProvider({
      url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-karte-grau.3d/default/current/3857/{z}/{x}/{y}.jpeg',
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit('Swisstopo')
    }))
  );

  scene.imageryLayers.add(new ImageryLayer(
    new UrlTemplateImageryProvider({
      url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.geologie-geocover/default/current/3857/{z}/{x}/{y}.png',
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit('Swisstopo')
    }), {
    alpha: 0.3
    })
  );

  return viewer;
}

export function addMantelEllipsoid(viewer) {
  // Add Mantel ellipsoid
  const radii = Ellipsoid.WGS84.radii.clone();
  const mantelDepth = 30000; // See https://jira.camptocamp.com/browse/GSNGM-34
  radii.x -= mantelDepth;
  radii.y -= mantelDepth;
  radii.z -= mantelDepth;
  const entity = viewer.entities.add({
    position: new Cartesian3(1, 1, 1), // small shift to avoid invertable error
    ellipsoid: {
      radii,
      material: 'images/temp_lava.jpg',
    }
  });
  entity.ellipsoid.material.repeat = new Cartesian2(40, 40);

  new LimitCameraHeightToDepth(viewer.scene, mantelDepth);
}
