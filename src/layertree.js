export const LAYER_TYPES = {
  swisstopoWMTS: 'swisstopoWMTS',
  tiles3d: '3dtiles',
  ionGeoJSON: 'ionGeoJSON',
  earthquakes: 'earthquakes',
};

export const DEFAULT_LAYER_TRANSPARENCY = 0;

const LAS_POINT_CLOUD_STYLE = {
  pointSize: 5
};

const SWISSTOPO_LABEL_STYLE = {
  labelStyle: 0, //LabelStyle.FILL,
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

const TUNNEL_STYLE = {
  color: {
    conditions: [
      ['${TunnelType} === "RailTunnel"', 'color("red")'],
      ['${TunnelType} === "RoadTunnel"', 'color("blue")']
    ]
  }
};

const DOWNLOAD_PROP_ORDER = ['Download Move', 'Download GoCad', 'Download DXF', 'Download ASCII', 'Download All data'];
const CENOZOIC_BEDROCK_ORDER = ['Name', 'Horizon', ...DOWNLOAD_PROP_ORDER];
const CONSOLIDATED_ORDER = ['Name', 'Horizon', 'HARMOS-ORIGINAL', ...DOWNLOAD_PROP_ORDER];
const FAULTS_ORDER = ['Name', 'Source', 'Status', 'Type', 'Version', ...DOWNLOAD_PROP_ORDER];

const t = a => a;
const geo_map_series = {
  label: t('lyr_geological_map_series_label'),
  children: [
    {
      label: t('lyr_geological_maps_label'),
      children: [
        {
          type: LAYER_TYPES.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_geocover_label'),
          layer: 'ch.swisstopo.geologie-geocover',
          visible: true,
          displayed: true,
          transparency: 0.3,
          // }, {
          //   type: LAYER_TYPES.swisstopoWMTS,
          //   label: t('ch.swisstopo.pixelkarte-farbe'),
          //   layer: 'ch.swisstopo.pixelkarte-farbe',
          //   visible: true,
          //   displayed: true,
          //   transparency DEFAULT_LAYER_OPACITY,
          // }, {
          //   type: LAYER_TYPES.swisstopoWMTS,
          //   label: t('ch.swisstopo.swisstlm3d-wanderwege'),
          //   layer: 'ch.swisstopo.swisstlm3d-wanderwege',
          //   visible: true,
          //   displayed: true,
          //   transparency DEFAULT_LAYER_OPACITY,
        },
      ]
    },
  ]
};
const geo_base = {
  label: t('lyr_geological_bases_label'),
  children: [
    {
      label: t('lyr_boreholes_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 105125,
          label: t('lyr_boreholes_public_label'),
          layer: 'boreholes',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          visible: false,
          displayed: true,
          propsOrder: ['XCOORD', 'YCOORD', 'ZCOORDB', 'ORIGNAME', 'NAMEPUB', 'SHORTNAME', 'BOHRTYP', 'GRUND',
            'RESTRICTIO', 'TIEFEMD', 'DEPTHFROM', 'DEPTHTO', 'LAYERDESC', 'ORIGGEOL', 'LITHOLOGY', 'LITHOSTRAT',
            'CHRONOSTR', 'TECTO', 'USCS1', 'USCS2', 'USCS3']
        },
      ]
    },
    {
      label: t('lyr_cross_section_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 68881,
          label: t('lyr_cross_section_ga25_label'),
          layer: 'cross_section',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          visible: false,
          displayed: true,
          pickable: true,
          zoomToBbox: true
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 124555,
          label: t('lyr_cross_section_geomol_label'),
          layer: 'cross_section_geomol',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          visible: false,
          displayed: false,
          pickable: true
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 99320,
          label: t('lyr_cross_section_geoquat_label'),
          layer: 'cross_section_geoquat',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          visible: false,
          displayed: false,
          pickable: true,
          zoomToBbox: true
        }
      ]
    }
  ]
};

const geo_energy = {
  label: t('lyr_geo_energy_label'),
  children: [
    {
      label: t('lyr_geothermal_energy_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 139225,
          label: t('lyr_temperature_model_label'),
          layer: 'temperature_model',
          transparencyDisabled: true,
          pickable: true
        }
      ]
    },
  ]
};

