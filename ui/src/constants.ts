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
export const TARGET_PARAM = 'target';
export const TOPIC_PARAM = 'topicId';
export const VIEW_PARAM = 'viewId';

export const MANTEL_COLOR = Color.fromCssColorString('#383838');

export const DEFAULT_AOI_COLOR = Color.BLUE;
export const GEOMETRY_LINE_ALPHA = 0.8;
export const GEOMETRY_POLYGON_ALPHA = 0.3;
export const HIGHLIGHTED_GEOMETRY_COLOR = Color.YELLOW;

export const CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD = ['polygon', 'polyline', 'point'];
export const AVAILABLE_GEOMETRY_TYPES = ['polygon', 'line', 'point', 'rectangle'];

export const GEOMETRY_DATASOURCE_NAME = 'toolboxGeometry';

export const OBJECT_HIGHLIGHT_COLOR = Color.fromCssColorString('#B3FF30', new Color());
export const OBJECT_ZOOMTO_RADIUS = 500;

export const DEFAULT_VOLUME_HEIGHT_LIMITS = {
  lowerLimit: -5000,
  height: 10000
};

export const GEOMETRY_COLORS = [
  {color: 'blue', value: Color.BLUE},
  {color: 'green', value: Color.GREEN},
  {color: 'yellow', value: Color.YELLOW},
  {color: 'orange', value: Color.ORANGE},
  {color: 'red', value: Color.RED},
  {color: 'white', value: Color.WHITE},
  {color: 'gray', value: Color.GRAY},
  {color: 'black', value: Color.BLACK},
];

export const PROJECT_COLORS = [
  '#E57373', '#C276D9', '#64B5F6', '#4DD0E1', '#81C784', '#D4E157',
  '#FFEE58', '#FFCA28', '#FFA726', '#A1887F', '#BDBDBD', '#B0BEC5',
];

export const COLORS_WITH_BLACK_TICK = ['white', 'yellow', 'orange'];

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

export const SHORTLINK_URL_BY_PAGE_HOST = {
  'localhost:8000': '/abbr',
  'review.swissgeol.ch': 'https://link.dev.swissgeol.ch',
  'dev.swissgeol.ch': 'https://link.dev.swissgeol.ch',
  'int.swissgeol.ch': 'https://link.int.swissgeol.ch',
  'swissgeol.ch': 'https://link.swissgeol.ch',
  'viewer.swissgeol.ch': 'https://link.swissgeol.ch',
};

export const API_BY_PAGE_HOST = {
  'localhost:8000': '/api',
  'review.swissgeol.ch': 'https://api.dev.swissgeol.ch/api',
  'dev.swissgeol.ch': 'https://api.dev.swissgeol.ch/api',
  'int.swissgeol.ch': 'https://api.int.swissgeol.ch/api',
  'swissgeol.ch': 'https://api.swissgeol.ch/api',
  'viewer.swissgeol.ch': 'https://api.swissgeol.ch/api',
};
