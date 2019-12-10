Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjNhNmQ4My01OTdlLTRjNmQtYTllYS1lMjM0NmYxZTU5ZmUiLCJpZCI6MTg3NTIsInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyJdLCJpYXQiOjE1NzQ0MTAwNzV9.Cj3sxjA_x--bN6VATcN4KE9jBJNMftlzPuA8hawuZkY';


const WMTS_4326_BOUNDS = [5.140242, 45.398181, 11.47757, 48.230651];
const WMTS_4326_RECTANGLE = Cesium.Rectangle.fromDegrees.apply(null, WMTS_4326_BOUNDS);

const viewer = new Cesium.Viewer(document.querySelector('main > .cesium'), {
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

  imageryProvider: new Cesium.WebMapTileServiceImageryProvider({
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-karte-grau.3d/default/current/3857/{TileMatrix}/{TileCol}/{TileRow}.jpeg',
    rectangle: WMTS_4326_RECTANGLE,
    credit: new Cesium.Credit('Swisstopo')
  }),

  terrainProvider: new Cesium.CesiumTerrainProvider({
    url: Cesium.IonResource.fromAssetId(1)
  })
});

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(8.2275, 46.8182, 1000000),
  duration: 0
});

const layer = viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
  url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.geologie-geocover/default/current/3857/{TileMatrix}/{TileCol}/{TileRow}.png',
  rectangle: WMTS_4326_RECTANGLE,
  credit: new Cesium.Credit('Swisstopo')
}));
layer.alpha = 0.5;

// TIN of a gelogical layer
Cesium.IonResource.fromAssetId(56810)
  .then((resource) => Cesium.GeoJsonDataSource.load(resource))
  .then((dataSource) => viewer.dataSources.add(dataSource))
  .otherwise((error) => {
    console.log(error);
  });


// Boreholes
Cesium.IonResource.fromAssetId(56806)
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
      ['true', '" 32px arial"']
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
  translucencyByDistance: {
    conditions: [
      ['${LOD} === "7"', 'vec4(5000, 1, 5001, 1)'],
      ['${LOD} === "6"', 'vec4(5000, 1, 5001, 1)'],
      ['${LOD} === "5"', 'vec4(5000, 1, 8000, 0.4)'],
      ['${LOD} === "4"', 'vec4(5000, 1, 10000, 0.4)'],
      ['${LOD} === "3"', 'vec4(5000, 1, 20000, 0.4)'],
      ['${LOD} === "2"', 'vec4(5000, 1, 30000, 0.4)'],
      ['${LOD} === "1"', 'vec4(5000, 1, 50000, 0.4)'],
      ['${LOD} === "0"', 'vec4(5000, 1, 500000, 1)'],
      ['true', 'vec4(5000, 1, 10000, 0.5)']
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
viewer.scene.primitives.add(swissnames);


document.querySelector('#depth-test').addEventListener('change', (event) => {
  viewer.scene.globe.depthTestAgainstTerrain = event.target.checked;
});
