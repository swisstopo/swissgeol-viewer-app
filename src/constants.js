import Rectangle from 'cesium/Core/Rectangle.js';
import Color from 'cesium/Core/Color.js';
import LabelStyle from 'cesium/Scene/LabelStyle.js';


export const SWITZERLAND_BOUNDS = [5.140242, 45.398181, 11.47757, 48.230651];

export const SWITZERLAND_RECTANGLE = Rectangle.fromDegrees(...SWITZERLAND_BOUNDS);

export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'];
export const DRILL_PICK_LIMIT = 1;

export const BELOW_SURFACE_CONFIGURATION = {
  colorToAlpha: Color.DARKGRAY,
  colorToAlphaThreshold: 0,
  brightness: 0.5,
  gamma: 0.7
};

export const ABOVE_SURFACE_CONFIGURATION = {
  colorToAlpha: undefined,
  colorToAlphaThreshold: 0.004,
  brightness: 1,
  gamma: 1
};

export const LAYERS_URL_PARAM = 'layers';
export const LAYERS_VISIBILITY_URL_PARAM = 'layers_visibility';
export const LAYERS_OPACITY_URL_PARAM = 'layers_opacity';
export const ASSET_IDS_URL_PARAM = 'assetIds';

export const DEFAULT_AOI_COLOR = Color.BLACK.withAlpha(0.3);
export const HIGHLIGHTED_AOI_COLOR = Color.YELLOW.withAlpha(0.3);

// list of not graphics entity.propertyNames
export const CESIUM_NOT_GRAPHICS_ENTITY_PROPS = ['orientation', 'position', 'description', 'properties', 'viewForm', 'kml', 'polygon'];

export const LAS_POINT_CLOUD_STYLE = {
  pointSize: 5
};

export const SWISSTOPO_LABEL_STYLE = {
  labelStyle: LabelStyle.FILL,
  labelText: '${DISPLAY_TEXT}',
  disableDepthTestDistance: Infinity,
  anchorLineEnabled: false,
  heightOffset: 200,
  pointSize: 0,
  labelColor: 'color("black")',
  font: '"bold 32px arial"',
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
    conditions: [
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
};

export const LAYER_TYPES = {
  swisstopoWMTS: 'swisstopoWMTS',
  tiles3d: '3dtiles',
  ionGeoJSON: 'ionGeoJSON',
  earthquakes: 'earthquakes',
};

export const DEFAULT_LAYER_OPACITY = 0.7;

export const AOI_DATASOURCE_NAME = 'interestAreas';

export const TUNNEL_STYLE = {
  color:
    {
      conditions: [
        ['${TunnelType} === "RailTunnel"', 'color("red")'],
        ['${TunnelType} === "RoadTunnel"', 'color("blue")']
      ]
    }
};
