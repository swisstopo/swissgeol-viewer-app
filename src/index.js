import '@geoblocks/ga-search';

import NavigableVolumeLimiter from './NavigableVolumeLimiter.js';
import {init as i18nInit} from './i18n.js';

i18nInit();

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';

Object.assign(Cesium.RequestScheduler.requestsByServer, {
  'wmts.geo.admin.ch:443': 18,
  'vectortiles0.geo.admin.ch:443': 18
});

const WMTS_4326_BOUNDS = [5.140242, 45.398181, 11.47757, 48.230651];
const WMTS_4326_RECTANGLE = Cesium.Rectangle.fromDegrees(...WMTS_4326_BOUNDS);

const viewer = new Cesium.Viewer(document.querySelector('#cesium'), {
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

  imageryProvider: new Cesium.WebMapTileServiceImageryProvider({
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.geologie-geocover/default/current/3857/{TileMatrix}/{TileCol}/{TileRow}.png',
    rectangle: WMTS_4326_RECTANGLE,
    credit: new Cesium.Credit('Swisstopo')
  }),

  // almost invisible grey background
  // imageryProvider: new Cesium.WebMapTileServiceImageryProvider({
  //   url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-karte-grau.3d/default/current/3857/{TileMatrix}/{TileCol}/{TileRow}.jpeg',
  //   rectangle: WMTS_4326_RECTANGLE,
  //   credit: new Cesium.Credit('Swisstopo')
  // }),

  terrainProvider: new Cesium.CesiumTerrainProvider({
    url: Cesium.IonResource.fromAssetId(1)
  })
});

// Position the sun the that shadows look nice
viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date('June 21, 2018 12:00:00 GMT+0200'));

// Set the fly home rectangle
Cesium.Camera.DEFAULT_VIEW_RECTANGLE = WMTS_4326_RECTANGLE;

// Limit the volume inside which the user can navigate
new NavigableVolumeLimiter(viewer.scene, WMTS_4326_RECTANGLE, 193, height => (height > 3000 ? 9 : 3));

const globe = viewer.scene.globe;
globe.baseColor = Cesium.Color.WHITE;
globe.depthTestAgainstTerrain = true;
globe.showGroundAtmosphere = false;
globe.showWaterEffect = false;
globe.backFaceCulling = false;

viewer.camera.flyTo({
  destination: WMTS_4326_RECTANGLE,
  duration: 0
});

const unlisten = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
  if (viewer.scene.globe.tilesLoaded) {
    unlisten();

    // TIN of a geological layer
    Cesium.IonResource.fromAssetId(56810)
      .then((resource) => Cesium.GeoJsonDataSource.load(resource))
      .then((dataSource) => viewer.dataSources.add(dataSource))
      .otherwise((error) => {
        console.log(error);
      });


    // Boreholes
    Cesium.IonResource.fromAssetId(62737)
      .then((resource) => Cesium.GeoJsonDataSource.load(resource))
      .then((dataSource) => viewer.dataSources.add(dataSource))
      .otherwise((error) => {
        console.log(error);
      });

    // Tunnel
    viewer.scene.primitives.add(
      new Cesium.Cesium3DTileset({
        url: Cesium.IonResource.fromAssetId(56812)
      })
    );


    // labels 3D
    const swissnames = new Cesium.Cesium3DTileset({
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json'
    });
    swissnames.style = new Cesium.Cesium3DTileStyle({
      labelStyle: 2,
      labelText: '${DISPLAY_TEXT}',
      disableDepthTestDistance: Infinity,
      anchorLineEnabled: true,
      anchorLineColor: "color('white')",
      heightOffset: 200,
      labelColor: {
        conditions: [
          ['${OBJEKTART} === "See"', 'color("blue")'],
          ['true', 'color("black")']
        ]
      },
      labelOutlineColor: 'color("white", 1)',
      labelOutlineWidth: 5,
      font: {
        conditions: [
          ['${OBJEKTART} === "See"', '"bold 32px arial"'],
          ['true', '"32px arial"']
        ]
      },
      scaleByDistance: {
        conditions: [
          ['${LOD} === "7"', 'vec4(1000, 1, 5000, 0.4)'],
          ['${LOD} === "6"', 'vec4(1000, 1, 5000, 0.4)'],
          ['${LOD} === "5"', 'vec4(1000, 1, 8000, 0.4)'],
          ['${LOD} === "4"', 'vec4(1000, 1, 10000, 0.4)'],
          ['${LOD} === "3"', 'vec4(1000, 1, 20000, 0.4)'],
          ['${LOD} === "2"', 'vec4(1000, 1, 30000, 0.4)'],
          ['${LOD} === "1"', 'vec4(1000, 1, 50000, 0.4)'],
          ['${LOD} === "0"', 'vec4(1000, 1, 500000, 0.4)'],
          ['true', 'vec4(1000, 1, 10000, 0.4)']
        ]
      },
      distanceDisplayCondition: {
        'conditions': [
          ['${LOD} === "7"', 'vec2(0, 5000)'],
          ['${LOD} === "6"', 'vec2(0, 5000)'],
          ['${LOD} === "5"', 'vec2(0, 8000)'],
          ['${LOD} === "4"', 'vec2(0, 10000)'],
          ['${LOD} === "3"', 'vec2(0, 20000)'],
          ['${LOD} === "2"', 'vec2(0, 30000)'],
          ['${LOD} === "1"', 'vec2(0, 50000)'],
          ['${LOD} === "0"', 'vec2(0, 500000)'],
        ]
      }
    });
    // FIXME: labels are deactivated for performance reason
    // viewer.scene.primitives.add(swissnames);

  }
});

document.querySelector('#depth-test').addEventListener('change', event => {
  viewer.scene.globe.depthTestAgainstTerrain = !event.target.checked;
  viewer.scene.requestRender();
});

document.querySelector('#zoomToHome').addEventListener('click', event => {
  viewer.scene.camera.flyTo({
    destination: WMTS_4326_RECTANGLE
  });
});

document.querySelector('ga-search').addEventListener('submit', event => {
  const box = event.detail.result.bbox;
  if (box) {
    const rectangle = Cesium.Rectangle.fromDegrees(...box);
    if (rectangle.width === 0 && rectangle.height === 0) {
      // point
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(box[0], box[1], 5000)
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
