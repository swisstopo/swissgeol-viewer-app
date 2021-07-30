import {SWITZERLAND_RECTANGLE, MANTEL_COLOR} from './constants.js';

import Viewer from 'cesium/Source/Widgets/Viewer/Viewer';
import RequestScheduler from 'cesium/Source/Core/RequestScheduler';
import CesiumTerrainProvider from 'cesium/Source/Core/CesiumTerrainProvider';
import IonResource from 'cesium/Source/Core/IonResource';
import JulianDate from 'cesium/Source/Core/JulianDate';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Color from 'cesium/Source/Core/Color';
import Ion from 'cesium/Source/Core/Ion';
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
import CameraEventType from 'cesium/Source/Scene/CameraEventType';
import KeyboardEventModifier from 'cesium/Source/Core/KeyboardEventModifier';
import Transforms from 'cesium/Source/Core/Transforms';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';


window['CESIUM_BASE_URL'] = '.';

Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(RequestScheduler.requestsByServer, {
  'wmts.geo.admin.ch:443': 18,
  'vectortiles0.geo.admin.ch:443': 18
});

let noLimit = true;

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
 * @param {Element} container
 */
export function setupViewer(container, rethrowRenderErrors) {

  // The first layer of Cesium is special; using a 1x1 transparent image to workaround it.
  // See https://github.com/AnalyticalGraphicsInc/cesium/issues/1323 for details.
  const firstImageryProvider = new SingleTileImageryProvider({
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    rectangle: Rectangle.fromDegrees(0, 0, 1, 1) // the Rectangle dimensions are arbitrary
  });

  const searchParams = new URLSearchParams(location.search);

  const terrainExaggeration = parseFloat(searchParams.get('terrainExaggeration') || '1');
  if (searchParams.get('noLimit') === 'false') {
    noLimit = false;
  }

  let terrainUrl;
  const ownTerrain = searchParams.get('ownterrain');
  switch (ownTerrain) {
    case 'false':
      terrainUrl = IonResource.fromAssetId(1);
      break;
    case 'cli_2m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ch-2m/';
      break;
    case 'cli_ticino_0.5m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ticino-0.5m/';
      break;
      case 'cli_walensee_0.5m':
        terrainUrl = 'https://download.swissgeol.ch/cli_terrain/walensee-0.5m/';
        break;
    default:
      terrainUrl = 'https://3d.geo.admin.ch/1.0.0/ch.swisstopo.terrain.3d/default/20200520/4326/';
  }

  const requestRenderMode = !searchParams.has('norequestrendermode');
  const terrainProvider = searchParams.has('noterrain') ? undefined : new CesiumTerrainProvider({
    url: terrainUrl
  });

  const viewer = new Viewer(container, {
    contextOptions: {
      webgl: {
        powerPreference: 'high-performance'
      }
    },
    showRenderLoopErrors: rethrowRenderErrors,
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
    useBrowserRecommendedResolution: true,
    terrainProvider: terrainProvider,
    terrainExaggeration: terrainExaggeration,
    requestRenderMode: requestRenderMode,
    // maximumRenderTimeChange: 10,
  });
  const scene = viewer.scene;
  scene.rethrowRenderErrors = rethrowRenderErrors;
  // remove the default behaviour of calling 'zoomTo' on the double clicked entity
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  enableCenterOfRotate(viewer);

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
  scene.backgroundColor = Color.TRANSPARENT;

  globe.baseColor = Color.TRANSPARENT;
  globe.depthTestAgainstTerrain = true;
  globe.showGroundAtmosphere = false;
  globe.showWaterEffect = false;
  globe.backFaceCulling = false;
  globe.undergroundColor = Color.BLACK;
  globe.undergroundColorAlphaByDistance.nearValue = 0.5;
  globe.undergroundColorAlphaByDistance.farValue = 0.0;

  const fog = new PostProcessStage({
    fragmentShader: FOG_FRAGMENT_SHADER_SOURCE,
    uniforms: {
      fogByDistance: new Cartesian4(10000, 0.0, 150000, 0.3),
      fogColor: Color.BLACK
    },
    name: 'fog'
  });

  viewer.scene.postProcessStages.add(fog);
  scene.postRender.addEventListener(scene => {
    fog.enabled = scene.cameraUnderground;
  });

  const enableWireframe = searchParams.has('inspector_wireframe');
  if (searchParams.has('inspector') || enableWireframe) {
    const div = document.createElement('div');
    div.id = 'divinspector';
    document.body.appendChild(div);
    const inspector = new CesiumInspector('divinspector', scene);
    window['cesiumInspector'] = inspector;
    if (enableWireframe) {
      inspector.viewModel.wireframe = true;
    }
  }
  return viewer;
}

