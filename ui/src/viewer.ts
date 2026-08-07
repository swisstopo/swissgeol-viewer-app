import { SWITZERLAND_RECTANGLE } from './constants';

import NavigableVolumeLimiter from './NavigableVolumeLimiter';
import KeyboardNavigation from './KeyboardNavigation.js';

import {
  Cartesian3,
  CesiumInspector,
  CesiumTerrainProvider,
  Color,
  DirectionalLight,
  ImageryLayer,
  Ion,
  IonResource,
  Rectangle,
  RequestScheduler,
  ScreenSpaceEventType,
  Viewer,
  WebGLOptions,
} from 'cesium';
import { getExaggeration } from './permalink';

window['CESIUM_BASE_URL'] = './cesium';

Ion.defaultAccessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(RequestScheduler.requestsByServer, {
  'wmts.geo.admin.ch:443': 18,
  'wms0.geo.admin.ch:443': 9,
  'wms1.geo.admin.ch:443': 9,
  'wms2.geo.admin.ch:443': 9,
  'wms3.geo.admin.ch:443': 9,
  'vectortiles0.geo.admin.ch:443': 18,
});

let hasNoLimit = false;

interface EmptyLayer {
  layer: { show: boolean };
}

export interface BaseLayerConfig {
  id: string;
  labelKey: string;
  backgroundImgSrc: string;
  layers?: ImageryLayer[] | EmptyLayer[];
  default?: boolean;
  hasAlphaChannel?: boolean;
}

export async function setupViewer(container: Element) {
  const searchParams = new URLSearchParams(location.search);

  const zExaggeration = getExaggeration();
  if (searchParams.get('noLimit') === 'true') {
    hasNoLimit = true;
  }

  let terrainUrl;
  const ownTerrain = searchParams.get('ownterrain');
  switch (ownTerrain) {
    case 'false':
      terrainUrl = IonResource.fromAssetId(1);
      break;
    case 'cli_ticino_0.5m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ticino-0.5m/';
      break;
    case 'cli_walensee_0.5m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/walensee-0.5m/';
      break;
    case 'cli_terrain_ch-2m':
      terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ch-2m/';
      break;
    default:
      terrainUrl = 'https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/';
  }

  const shouldRequestRenderMode = !searchParams.has('norequestrendermode');
  const terrainProvider = searchParams.has('noterrain')
    ? undefined
    : await CesiumTerrainProvider.fromUrl(terrainUrl);

  const webgl: WebGLOptions = {
    powerPreference: 'high-performance',
  };
  const contextOptions = {
    webgl,
  };
  const viewer = new Viewer(container, {
    contextOptions: contextOptions,
    showRenderLoopErrors: false,
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
    baseLayer: false,
    useBrowserRecommendedResolution: true,
    terrainProvider,
    requestRenderMode: shouldRequestRenderMode,
    // maximumRenderTimeChange: 10,
  });

  // Print errors to console.
  // Might be a good idea to create an alert for this at some point,
  // as these errors can break the viewer.
  viewer.scene.renderError.addEventListener((_scene, error) => {
    console.error(String(error));
    viewer.scene.requestRender();
  });

  viewer.scene.postProcessStages.ambientOcclusion.enabled = false;

  const scene = viewer.scene;

  // Hide underground fog.
  scene.fog.enabled = false;
  scene.globe.showGroundAtmosphere = false;

  scene.rethrowRenderErrors = false;
  // remove the default behaviour of calling 'zoomTo' on the double clicked entity
  viewer.screenSpaceEventHandler.removeInputAction(
    ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  );
  const globe = scene.globe;
  scene.verticalExaggeration = zExaggeration;

  if (searchParams.get('swissrectangle') !== 'false') {
    const rectangle = Rectangle.fromDegrees(
      5.86725126512748,
      45.8026860136571,
      10.9209100671547,
      47.8661652478939,
    );
    globe.cartographicLimitRectangle = rectangle;
  }

  // Disable underground fog.
  viewer.scene.fog.enabled = false;

  // Create a directional light aligned with the camera.
  const light = new DirectionalLight({
    direction: Cartesian3.clone(scene.camera.directionWC),
    intensity: 2,
  });
  scene.light = light;

  // Update the light position when the camera moves.
  scene.preRender.addEventListener(() => {
    light.direction = Cartesian3.clone(
      scene.camera.directionWC,
      light.direction,
    );
  });

  // Limit the volume inside which the user can navigate
  if (!hasNoLimit) {
    new NavigableVolumeLimiter(scene, SWITZERLAND_RECTANGLE, 193, (height) =>
      height > 3000 ? 9 : 3,
    );
  }

  new KeyboardNavigation(viewer.scene);

  scene.useDepthPicking = true;
  scene.pickTranslucentDepth = true; // required to have accurate position when picking translucent objects
  scene.backgroundColor = Color.TRANSPARENT;
  globe.baseColor = Color.TRANSPARENT;
  globe.depthTestAgainstTerrain = true;
  globe.showGroundAtmosphere = false;
  globe.showWaterEffect = false;
  globe.backFaceCulling = false;
  globe.undergroundColor = Color.BLACK;
  globe.undergroundColorAlphaByDistance.nearValue = 0.5;
  globe.undergroundColorAlphaByDistance.farValue = 0.0;

  const shouldEnableWireframe = searchParams.has('inspector_wireframe');
  if (searchParams.has('inspector') || shouldEnableWireframe) {
    const div = document.createElement('div');
    div.id = 'divinspector';
    document.body.appendChild(div);
    const inspector = new CesiumInspector('divinspector', scene);
    window['cesiumInspector'] = inspector;
    if (shouldEnableWireframe) {
      inspector.viewModel.wireframe = true;
    }
  }

  return viewer;
}
