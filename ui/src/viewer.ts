import {MANTEL_COLOR, SWITZERLAND_RECTANGLE} from './constants';

import NavigableVolumeLimiter from './NavigableVolumeLimiter';
import LimitCameraHeightToDepth from './LimitCameraHeightToDepth';
import KeyboardNavigation from './KeyboardNavigation.js';
import MapChooser from './MapChooser';
import {addSwisstopoLayer} from './swisstopoImagery.js';

import type {ImageryLayer, WebGLOptions} from 'cesium';
import {
    CameraEventType,
    Cartesian3,
    Cartesian4,
    CesiumInspector,
    CesiumTerrainProvider,
    Color,
    DirectionalLight,
    Ellipsoid,
    Ion,
    IonResource,
    JulianDate,
    KeyboardEventModifier,
    Matrix4,
    PostProcessStage,
    Rectangle,
    RequestScheduler,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    SunLight,
    Transforms,
    Viewer,
    FrameRateMonitor
} from 'cesium';
import MainStore from './store/main';


window['CESIUM_BASE_URL'] = 'Cesium';

Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(RequestScheduler.requestsByServer, {
    'wmts.geo.admin.ch:443': 18,
    'wms0.geo.admin.ch:443': 9,
    'wms1.geo.admin.ch:443': 9,
    'wms2.geo.admin.ch:443': 9,
    'wms3.geo.admin.ch:443': 9,
    'vectortiles0.geo.admin.ch:443': 18
});

let noLimit = true;

const FOG_FRAGMENT_SHADER_SOURCE = `
  float getDistance(sampler2D depthTexture, vec2 texCoords) {
      float depth = czm_unpackDepth(texture(depthTexture, texCoords));
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
  in vec2 v_textureCoordinates;
  void main(void) {
      float distance = getDistance(depthTexture, v_textureCoordinates);
      vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
      float blendAmount = interpolateByDistance(fogByDistance, distance);
      vec4 finalFogColor = vec4(fogColor.rgb, fogColor.a * blendAmount);
      out_FragColor = alphaBlend(finalFogColor, sceneColor);
  }`;

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

export async function setupViewer(container: Element, rethrowRenderErrors: boolean) {

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
        case 'cli_ticino_0.5m':
            terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ticino-0.5m/';
            break;
        case 'cli_walensee_0.5m':
            terrainUrl = 'https://download.swissgeol.ch/cli_terrain/walensee-0.5m/';
            break;
        default:
            terrainUrl = 'https://download.swissgeol.ch/cli_terrain/ch-2m/';
    }

    const requestRenderMode = !searchParams.has('norequestrendermode');
    const terrainProvider = searchParams.has('noterrain') ? undefined : await CesiumTerrainProvider.fromUrl(terrainUrl);

    const webgl: WebGLOptions = {
        powerPreference: 'high-performance',
    };
    const contextOptions = {
        webgl
    };
    const viewer = new Viewer(container, {
        contextOptions: contextOptions,
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
        baseLayer: false,
        useBrowserRecommendedResolution: true,
        terrainProvider: terrainProvider,
        requestRenderMode: requestRenderMode,
        // maximumRenderTimeChange: 10,
    });
    setResolutionScale(viewer);
    const scene = viewer.scene;
    scene.rethrowRenderErrors = rethrowRenderErrors;
    // remove the default behaviour of calling 'zoomTo' on the double clicked entity
    viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    enableCenterOfRotate(viewer);

    const globe = scene.globe;
    globe.terrainExaggeration = terrainExaggeration;

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
    let sunDate = new Date('2018-06-21T10:00:00.000Z');
    if (searchParams.has('date')) {
        const betterDate = new Date(searchParams.get('date') || '');
        if (Number.isNaN(betterDate.getDate())) {
            console.error(`Provided date is wrong: ${searchParams.get('date')}`);
        } else {
            sunDate = betterDate;
        }
    }
    viewer.clock.currentTime = JulianDate.fromDate(sunDate);

    if (searchParams.has('light')) {
        const p = searchParams.get('light')?.split('-').map(parseFloat) as number[];
        scene.light = new DirectionalLight({
            direction: new Cartesian3(p[0], p[1], p[2]),
            color: Color.WHITE,
            intensity: p[3],
        });
    } else {
        // Use sun lighting above ground
        const sunLight = new SunLight();
        // Define a flashlight for viewing underground
        const flashlight = new DirectionalLight({
            direction: scene.camera.directionWC,
        });
        scene.preRender.addEventListener((scene) => {
            if (scene.cameraUnderground) {
                flashlight.direction = Cartesian3.clone(
                    scene.camera.directionWC,
                    flashlight.direction
                );
                scene.light = flashlight;
            } else {
                scene.light = sunLight;
            }
        });
    }

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