function enableCenterOfRotate(viewer) {
  const scene = viewer.scene;
  const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);
  scene.camera.constrainedAxis = new Cartesian3(0, 0, 1);
  eventHandler.setInputAction(event => {
    const pickedPosition = scene.pickPosition(event.position);
    if (pickedPosition) {
      const transform = Transforms.eastNorthUpToFixedFrame(pickedPosition);
      scene.camera.lookAtTransform(transform);
      scene.screenSpaceCameraController.rotateEventTypes = [CameraEventType.LEFT_DRAG, {
        eventType: CameraEventType.LEFT_DRAG,
        modifier: KeyboardEventModifier.CTRL
      }];
    }
  }, ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.CTRL);
  eventHandler.setInputAction(() => scene.camera.lookAtTransform(Matrix4.IDENTITY), ScreenSpaceEventType.LEFT_UP);
  eventHandler.setInputAction(() => {
    scene.camera.setView({
      orientation: {
        heading: scene.camera.heading,
        pitch: scene.camera.pitch
      }
    });
  }, ScreenSpaceEventType.MOUSE_MOVE, KeyboardEventModifier.CTRL);
  eventHandler.setInputAction(() => {
    scene.camera.lookAtTransform(Matrix4.IDENTITY);
  }, ScreenSpaceEventType.LEFT_UP, KeyboardEventModifier.CTRL);
}

/**
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 */
export function addMantelEllipsoid(viewer) {
  // Add Mantel ellipsoid
  const earthRadii = Ellipsoid.WGS84.radii.clone();
  const mantelDepth = 30000; // See https://jira.camptocamp.com/browse/GSNGM-34
  const mantelRadii = earthRadii.clone();
  mantelRadii.x -= mantelDepth;
  mantelRadii.y -= mantelDepth;
  mantelRadii.z -= mantelDepth;

  const entity = viewer.entities.add({
    position: new Cartesian3(1, 1, 1), // small shift to avoid invertable error
    ellipsoid: {
      radii: mantelRadii,
      material: MANTEL_COLOR,
    }
  });

  if (!noLimit) {
    new LimitCameraHeightToDepth(viewer.scene, mantelDepth);
  }

  // hacky way to show mantel also above the terrain.
  // for some reason object placed below 21km doesn't show when the camera above the terrain. distanceDisplayCondition doesn't resolve the issue.
  const mantelDepthAboveTerrain = 21000;
  const mantelRadiiAboveTerrain = earthRadii.clone();
  mantelRadiiAboveTerrain.x -= mantelDepthAboveTerrain;
  mantelRadiiAboveTerrain.y -= mantelDepthAboveTerrain;
  mantelRadiiAboveTerrain.z -= mantelDepthAboveTerrain;

  let usedUndergroundValue = !viewer.scene.cameraUnderground;
  viewer.scene.postRender.addEventListener((scene) => {
    if (scene.cameraUnderground && !usedUndergroundValue) {
      entity.ellipsoid.radii = mantelRadii;
      usedUndergroundValue = true;
    } else if (!scene.cameraUnderground && usedUndergroundValue) {
      entity.ellipsoid.radii = mantelRadiiAboveTerrain;
      usedUndergroundValue = false;
    }
  });
}

/**
 * @typedef {Object} BaseLayerConfig
 * @property {string} id
 * @property {string} labelKey
 * @property {string} backgroundImgSrc
 * @property {Boolean=} default
 * @property {Boolean=} hasAlphaChannel
 * @property {Array<import('cesium/Source/Scene/ImageryLayer').default>} layers
 */


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

  /**
   * @type {Array<BaseLayerConfig>}
   */
  const mapsConfig = [
    {
      id: arealLayer,
      labelKey: t('dtd_areal_map_label'),
      backgroundImgSrc: './images/arealimage.png',
      layers: [
        addSwisstopoLayer(viewer, arealLayer, 'jpeg')
      ]
    },
    {
      id: greyLayer,
      default: true,
      labelKey: t('dtd_grey_map_label'),
      backgroundImgSrc: './images/grey.png',
      layers: [
        addSwisstopoLayer(viewer, greyLayer, 'jpeg')
      ]
    },
    {
      id: 'lakes_rivers_map',
      labelKey: t('dtd_lakes_rivers_map_label'),
      backgroundImgSrc: './images/lakes_rivers.png',
      hasAlphaChannel: true,
      layers: [
        addSwisstopoLayer(viewer, 'ch.bafu.vec25-gewaessernetz_2000', 'png', '20070101'),
        addSwisstopoLayer(viewer, 'ch.bafu.vec25-seen', 'png', '20070101')
      ]
    },
    {
      id: 'empty_map',
      labelKey: t('dtd_empty_map_label'),
      backgroundImgSrc: './images/empty.png',
      layers: [
        emptyLayer
      ]
    }];

  return new MapChooser(viewer, mapsConfig);
}