const natural_hazard = {
  label: t('lyr_natural_hazard_label'),
  children: [
    {
      type: LAYER_TYPES.earthquakes,
      label: t('lyr_earthquakes_label'),
      layer: 'earthquakes',
      visible: true,
      displayed: true,
      transparency: DEFAULT_LAYER_TRANSPARENCY
    },
  ]
};

const subsurface = {
  label: t('lyr_subsurface_label'),
  children: [
    {
      label: t('lyr_unconsolidated_rocks_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 109954,
          label: t('lyr_aare_valley_label'),
          layer: 'aare_valley',
          transparencyDisabled: true,
          pickable: true,
          zoomToBbox: true
        },
      ]
    },
    {
      label: t('lyr_top_bedrock_surface_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111882,
          label: t('lyr_top_bedrock_label'),
          layer: 'top_bedrock',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER
        },
      ]
    },
    {
      label: t('lyr_consolidated_rocks_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111880,
          label: t('lyr_top_omm_label'),
          layer: 'top_omm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111879,
          label: t('lyr_top_usm_label'),
          layer: 'top_usm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111888,
          label: t('lyr_top_umm_label'),
          layer: 'top_umm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111886,
          label: t('lyr_base_cenozoic_label'),
          layer: 'base_cenozoic',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111881,
          label: t('lyr_top_creatateus_label'),
          layer: 'top_creatateus',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111890,
          label: t('lyr_top_upper_malm_label'),
          layer: 'top_upper_malm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111889,
          label: t('lyr_top_lower_malm_label'),
          layer: 'top_lower_malm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111894,
          label: t('lyr_top_dogger_label'),
          layer: 'top_dogger',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111885,
          label: t('lyr_top_lias_label'),
          layer: 'top_lias',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 117460,
          label: t('lyr_top_keuper_label'),
          layer: 'top_keuper',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111893,
          label: t('lyr_top_muschelkalk_label'),
          layer: 'top_muschelkalk',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111883,
          label: t('lyr_base_mesozoic_label'),
          layer: 'base_mesozoic',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111891,
          label: t('lyr_base_cermocarboniferous'),
          layer: 'base_cermocarboniferous',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 111892,
          label: t('lyr_base_cermocarboniferous_supposed'),
          layer: 'base_cermocarboniferous_supposed',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER
        },
      ]
    },
    {
      label: t('lyr_fault_zones_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 114815,
          label: t('lyr_faults_geomol_label'),
          layer: 'faults_geomol',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: FAULTS_ORDER
        },
      ]
    },
  ]
};

const man_made_objects = {
  label: t('lyr_man_made_objects_label'),
  children: [
    {
      type: LAYER_TYPES.tiles3d,
      assetId: 96056,
      style: TUNNEL_STYLE,
      label: t('lyr_tunnel_label'),
      layer: 'tunnel',
      pickable: true,
      transparencyDisabled: true
    },
    {
      type: LAYER_TYPES.tiles3d,
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20190924/tileset.json',
      label: t('lyr_swiss_buildings_label'),
      layer: 'ch.swisstopo.swisstlm3d.3d',
      pickable: false,
      transparency: DEFAULT_LAYER_TRANSPARENCY
    }
  ]
};

const background = {
  label: t('lyr_background_label'),
  children: [
    {
      type: LAYER_TYPES.tiles3d,
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json',
      label: t('lyr_swissnames_label'),
      style: SWISSTOPO_LABEL_STYLE,
      layer: 'ch.swisstopo.swissnames3d.3d',
      transparencyDisabled: true // opacity not work with color conditions
    },
    man_made_objects,
  ]
};


// A "displayed" layer appears in the list of active layers.
// A "visible" layer is actually shown on the globe.
// Normally, visible => displayed
const defaultLayerTree = [
  geo_map_series,
  geo_base,
  geo_energy,
  natural_hazard,
  subsurface,
  background,
];

export default defaultLayerTree;
