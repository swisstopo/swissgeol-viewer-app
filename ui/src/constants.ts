import {
  Cartesian3,
  Color,
  ColorBlendMode,
  Math as CMath,
  Rectangle,
  ShadowMode,
  GeographicTilingScheme,
  Ellipsoid,
} from 'cesium';

export { LayerType, DEFAULT_LAYER_OPACITY } from './layertree';

export const SWITZERLAND_BOUNDS_WGS84 = [4.54249, 44.61921, 12.6725, 48.45365];
export const SWITZERLAND_BOUNDS_LV95 = [2370000, 945000, 2987000, 1380000];

export const SWITZERLAND_RECTANGLE = Rectangle.fromDegrees(
  ...SWITZERLAND_BOUNDS_WGS84,
);

export const MINIMAP_EXTENT = [
  5.910642046, 45.191912227, 10.554524194, 48.04750923,
];

export const MAP_RECTANGLE = Rectangle.fromDegrees(
  ...[5.91, 45.8179, 10.9, 47.9],
);

export const WEB_MERCATOR_TILING_SCHEME = new GeographicTilingScheme({
  ellipsoid: Ellipsoid.WGS84,
  rectangle: SWITZERLAND_RECTANGLE,
});

export const DEFAULT_VIEW = {
  destination: Cartesian3.fromDegrees(
    8.41011994246399,
    46.831646400427914,
    425641,
  ),
  orientation: {
    heading: CMath.toRadians(0),
    pitch: CMath.toRadians(-90.0),
  },
};

export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'];
export const DRILL_PICK_LIMIT = 2;
export const DRILL_PICK_LENGTH = 1;

export const LAYERS_URL_PARAM = 'layers';
export const LAYERS_VISIBILITY_URL_PARAM = 'layers_visibility';
export const LAYERS_TRANSPARENCY_URL_PARAM = 'layers_transparency';
export const LAYERS_TIMESTAMP_URL_PARAM = 'layers_timestamp';
export const ASSET_IDS_URL_PARAM = 'ionAssetIds';
export const ION_TOKEN_URL_PARAM = 'ionToken';
export const MAP_URL_PARAM = 'map';
export const MAP_TRANSPARENCY_URL_PARAM = 'map_transparency';
export const ATTRIBUTE_KEY_PARAM = 'attribute_key';
export const ATTRIBUTE_VALUE_PARAM = 'attribute_value';
export const ZOOM_TO_PARAM = 'zoom_to';
export const SLICE_PARAM = 'slice';
export const TARGET_PARAM = 'target';
export const TOPIC_PARAM = 'topicId';
export const PROJECT_PARAM = 'projectId';
export const VIEW_PARAM = 'viewId';
export const EXAGGERATION_PARAM = 'zExaggeration';

export const MANTEL_COLOR = Color.fromCssColorString('#383838');

export const DEFAULT_AOI_COLOR = Color.BLUE;
export const GEOMETRY_LINE_ALPHA = 0.8;
export const GEOMETRY_POLYGON_ALPHA = 0.3;
export const HIGHLIGHTED_GEOMETRY_COLOR = Color.YELLOW;

export const CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD = [
  'polygon',
  'polyline',
  'point',
];
export const AVAILABLE_GEOMETRY_TYPES = [
  'polygon',
  'line',
  'point',
  'rectangle',
];

export const GEOMETRY_DATASOURCE_NAME = 'toolboxGeometry';
export const NO_EDIT_GEOMETRY_DATASOURCE_NAME = 'noEditToolboxGeometry';

export const OBJECT_HIGHLIGHT_COLOR = Color.fromCssColorString(
  '#B3FF30',
  new Color(),
);
export const OBJECT_HIGHLIGHT_NORMALIZED_RGB = '0.702, 1.0, 0.188';
export const SWISSTOPO_IT_HIGHLIGHT_COLOR = Color.fromCssColorString(
  '#ff8000',
  new Color(),
);
export const OBJECT_ZOOMTO_RADIUS = 500;

const hostname = document.location.hostname;
export const PROJECT_ASSET_URL =
  hostname === 'localhost'
    ? 'http://localhost:9000/ngmpub-project-files-local/assets/saved/'
    : `https://project-files.${hostname}/assets/saved/`;

// Size in MB. DefaultBodyLimit should be updated on backend after this value update
export const PROJECT_ASSET_MAX_SIZE = 2;

export const DEFAULT_VOLUME_HEIGHT_LIMITS = {
  lowerLimit: -5000,
  height: 10000,
};

