import {SWITZERLAND_RECTANGLE} from './constants.js';

import Viewer from 'cesium/Source/Widgets/Viewer/Viewer';
import RequestScheduler from 'cesium/Source/Core/RequestScheduler';
import CesiumTerrainProvider from 'cesium/Source/Core/CesiumTerrainProvider';
import IonResource from 'cesium/Source/Core/IonResource';
import JulianDate from 'cesium/Source/Core/JulianDate';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Color from 'cesium/Source/Core/Color';
import Ion from 'cesium/Source/Core/Ion';
import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import NavigableVolumeLimiter from './NavigableVolumeLimiter.js';
import LimitCameraHeightToDepth from './LimitCameraHeightToDepth.js';
import KeyboardNavigation from './KeyboardNavigation.js';
import Rectangle from 'cesium/Source/Core/Rectangle';
import SingleTileImageryProvider from 'cesium/Source/Scene/SingleTileImageryProvider';
import MapChooser from './MapChooser';
import {addSwisstopoLayer} from './swisstopoImagery.js';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import PostProcessStage from 'cesium/Source/Scene/PostProcessStage';
import Cartesian4 from 'cesium/Source/Core/Cartesian4';
import CesiumInspector from 'cesium/Source/Widgets/CesiumInspector/CesiumInspector';
import {getMapTransparencyParam} from './permalink.js';
import Entity from 'cesium/Source/DataSources/Entity';
import HeightReference from 'cesium/Source/Scene/HeightReference';


window['CESIUM_BASE_URL'] = '.';

Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(RequestScheduler.requestsByServer, {
  'wmts.geo.admin.ch:443': 18,
  'vectortiles0.geo.admin.ch:443': 18
});

let noLimit;

const FOG_FRAGMENT_SHADER_SOURCE = `
  float getDistance(sampler2D depthTexture, vec2 texCoords) {
      float depth = czm_unpackDepth(texture2D(depthTexture, texCoords));
      if (depth == 0.0) {
          return czm_infinity;
      }
      vec4 eyeCoordinate = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
      return -eyeCoordinate.z / eyeCoordinate.w;
  }
  float interpolateByDistance(vec4 nearFarScalar, float distance) {
      float startDistance = nearFarScalar.x;
      float startValue = nearFarScalar.y;
      float endDistance = nearFarScalar.z;
      float endValue = nearFarScalar.w;
      float t = clamp((distance - startDistance) / (endDistance - startDistance), 0.0, 1.0);
      return mix(startValue, endValue, t);
  }
  vec4 alphaBlend(vec4 sourceColor, vec4 destinationColor) {
      return sourceColor * vec4(sourceColor.aaa, 1.0) + destinationColor * (1.0 - sourceColor.a);
  }
  uniform sampler2D colorTexture;
  uniform sampler2D depthTexture;
  uniform vec4 fogByDistance;
  uniform vec4 fogColor;
  varying vec2 v_textureCoordinates;
  void main(void) {
      float distance = getDistance(depthTexture, v_textureCoordinates);
      vec4 sceneColor = texture2D(colorTexture, v_textureCoordinates);
      float blendAmount = interpolateByDistance(fogByDistance, distance);
      vec4 undergroundColor = vec4(fogColor.rgb, fogColor.a * blendAmount);
      gl_FragColor = alphaBlend(undergroundColor, sceneColor);
  }`;

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
  const ownTerrain = searchParams.get('ownterrain') !== 'false';
  if (ownTerrain) {
    terrainUrl = 'https://3d.geo.admin.ch/1.0.0/ch.swisstopo.terrain.3d/default/20200520/4326/';
  } else {
    terrainUrl = IonResource.fromAssetId(1);
  }

  const requestRenderMode = !searchParams.has('norequestrendermode');

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
    requestRenderMode: requestRenderMode,
    // maximumRenderTimeChange: 10,
  });

  // remove the default behaviour of calling 'zoomTo' on the double clicked entity
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const scene = viewer.scene;
  const globe = scene.globe;

  if (searchParams.get('swissrectangle') !== 'false') {
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

  const transparencyParam = getMapTransparencyParam();
  const transparency = !isNaN(transparencyParam) ? 1 - transparencyParam : 0.6;
  globe.translucency.enabled = transparency !== 1;
  globe.translucency.frontFaceAlpha = transparency;
  globe.translucency.backFaceAlpha = transparency === 1 ? 1 : 0;
  const fog = new PostProcessStage({
    fragmentShader: FOG_FRAGMENT_SHADER_SOURCE,
    uniforms: {
      fogByDistance: new Cartesian4(10000, 0.0, 150000, 0.3),
      fogColor: Color.BLACK
    },
    name: 'fog'
  });
  const fogShield = new Entity({
    rectangle: {
      material: Color.WHITE,
      coordinates: scene.globe.cartographicLimitRectangle,
      heightReference: HeightReference.RELATIVE_TO_GROUND,
      height: 5000
    },
    name: 'fogShield'
  });
  viewer.entities.add(fogShield); // hack to avoid black terrain/tilesets when transparency applied

  viewer.scene.postProcessStages.add(fog);
  scene.postRender.addEventListener((scene) => {
    fog.enabled = scene.cameraUnderground;
    fogShield.show = scene.cameraUnderground;
  });

  if (searchParams.has('inspector')) {
    const div = document.createElement('div');
    div.id = 'divinspector';
    document.body.appendChild(div);
    new CesiumInspector('divinspector', scene);
  }
  return viewer;
}

/**
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
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

/**
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 */
export function setupBaseLayers(viewer) {
  const arealLayer = 'ch.swisstopo.swissimage';
  const greyLayer = 'ch.swisstopo.pixelkarte-grau';

  const emptyLayer = {
    layer: {
      show: false
    }
  };
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
      id: 'empty_map',
      labelKey: t('empty_map_label'),
      backgroundImgSrc: '../images/empty.png',
      layer: emptyLayer
    }];

  return new MapChooser(viewer, mapsConfig);
}
