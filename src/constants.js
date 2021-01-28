import Rectangle from 'cesium/Source/Core/Rectangle';
import Color from 'cesium/Source/Core/Color';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import CMath from 'cesium/Source/Core/Math';

export {LAYER_TYPES, DEFAULT_LAYER_TRANSPARENCY} from './layertree.js';

export const SWITZERLAND_BOUNDS = [5.140242, 45.398181, 11.47757, 48.230651];

export const SWITZERLAND_RECTANGLE = Rectangle.fromDegrees(...SWITZERLAND_BOUNDS);

export const DEFAULT_VIEW = {
  destination: Cartesian3.fromDegrees(
    6.06749, 43.77784, 204227),
  orientation: {
    heading: CMath.toRadians(26.0),
    pitch: CMath.toRadians(-33.0)
  }
};

export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'];
export const DRILL_PICK_LIMIT = 1;
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

export const DEFAULT_AOI_COLOR = Color.BLACK.withAlpha(0.3);
export const DEFAULT_AOI_VOLUME_COLOR = Color.GREY.withAlpha(0.3);
export const HIGHLIGHTED_AOI_COLOR = Color.YELLOW.withAlpha(0.3);

export const CESIUM_GRAPHICS_AVAILABLE_TO_UPLOAD = ['polygon', 'polyline', 'point'];
export const AVAILABLE_AOI_TYPES = ['polygon', 'line', 'point', 'rectangle'];

export const AOI_DATASOURCE_NAME = 'interestAreas';

export const OBJECT_HIGHLIGHT_COLOR = Color.fromCssColorString('#B3FF30', new Color());
export const OBJECT_ZOOMTO_RADIUS = 500;

export const DEFAULT_VOLUME_HEIGHT_LIMITS = {
  lowerLimit: -5000,
  height: 10000
};

export const AOI_POINT_COLORS = [
  {color: 'black', value: Color.BLACK},
  {color: 'blue', value: Color.BLUE},
  {color: 'gray', value: Color.GRAY},
  {color: 'green', value: Color.GREEN},
  {color: 'orange', value: Color.ORANGE},
  {color: 'red', value: Color.RED},
  {color: 'white', value: Color.WHITE},
  {color: 'yellow', value: Color.YELLOW},
];

export const AOI_POINT_SYMBOLS = ['marker-icon-white.png', 'triangle-icon-white.png'];

export const SLICE_ARROW_ICONS = [
  {type: 'vertical', uri: './images/arrowV.glb'},
  {type: 'vertical-northeast', uri: './images/arrowV.glb'},
  {type: 'horizontal', uri: './images/arrowH.glb'},
  {type: 'horizontal-northeast', uri: './images/arrowH.glb'},
  {type: 'altitude-down', uri: './images/arrowA.glb'},
  {type: 'altitude-up', uri: './images/arrowA.glb'}
];

// export const SWISSFORAGES_VIEWER_URL = 'https://swissforages.ch/'; todo change when CORS will be enabled
export const SWISSFORAGES_VIEWER_URL = 'https://swisstopo.supsi.ch/bdms/';
export const SWISSFORAGES_EDITOR_URL = `${SWISSFORAGES_VIEWER_URL}editor/`;
export const SWISSFORAGES_API_URL = `${SWISSFORAGES_VIEWER_URL}api/v1`;
