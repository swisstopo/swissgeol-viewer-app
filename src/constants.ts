import {Cartesian3, Color, ColorBlendMode, Math as CMath, Rectangle, ShadowMode} from 'cesium';

export {LayerType, DEFAULT_LAYER_OPACITY} from './layertree';

export const SWITZERLAND_BOUNDS = [5.140242, 45.398181, 11.47757, 48.230651];

export const SWITZERLAND_RECTANGLE = Rectangle.fromDegrees(...SWITZERLAND_BOUNDS);

export const MINIMAP_EXTENT = [5.910642046, 45.191912227, 10.554524194, 48.04750923];

export const DEFAULT_VIEW = {
  destination: Cartesian3.fromDegrees(
    6.06749, 43.77784, 204227),
  orientation: {
    heading: CMath.toRadians(26.0),
    pitch: CMath.toRadians(-33.0)
  }
};

export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'];
export const DRILL_PICK_LIMIT = 2;
export const DRILL_PICK_LENGTH = 1;

export const LAYERS_URL_PARAM = 'layers';
export const LAYERS_VISIBILITY_URL_PARAM = 'layers_visibility';
export const LAYERS_TRANSPARENCY_URL_PARAM = 'layers_transparency';
export const ASSET_IDS_URL_PARAM = 'assetIds';
export const MAP_URL_PARAM = 'map';
export const MAP_TRANSPARENCY_URL_PARAM = 'map_transparency';
export const ATTRIBUTE_KEY_PARAM = 'attribute_key';
export const ATTRIBUTE_VALUE_PARAM = 'attribute_value';
export const ZOOM_TO_PARAM = 'zoom_to';
export const SLICE_PARAM = 'slice';

export const MANTEL_COLOR = Color.fromCssColorString('#383838');

export const DEFAULT_AOI_COLOR = Color.BLUE;
export const AOI_LINE_ALPHA = 0.8;
export const AOI_POLYGON_ALPHA = 0.3;
export const HIGHLIGHTED_AOI_COLOR = Color.YELLOW;

export const CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD = ['polygon', 'polyline', 'point'];
export const AVAILABLE_AOI_TYPES = ['polygon', 'line', 'point', 'rectangle'];

export const AOI_DATASOURCE_NAME = 'interestAreas';

export const OBJECT_HIGHLIGHT_COLOR = Color.fromCssColorString('#B3FF30', new Color());
export const OBJECT_ZOOMTO_RADIUS = 500;

export const DEFAULT_VOLUME_HEIGHT_LIMITS = {
  lowerLimit: -5000,
  height: 10000
};

export const GEOMETRY_COLORS = [
  {color: 'black', value: Color.BLACK},
  {color: 'blue', value: Color.BLUE},
  {color: 'gray', value: Color.GRAY},
  {color: 'green', value: Color.GREEN},
  {color: 'orange', value: Color.ORANGE},
  {color: 'red', value: Color.RED},
  {color: 'white', value: Color.WHITE},
  {color: 'yellow', value: Color.YELLOW},
];

export const POINT_SYMBOLS = ['marker-icon-white.png', 'triangle-icon-white.png'];

export const SLICE_BOX_ARROWS_INSIDE = [
  {side: 'left', oppositeSide: 'right', uri: './images/arrowV.glb'},
  {side: 'right', oppositeSide: 'left', uri: './images/arrowV.glb'},
  {side: 'back', oppositeSide: 'front', uri: './images/arrowH.glb'},
  {side: 'front', oppositeSide: 'back', uri: './images/arrowH.glb'},
];

export const SLICE_BOX_ARROWS_OUTSIDE = [
  ...SLICE_BOX_ARROWS_INSIDE,
  {side: 'down', oppositeSide: 'up', uri: './images/arrowA.glb'},
  {side: 'up', oppositeSide: 'down', uri: './images/arrowA.glb'}
];

export const SLICING_BOX_HEIGHT = DEFAULT_VOLUME_HEIGHT_LIMITS.height;
export const SLICING_BOX_LOWER_LIMIT = DEFAULT_VOLUME_HEIGHT_LIMITS.lowerLimit;
export const SLICING_BOX_MIN_SIZE = 450;
export const SLICING_GEOMETRY_COLOR = Color.WHITE;
export const DEFAULT_CONFIG_FOR_SLICING_ARROW = {
  minimumPixelSize: 32,
  scale: 1,
  maximumScale: 15000,
  shadows: ShadowMode.DISABLED,
  colorBlendMode: ColorBlendMode.MIX,
  color: SLICING_GEOMETRY_COLOR
};

export const SWISSFORAGES_VIEWER_URL = 'https://swissforages.ch/';
export const SWISSFORAGES_EDITOR_URL = `${SWISSFORAGES_VIEWER_URL}editor/`;
export const SWISSFORAGES_API_URL = `${SWISSFORAGES_VIEWER_URL}api/v1`;

