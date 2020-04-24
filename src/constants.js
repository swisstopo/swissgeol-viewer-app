import Rectangle from 'cesium/Core/Rectangle.js';
import Color from 'cesium/Core/Color.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import CMath from 'cesium/Core/Math.js';
import LabelStyle from 'cesium/Scene/LabelStyle.js';


export const SWITZERLAND_BOUNDS = [5.140242, 45.398181, 11.47757, 48.230651];

export const SWITZERLAND_RECTANGLE = Rectangle.fromDegrees(...SWITZERLAND_BOUNDS);

export const DEFAULT_VIEW = (function() {
  if (document.location.hostname === 'localhost') {
    return {
      destination: Cartesian3.fromDegrees(8.16834, 44.83954, -112297),
      orientation: {
        heading: CMath.toRadians(359),
        pitch: CMath.toRadians(30)
      }
    };
  } else {
    return {
      destination: Cartesian3.fromDegrees(
        6.06749, 43.77784, 204227),
      orientation: {
        heading: CMath.toRadians(26.0),
        pitch: CMath.toRadians(-33.0)
      }
    };
  }
})();


export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'];
export const DRILL_PICK_LIMIT = 1;

export const LAYERS_URL_PARAM = 'layers';
export const LAYERS_VISIBILITY_URL_PARAM = 'layers_visibility';
export const LAYERS_OPACITY_URL_PARAM = 'layers_opacity';
export const ASSET_IDS_URL_PARAM = 'assetIds';
export const MAP_URL_PARAM = 'map';

export const BILLBOARDS_PREFIX = 'billboards_';

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

const t = a => a;
const geo_map_series = {
  label: t('geological_map_series_label'),
  children: [
    {
      label: t('geological_maps_label'),
      children: [
        {
          type: LAYER_TYPES.swisstopoWMTS,
          label: t('ch_swisstopo_geologie_geocover'),
          layer: 'ch.swisstopo.geologie-geocover',
          visible: true,
          displayed: true,
          opacity: DEFAULT_LAYER_OPACITY,
        // }, {
        //   type: LAYER_TYPES.swisstopoWMTS,
        //   label: t('ch.swisstopo.pixelkarte-farbe'),
        //   layer: 'ch.swisstopo.pixelkarte-farbe',
        //   visible: true,
        //   displayed: true,
        //   opacity: DEFAULT_LAYER_OPACITY,
        // }, {
        //   type: LAYER_TYPES.swisstopoWMTS,
        //   label: t('ch.swisstopo.swisstlm3d-wanderwege'),
        //   layer: 'ch.swisstopo.swisstlm3d-wanderwege',
        //   visible: true,
        //   displayed: true,
        //   opacity: DEFAULT_LAYER_OPACITY,
        },
      ]
    },
  ]
};
const geo_base = {
  label: t('geological_bases_label'),
  children: [
    {
      label: t('borehole_data_profiles_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 68857,
          label: t('boreholes_label'),
          layer: 'boreholes',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          visible: true,
          displayed: true,
          billboards: {
            lonPropName: 'Longitude',
            latPropName: 'Latitude'
          }
        }, {
          type: LAYER_TYPES.tiles3d,
          assetId: 68881,
          label: t('cross_section_label'),
          layer: 'cross_section',
          opacity: DEFAULT_LAYER_OPACITY,
          visible: true,
          displayed: true,
          pickable: true
        },
      ]
    },
  ]
};

const geo_energy = {
  label: t('geo_energy_label'),
  children: [
    {
      label: t('geothermal_energy_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 69922,
          label: t('temperature_model_label'),
          layer: 'temperature_model',
          opacityDisabled: true
        }
      ]
    },
  ]
};

const natural_hazard = {
  label: t('natural_hazard_label'),
  children: [
    {
      type: LAYER_TYPES.earthquakes,
      label: t('earthquakes_label'),
      layer: 'earthquakes',
      visible: true,
      displayed: true,
      opacity: DEFAULT_LAYER_OPACITY
    },
  ]
};

const subsurface = {
  label: t('subsurface_label'),
  children: [
    {
      label: t('bedrock_surface_sediments_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 76814,
          label: t('top_bedrock_label'),
          layer: 'top_bedrock',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 76931,
          label: t('top_lower_freshwater_molasse_label'),
          layer: 'top_lower_freshwater_molasse',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 76815,
          label: t('base_cenozoic_label'),
          layer: 'base_cenozoic',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 76817,
          label: t('top_dogger_label'),
          layer: 'top_dogger',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 76816,
          label: t('base_mesozoic_label'),
          layer: 'base_mesozoic',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true
        },
      ]
    },
  ]
};

const man_made_objects = {
  label: t('man_made_objects_label'),
  children: [{
      type: LAYER_TYPES.tiles3d,
      assetId: 77319,
      style: TUNNEL_STYLE,
      label: t('tunnel_label'),
      layer: 'tunnel',
      pickable: true,
      opacityDisabled: true
    },
  ]
};

const background = {
  label: t('background_label'),
  children: [
    {
      type: LAYER_TYPES.tiles3d,
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json',
      label: t('swissnames_label'),
      style: SWISSTOPO_LABEL_STYLE,
      layer: 'ch.swisstopo.swissnames3d.3d',
      opacity: DEFAULT_LAYER_OPACITY
    },
    man_made_objects,
  ]
};


// A "displayed" layer appears in the list of active layers.
// A "visible" layer is actually shown on the globe.
// Normally, visible => displayed
export const defaultLayerTree = [
  geo_map_series,
  geo_base,
  geo_energy,
  natural_hazard,
  subsurface,
  background,
];
