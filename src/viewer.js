// @ts-check
import {SWITZERLAND_RECTANGLE} from './constants.js';

import Viewer from 'cesium/Widgets/Viewer/Viewer.js';
import RequestScheduler from 'cesium/Core/RequestScheduler.js';
import CesiumTerrainProvider from 'cesium/Core/CesiumTerrainProvider.js';
import IonResource from 'cesium/Core/IonResource.js';
import JulianDate from 'cesium/Core/JulianDate.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Color from 'cesium/Core/Color.js';
import Ion from 'cesium/Core/Ion.js';
import Cartesian2 from 'cesium/Core/Cartesian2.js';
import NearFarScalar from 'cesium/Core/NearFarScalar.js';
import NavigableVolumeLimiter from './NavigableVolumeLimiter.js';
import LimitCameraHeightToDepth from './LimitCameraHeightToDepth.js';
import KeyboardNavigation from './KeyboardNavigation.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import SingleTileImageryProvider from 'cesium/Scene/SingleTileImageryProvider.js';
import MapChooser from './MapChooser';
import {addSwisstopoLayer} from './swisstopoImagery.js';
import ScreenSpaceEventType from 'cesium/Core/ScreenSpaceEventType.js';
import PostProcessStage from 'cesium/Scene/PostProcessStage.js';
import Cartesian4 from 'cesium/Core/Cartesian4.js';
import CesiumInspector from 'cesium/Widgets/CesiumInspector/CesiumInspector.js';
import {getMapTransparencyParam} from './permalink.js';


window['CESIUM_BASE_URL'] = '.';

Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(RequestScheduler.requestsByServer, {
  'wmts.geo.admin.ch:443': 18,
  'vectortiles0.geo.admin.ch:443': 18
});

let noLimit;

const FOG_FRAGMENT_SHADER_SOURCE =
  'float getDistance(sampler2D depthTexture, vec2 texCoords) \n' +
  '{ \n' +
  '    float depth = czm_unpackDepth(texture2D(depthTexture, texCoords)); \n' +
  '    if (depth == 0.0) { \n' +
  '        return czm_infinity; \n' +
  '    } \n' +
  '    vec4 eyeCoordinate = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth); \n' +
  '    return -eyeCoordinate.z / eyeCoordinate.w; \n' +
  '} \n' +
  'float interpolateByDistance(vec4 nearFarScalar, float distance) \n' +
  '{ \n' +
  '    float startDistance = nearFarScalar.x; \n' +
  '    float startValue = nearFarScalar.y; \n' +
  '    float endDistance = nearFarScalar.z; \n' +
  '    float endValue = nearFarScalar.w; \n' +
  '    float t = clamp((distance - startDistance) / (endDistance - startDistance), 0.0, 1.0); \n' +
  '    return mix(startValue, endValue, t); \n' +
  '} \n' +
  'vec4 alphaBlend(vec4 sourceColor, vec4 destinationColor) \n' +
  '{ \n' +
  '    return sourceColor * vec4(sourceColor.aaa, 1.0) + destinationColor * (1.0 - sourceColor.a); \n' +
  '} \n' +
  'uniform sampler2D colorTexture; \n' +
  'uniform sampler2D depthTexture; \n' +
  'uniform vec4 fogByDistance; \n' +
  'uniform vec4 fogColor; \n' +
  'varying vec2 v_textureCoordinates; \n' +
  'void main(void) \n' +
  '{ \n' +
  '    float distance = getDistance(depthTexture, v_textureCoordinates); \n' +
  '    vec4 sceneColor = texture2D(colorTexture, v_textureCoordinates); \n' +
  '    float blendAmount = interpolateByDistance(fogByDistance, distance); \n' +
  '    vec4 undergroundColor = vec4(fogColor.rgb, fogColor.a * blendAmount); \n' +
  '    gl_FragColor = alphaBlend(undergroundColor, sceneColor); \n' +
  '} \n';

/**
 * @param {HTMLElement} container
 */