export const GEOMETRY_COLORS = [
  { color: 'blue', value: Color.BLUE },
  { color: 'green', value: Color.GREEN },
  { color: 'yellow', value: Color.YELLOW },
  { color: 'orange', value: Color.ORANGE },
  { color: 'red', value: Color.RED },
  { color: 'white', value: Color.WHITE },
  { color: 'gray', value: Color.GRAY },
  { color: 'black', value: Color.BLACK },
];

export const DEFAULT_PROJECT_COLOR = '#BDBDBD';

export const PROJECT_COLORS = [
  '#E57373',
  '#C276D9',
  '#64B5F6',
  '#4DD0E1',
  '#81C784',
  '#D4E157',
  '#FFEE58',
  '#FFCA28',
  '#FFA726',
  '#A1887F',
  '#BDBDBD',
  '#B0BEC5',
];

export const COLORS_WITH_BLACK_TICK = ['white', 'yellow', 'orange'];

export const POINT_SYMBOLS = [
  'marker-icon-white.png',
  'triangle-icon-white.png',
];

export const SLICE_BOX_ARROWS_INSIDE = [
  { side: 'left', oppositeSide: 'right', uri: '/images/arrowV.glb' },
  { side: 'right', oppositeSide: 'left', uri: '/images/arrowV.glb' },
  { side: 'back', oppositeSide: 'front', uri: '/images/arrowH.glb' },
  { side: 'front', oppositeSide: 'back', uri: '/images/arrowH.glb' },
];

export const SLICE_BOX_ARROWS_OUTSIDE = [
  ...SLICE_BOX_ARROWS_INSIDE,
  { side: 'down', oppositeSide: 'up', uri: '/images/arrowA.glb' },
  { side: 'up', oppositeSide: 'down', uri: '/images/arrowA.glb' },
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
  color: SLICING_GEOMETRY_COLOR,
};

export const SWISSFORAGES_VIEWER_URL = 'https://swissforages.ch/';
export const SWISSFORAGES_EDITOR_URL = `${SWISSFORAGES_VIEWER_URL}editor/`;
export const SWISSFORAGES_API_URL = `${SWISSFORAGES_VIEWER_URL}api/v1`;

export const SHORTLINK_URL_BY_PAGE_HOST = {
  'localhost:8000': '/abbr',
  'review-viewer.swissgeol.ch': 'https://link.dev-viewer.swissgeol.ch',
  'dev-viewer.swissgeol.ch': 'https://link.dev-viewer.swissgeol.ch',
  'int-viewer.swissgeol.ch': 'https://link.int-viewer.swissgeol.ch',
  'swissgeol.ch': 'https://link.swissgeol.ch',
  'viewer.swissgeol.ch': 'https://link.swissgeol.ch',
};

export const API_BY_PAGE_HOST = {
  'localhost:8000': '/api',
  'review-viewer.swissgeol.ch': 'https://api.dev-viewer.swissgeol.ch/api',
  'dev-viewer.swissgeol.ch': 'https://api.dev-viewer.swissgeol.ch/api',
  'int-viewer.swissgeol.ch': 'https://api.int-viewer.swissgeol.ch/api',
  'swissgeol.ch': 'https://api.swissgeol.ch/api',
  'viewer.swissgeol.ch': 'https://api.swissgeol.ch/api',
};

export const DEFAULT_UPLOADED_KML_COLOR = Color.fromCssColorString('#0056A4');

const _COGNITO_VARIABLES = {
  dev: {
    env: 'dev',
    region: 'eu-west-1',
    clientId: '10h1tga4i933buv25lelalmtrn',
    identityPoolId: 'eu-west-1:aa0d145d-228e-40be-bb73-a9a2c83879df',
    userPoolId: 'eu-west-1_dbfEb2FuH',
  },
  int: {
    env: 'int',
    region: 'eu-west-1',
    clientId: '35ld39a721f3fhbsgci6gekde2',
    identityPoolId: 'eu-west-1:8dc87444-330a-4aa6-8e50-975c0aae97ae',
    userPoolId: 'eu-west-1_HJ4hFAg2P',
  },
  prod: {
    env: 'prod',
    region: 'eu-west-1',
    clientId: '6brvjsufv7fdubr12r9u0gajnj',
    identityPoolId: 'eu-west-1:8e7b48a6-9d3f-4a46-afa3-d05a78c46a90',
    userPoolId: 'eu-west-1_1NcmOhPt4',
  },
};
_COGNITO_VARIABLES['default_active_env'] = _COGNITO_VARIABLES['dev'];
export const COGNITO_VARIABLES =
  _COGNITO_VARIABLES[(window as any).activeEnvironment];