export const SHORTLINK_HOST_BY_PAGE_HOST = {
  'localhost:8000': 'link.dev.swissgeol.ch',
  'review.swissgeol.ch': 'link.dev.swissgeol.ch',
  'dev.swissgeol.ch': 'link.dev.swissgeol.ch',
  'int.swissgeol.ch': 'link.int.swissgeol.ch',
  'beta.swissgeol.ch': 'link.swissgeol.ch',
  'swissgeol.ch': 'link.swissgeol.ch',
  'test.viewer.swissgeol.ch': 'link.swissgeol.ch',
  'viewer.swissgeol.ch': 'link.swissgeol.ch',
};

export const SHOWCASE_PROJECTS = [
  {
    title: 'Hot springs in Switzerland',
    description: 'A small tour on heat and water sources of hot springs in the Swiss midlands. Depending on the place, the geological situation can be very different.',
    created: '11 am January 2021',
    image: './images/spashing_water.png',
    color: '#B9271A',
    views: [
      {
        title: 'Thermalbad Egelsee',
        permalink: '?layers=boreholes,ch.swisstopo.geologie-tiefengeothermie_projekte,temperature_model,faults_geomol,ch.swisstopo.swisstlm3d.3d,top_omm,top_usm,top_umm,base_cenozoic&layers_visibility=true,true,true,true,true,true,true,true,true&layers_transparency=0,0.5,1,0,0,0.2,0.3,0.15,0.2&map_transparency=0&map=ch.swisstopo.swissimage&lon=9.16541&lat=47.67935&elevation=2763&heading=176&pitch=-36&slice={"type":"view-line","slicePoints":[{"x":4249855.295002234,"y":687067.3765101306,"z":4690313.160185342},{"x":4249844.886360756,"y":686029.243426846,"z":4690473.465777454}]}',
        targetPoint: false
      },
      {
        title: 'Thermalbad Baden',
        permalink: '?layers=boreholes,ch.swisstopo.geologie-tiefengeothermie_projekte,temperature_model,faults_geomol,ch.swisstopo.swisstlm3d.3d,top_muschelkalk,top_keuper,top_lias,top_dogger,top_lower_malm,top_upper_malm,base_mesozoic&layers_visibility=true,true,true,true,true,true,true,true,true,true,true,true&layers_transparency=0,0.5,1,0.5,0,0,0,0,0,0,0,0&map_transparency=0&map=ch.swisstopo.swissimage&lon=8.36491&lat=47.46059&elevation=2669&heading=299&pitch=-31&slice={"type":"view-line","slicePoints":[{"x":4273763.245676614,"y":624541.26385917,"z":4677401.016558762},{"x":4272270.9806707995,"y":624286.9741874507,"z":4678788.655482157}]}',
        targetPoint: false
      },
      {
        title: 'Les Bains d\'Yverdon',
        permalink: '?layers=boreholes,ch.swisstopo.geologie-tiefengeothermie_projekte,temperature_model,top_upper_malm,base_cenozoic,top_lower_malm,top_dogger,top_lias,top_keuper,top_muschelkalk,base_mesozoic,base_permocarboniferous,base_permocarboniferous_supposed,faults_geomol,ch.swisstopo.swisstlm3d.3d&layers_visibility=true,true,true,true,true,true,true,true,true,true,true,true,true,true,true&layers_transparency=0,0.5,1,0,0,0,0,0,0,0,0,0,0,0.5,0&map_transparency=0&map=ch.swisstopo.swissimage&lon=6.59900&lat=46.81160&elevation=3429&heading=144&pitch=-33&slice={"type":"view-line","slicePoints":[{"x":4345748.030793835,"y":507468.31110827957,"z":4625300.076949739},{"x":4347816.352357404,"y":505325.9842407562,"z":4623601.9831696395}]}',
        targetPoint: false
      }
    ]
  },
  {
    title: 'The church of Wassen',
    description: 'Infrastructure at the Gotthard transit route can be well seen on the earth surface, but what is actually hidden below the surface? Click on the different views to see the situation around the church of Wassen along the Gotthard transit route.',
    image: './images/wassen.png',
    created: '12 am September 2021',
    color: '#B9271A',
    views: [
      {
        title: 'Wassen as you know it',
        permalink: '?lon=8.59956&lat=46.70494&elevation=1010&heading=22&pitch=-15&map=ch.swisstopo.swissimage&map_transparency=0.00&layers=ch.swisstopo.swisstlm3d.3d&layers_visibility=true&layers_transparency=0.00',
        targetPoint: true
      },
      {
        title: 'Geological situation (click on a color to get more information)',
        permalink: '?lon=8.59533&lat=46.69436&elevation=2346&heading=20&pitch=-44&map=ch.swisstopo.swissimage&map_transparency=0.00&layers=ch.swisstopo.swisstlm3d.3d,ch.swisstopo.geologie-geocover&layers_visibility=true,true&layers_transparency=0.00,0.30',
        targetPoint: false
      },
      {
        title: 'Subsurface infrastructure',
        permalink: '?lon=8.59559&lat=46.69875&elevation=417&heading=21&pitch=23&map=ch.swisstopo.swissimage&map_transparency=0.43&layers=ch.swisstopo.swisstlm3d.3d,ch.swisstopo.geologie-geocover,water_tunnel,rail_tunnel,road_tunnel&layers_visibility=true,false,true,true,true&layers_transparency=0.00,0.82,0.00,0.00,0.00',
        targetPoint: true
      }
    ]
  }
];