export function setupViewer(container) {

  // The first layer of Cesium is special; using a 1x1 white image to workaround it.
  // See https://github.com/AnalyticalGraphicsInc/cesium/issues/1323 for details.
  const firstImageryProvider = new SingleTileImageryProvider({
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    rectangle: Rectangle.fromDegrees(0, 0, 1, 1) // the Rectangle dimensions are arbitrary
  });

  const searchParams = new URLSearchParams(location.search);

  const terrainExaggeration = parseFloat(searchParams.get('terrainExaggeration') || '1');
  noLimit = document.location.hostname === 'localhost' || searchParams.has('noLimit');
  if (searchParams.get('noLimit') === 'false') {
    noLimit = false;
  }

  let terrainUrl;
  const ownTerrain = searchParams.has('ownterrain');
  if (ownTerrain) {
    terrainUrl = 'https://terrain.dev.bgdi.ch/1.0.0/ch.swisstopo.terrain.3d/default/0.14/4326/';
  } else {
    terrainUrl = IonResource.fromAssetId(1);
  }

  const viewer = new Viewer(container, {
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
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
    skyBox: false,
    imageryProvider: firstImageryProvider,
    showRenderLoopErrors: false,
    useBrowserRecommendedResolution: true,
    terrainProvider: new CesiumTerrainProvider({
      url: terrainUrl
    }),
    terrainExaggeration: terrainExaggeration,
    requestRenderMode: true,
    // maximumRenderTimeChange: 10,
  });

  // remove the default behaviour of calling 'zoomTo' on the double clicked entity
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const scene = viewer.scene;
  const globe = scene.globe;

  if (searchParams.has('swissrectangle')) {
    const rectangle = Rectangle.fromDegrees(
      5.86725126512748,
      45.8026860136571,
      10.9209100671547,
      47.8661652478939
    );
    globe.cartographicLimitRectangle = rectangle;
  }

  // Position the sun the that shadows look nice
  viewer.clock.currentTime = JulianDate.fromDate(new Date('June 21, 2018 12:00:00 GMT+0200'));


  // Limit the volume inside which the user can navigate
  if (!noLimit) {
    new NavigableVolumeLimiter(scene, SWITZERLAND_RECTANGLE, 193, height => (height > 3000 ? 9 : 3));
  }

  new KeyboardNavigation(viewer.scene);

  scene.screenSpaceCameraController.enableCollisionDetection = false;
  scene.useDepthPicking = true;
  scene.pickTranslucentDepth = true;

  globe.baseColor = Color.WHITE;
  globe.depthTestAgainstTerrain = true;
  globe.showGroundAtmosphere = false;
  globe.showWaterEffect = false;
  globe.backFaceCulling = false;

  // Set the globe translucency to 0.6 when the
  // camera is 10000 meters from the surface and 1.0
  // as the camera distance approaches 50000 meters.
  const transparencyParam = getMapTransparencyParam();
  const transparency = transparencyParam ? 1 - transparencyParam : 0.6;
  globe.translucencyEnabled = transparency !== 1;
  globe.frontFaceAlphaByDistance = new NearFarScalar(10000, transparency, 50000, 1.0);
  // globe.undergroundColorByDistance = new NearFarScalar(6000, 0.1, 500000, 1.0);
  globe.backFaceAlpha = transparency === 1 ? 1 : 0;

  const fog = new PostProcessStage({
    fragmentShader: FOG_FRAGMENT_SHADER_SOURCE,
    uniforms: {
      fogByDistance: new Cartesian4(10, 0.0, 250000, 1.0),
      fogColor: Color.BLACK,
    },
  });

  viewer.scene.postProcessStages.add(fog);

  scene.postRender.addEventListener((scene) => {
    fog.enabled = scene.cameraUnderground;
  });

  setupBaseLayers(viewer);

  if (searchParams.has('inspector')) {
    const div = document.createElement('div');
    div.id = 'divinspector';
    document.body.appendChild(div);
    new CesiumInspector('divinspector', scene);
  }
  return viewer;
}

/**
 * @param {import('cesium/Widgets/Viewer/Viewer').default} viewer
 */
export function addMantelEllipsoid(viewer) {
  if (noLimit) {
    return;
  }
  // Add Mantel ellipsoid
  const radii = Ellipsoid.WGS84.radii.clone();
  const mantelDepth = 30000; // See https://jira.camptocamp.com/browse/GSNGM-34
  radii.x -= mantelDepth;
  radii.y -= mantelDepth;
  radii.z -= mantelDepth;
  const entity = viewer.entities.add({
    position: new Cartesian3(1, 1, 1), // small shift to avoid invertable error
    ellipsoid: {
      radii: radii,
      material: 'images/temp_lava.jpg',
    }
  });
  entity.ellipsoid.material.repeat = new Cartesian2(40, 40);

  new LimitCameraHeightToDepth(viewer.scene, mantelDepth);
}

function setupBaseLayers(viewer) {
  const arealLayer = 'ch.swisstopo.swissimage';
  const greyLayer = 'ch.swisstopo.pixelkarte-grau';
  const detailedLayer = 'ch.swisstopo.landeskarte-grau-10';

  const t = a => a;
  const mapsConfig = [
    {
      id: arealLayer,
      labelKey: t('areal_map_label'),
      backgroundImgSrc: '../images/arealimage.png', //relative to ngm-map-chooser
      layer: addSwisstopoLayer(viewer, arealLayer, 'jpeg', false)
    },
    {
      id: greyLayer,
      labelKey: t('grey_map_label'),
      backgroundImgSrc: '../images/grey.png',
      layer: addSwisstopoLayer(viewer, greyLayer, 'jpeg')
    },
    {
      id: detailedLayer,
      labelKey: t('detailed_map_label'),
      backgroundImgSrc: '../images/detailed.png',
      layer: addSwisstopoLayer(viewer, detailedLayer, 'png', false)
    }];

  new MapChooser(viewer, mapsConfig);
}