function enableCenterOfRotate(viewer: Viewer) {
    const scene = viewer.scene;
    const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);
    scene.camera.constrainedAxis = new Cartesian3(0, 0, 1);
    // look fix camera on picked position when ctrl pressed
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
    // move camera around picked position when ctrl pressed
    eventHandler.setInputAction(() => {
        scene.camera.setView({
            orientation: {
                heading: scene.camera.heading,
                pitch: scene.camera.pitch
            }
        });
    }, ScreenSpaceEventType.MOUSE_MOVE, KeyboardEventModifier.CTRL);
    // free view if left mouse button released
    eventHandler.setInputAction(() => {
        scene.camera.lookAtTransform(Matrix4.IDENTITY);
    }, ScreenSpaceEventType.LEFT_UP, KeyboardEventModifier.CTRL);
    // free view if ctrl released
    document.addEventListener('keyup', (evt) => {
        if (evt.key === 'Control') scene.camera.lookAtTransform(Matrix4.IDENTITY);
    });
}

function setResolutionScale(viewer: Viewer) {
    const frameRateMonitor = FrameRateMonitor.fromScene(viewer.scene);
    const scaleDownFps = 20;
    const scaleUpFps = 30;
    viewer.scene.postRender.addEventListener(() => {
        if (frameRateMonitor.lastFramesPerSecond < scaleDownFps && viewer.resolutionScale > 0.45) {
            viewer.resolutionScale = Number((viewer.resolutionScale - 0.05).toFixed(2));
        } else if (frameRateMonitor.lastFramesPerSecond > scaleUpFps && viewer.resolutionScale < 1) {
            viewer.resolutionScale = Number((viewer.resolutionScale + 0.05).toFixed(2));
        }
    });
}

export function addMantelEllipsoid(viewer: Viewer) {
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
        if (!entity.ellipsoid) return;
        const voxelVisible = MainStore.visibleVoxelLayers.length > 0;
        if (voxelVisible && entity.isShowing) {
            entity.show = false;
            viewer.scene.requestRender();
        } else if (!voxelVisible && !entity.isShowing) {
            entity.show = true;
            viewer.scene.requestRender();
        }
        if (scene.cameraUnderground && !usedUndergroundValue) {
            (<any>entity.ellipsoid.radii) = mantelRadii;
            usedUndergroundValue = true;
            if (!Color.equals(scene.backgroundColor, Color.TRANSPARENT)) scene.backgroundColor = Color.TRANSPARENT;
        } else if (!scene.cameraUnderground && usedUndergroundValue) {
            (<any>entity.ellipsoid.radii) = mantelRadiiAboveTerrain;
            usedUndergroundValue = false;
            if (voxelVisible && !Color.equals(scene.backgroundColor, MANTEL_COLOR)) scene.backgroundColor = MANTEL_COLOR;
        }
    });
}

export function setupBaseLayers(viewer: Viewer) {
    const arealLayer = 'ch.swisstopo.swissimage';
    const greyLayer = 'ch.swisstopo.pixelkarte-grau';

    const emptyLayer: EmptyLayer = {
        layer: {
            show: false
        }
    };
    const t = a => a;

    const mapsConfig: BaseLayerConfig[] = [
        {
            id: arealLayer,
            labelKey: t('dtd_aerial_map_label'),
            backgroundImgSrc: 'src/images/arealimage.png',
            layers: [
                addSwisstopoLayer(viewer, arealLayer, 'jpeg', 20)
            ]
        },
        {
            id: greyLayer,
            default: true,
            labelKey: t('dtd_grey_map_label'),
            backgroundImgSrc: 'src/images/grey.png',
            layers: [
                addSwisstopoLayer(viewer, greyLayer, 'jpeg', 18)
            ]
        },
        {
            id: 'lakes_rivers_map',
            labelKey: t('dtd_lakes_rivers_map_label'),
            backgroundImgSrc: 'src/images/lakes_rivers.png',
            hasAlphaChannel: true,
            layers: [
                addSwisstopoLayer(viewer, 'ch.bafu.vec25-seen', 'png', 18),
                addSwisstopoLayer(viewer, 'ch.bafu.vec25-gewaessernetz_2000', 'png', 18),
            ]
        },
        {
            id: 'empty_map',
            labelKey: t('dtd_empty_map_label'),
            backgroundImgSrc: 'src/images/empty.png',
            layers: [
                emptyLayer
            ]
        }];

    return new MapChooser(viewer, mapsConfig);
}
