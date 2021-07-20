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

const DOWNLOAD_PROP_ORDER = ['Download Move', 'Download GoCad', 'Download DXF', 'Download ASCII', 'Download All data'];
const DOWNLOAD_ROOT_GEOMOL = 'https://download.swissgeol.ch/geomol/';
const DOWNLOAD_ROOT_VOXEL = 'https://download.swissgeol.ch/voxel/';
const CENOZOIC_BEDROCK_ORDER = ['Name', 'Horizon', ...DOWNLOAD_PROP_ORDER];
CENOZOIC_BEDROCK_ORDER.splice(6, 0, 'Download ESRI-GRID');
const CONSOLIDATED_ORDER = ['Name', 'Horizon', 'HARMOS-ORIGINAL', ...DOWNLOAD_PROP_ORDER];
const FAULTS_ORDER = ['Name', 'Source', 'Status', 'Type', 'Version', ...DOWNLOAD_PROP_ORDER];
const TEMPERATURE_HORIZON_ORDER = ['name', 'temp_c'];
const TEMPERATURE_HORIZON_BGL_ORDER = ['name', 'temp_c', 'depth_bgl'];
const EARTHQUAKES_PROP_ORDER = ['Time', 'Magnitude', 'Depthkm', 'EventLocationName', 'Details'];

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
          queryType: 'geoadmin',
          geocatId: '2467ab13-e794-4c13-8c55-59fe276398c5',
        },
        {
          type: LAYER_TYPES.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_geology_500_label'),
          layer: 'ch.swisstopo.geologie-geologische_karte',
          visible: false,
          displayed: false,
          transparency: 0.3,
          queryType: 'geoadmin',
          geocatId: 'ca917a71-dcc9-44b6-8804-823c694be516',
        },
        {
          type: LAYER_TYPES.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_tectonics_500_label'),
          layer: 'ch.swisstopo.geologie-tektonische_karte',
          visible: false,
          displayed: false,
          transparency: 0.3,
          queryType: 'geoadmin',
          geocatId: 'a4cdef47-505e-41ab-b6a7-ad5b92d80e41',
        },
        {
          type: LAYER_TYPES.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_last_iceage_max_map500_label'),
          layer: 'ch.swisstopo.geologie-eiszeit-lgm-raster',
          visible: false,
          displayed: false,
          transparency: 0.3,
          noQuery: true,
          geocatId: 'f1455593-7571-48b0-8603-307ec59a6702',
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
          assetId: 287568,
          label: t('lyr_boreholes_public_label'),
          layer: 'boreholes',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          visible: false,
          displayed: true,
          downloadDataType: 'csv',
          downloadDataPath: 'https://download.swissgeol.ch/boreholes/bh_open_20210201_00.csv',
          propsOrder: ['bh_pub_XCOORD', 'bh_pub_YCOORD', 'bh_pub_ZCOORDB', 'bh_pub_ORIGNAME', 'bh_pub_NAMEPUB',
            'bh_pub_SHORTNAME', 'bh_pub_BOHREDAT', 'bh_pub_BOHRTYP', 'bh_pub_GRUND', 'bh_pub_RESTRICTIO',
            'bh_pub_TIEFEMD', 'bh_pub_DEPTHFROM', 'bh_pub_DEPTHTO', 'bh_pub_LAYERDESC', 'bh_pub_ORIGGEOL',
            'bh_pub_LITHOLOGY', 'bh_pub_LITHOSTRAT', 'bh_pub_CHRONOSTR', 'bh_pub_TECTO', 'bh_pub_USCS1',
            'bh_pub_USCS2', 'bh_pub_USCS3'],
          geocatId: '3996dfad-69dd-418f-a4e6-5f32b96c760a',
        },
        {
          type: LAYER_TYPES.tiles3d,
          label: t('lyr_boreholes_private_label'),
          layer: 'boreholes_authenticated',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          visible: false,
          displayed: false,
          restricted: 'ngm-prod-privileged', // the group required to see this layer
          aws_s3_bucket: 'ngm-protected-prod',
          aws_s3_key: 'tiles/bh_private_20210201_00/tileset.json',
        },
      ]
    },
    {
      label: t('lyr_cross_section_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 376868,
          label: t('lyr_cross_section_ga25_pixel_label'),
          layer: 'cross_section_ga25_pixel',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          backgroundId: 'lakes_rivers_map',
          visible: false,
          displayed: false,
          pickable: true,
          zoomToBbox: true,
          propsOrder: ['CSGA25Px_No', 'CSGA25Px_Name', 'CSGA25Px_Pub', 'CSGA25Px_Author', 'CSGA25Px_Plate_No',
            'CSGA25Px_Section_No', 'CSGA25Px_Sec_Type', 'CSGA25Px_Scale', 'CSGA25Px_Vert_Exag', 'CSGA25Px_Link_Orig',
            'CSGA25Px_Link_Shp'],
          geocatId: '97197401-6019-49b0-91d6-eaf35d57529c',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 68881,
          label: t('lyr_cross_section_ga25_label'),
          layer: 'cross_section',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          visible: false,
          displayed: true,
          pickable: true,
          zoomToBbox: true,
          geocatId: 'd1912e80-59c8-4dc5-a1f2-67c42d2ff473',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 452436,
          label: t('lyr_cross_section_geomol_label'),
          layer: 'cross_section_geomol',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          visible: false,
          displayed: false,
          pickable: true,
          geocatId: '2cec200c-a47b-4934-8dc1-62c19c39a3dd',
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Cross-Sections.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 472446,
          label: t('lyr_cross_section_geoquat_label'),
          layer: 'cross_section_geoquat',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          visible: false,
          displayed: false,
          pickable: true,
          zoomToBbox: true,
          propsOrder: ['CS-AAT-Cross-section', 'CS-AAT-Lithostratigraphy', 'CS-AAT-Type', 'CS-AAT-Legend', 'CS-AAT-Report'],
          geocatId: 'ab34eb52-30c4-4b69-840b-ef41f47f9e9a',
        }
      ]
    },
//    {
//      label: t('lyr_geophysics_label'),
//      children: [
//        {
//          type: LAYER_TYPES.tiles3d,
//          assetId: 249376,
//          label: t('lyr_seismic_transects_label'),
//          layer: 'seismic_transects',
//          transparency: DEFAULT_LAYER_TRANSPARENCY,
//          backgroundId: 'lakes_rivers_map',
//          pickable: true,
//          visible: false,
//          displayed: false,
//          propsOrder: ['Line', 'Owner', 'Public', 'SRD', 'AcqYear', 'Length', 'data_link'],
//          geocatId: '62f8d10b-f65b-4902-967e-bd4f972b56e9',
//        },
//      ]
//    }
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
          pickable: false,
          geocatId: '63ed59b1-d9fb-4c6e-a629-550c8f6b9bf2',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251747,
          label: t('lyr_temperature_horizon_tomm_label'),
          layer: 'temperature_horizon_tomm',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '4f9e3f59-891e-434b-bba5-40db1b9495e0',
          legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omm',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251782,
          label: t('lyr_temperature_horizon_tuma_label'),
          layer: 'temperature_horizon_tuma',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '613cdc6f-0237-416d-af16-ae5d2f1934ff',
          legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omalm',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251781,
          label: t('lyr_temperature_horizon_tmus_label'),
          layer: 'temperature_horizon_tmus',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: 'e0be0de5-4ed0-488a-a952-5eb385fd5595',
          legend: 'ch.swisstopo.geologie-geomol-temperatur_top_muschelkalk',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251756,
          label: t('lyr_temperature_500_bgl_label'),
          layer: 'temperature_500_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '08e66941-4ebb-4017-8018-b39caa8fd107',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_500',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251788,
          label: t('lyr_temperature_1000_bgl_label'),
          layer: 'temperature_1000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '5e32ea72-a356-4250-b40a-a441165fd936',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1000',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251790,
          label: t('lyr_temperature_1500_bgl_label'),
          layer: 'temperature_1500_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '162989d7-5c1c-48fb-8d16-2ccf5be339b9',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1500',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251786,
          label: t('lyr_temperature_2000_bgl_label'),
          layer: 'temperature_2000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: 'ac604460-7a7a-44c5-bc5a-41062fbd21ff',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_2000',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251785,
          label: t('lyr_temperature_3000_bgl_label'),
          layer: 'temperature_3000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '47f79661-212e-4297-b048-2606db7affa8',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_3000',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251789,
          label: t('lyr_temperature_4000_bgl_label'),
          layer: 'temperature_4000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '739e9095-77f6-462d-9a1e-438898cf0c9c',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_4000',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251755,
          label: t('lyr_temperature_isotherm_60c_label'),
          layer: 'temperature_isotherm_60c',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '6edca35d-0f08-43b9-9faf-4c7b207888a1',
          legend: 'ch.swisstopo.geologie-geomol-isotherme_60',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251787,
          label: t('lyr_temperature_isotherm_100c_label'),
          layer: 'temperature_isotherm_100c',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '8681fb45-6220-41ef-825a-86210d8a72fc',
          legend: 'ch.swisstopo.geologie-geomol-isotherme_100',
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 251783,
          label: t('lyr_temperature_isotherm_150c_label'),
          layer: 'temperature_isotherm_150c',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '31dc428e-a62b-4f6b-a263-e5eca9d9a074',
          legend: 'ch.swisstopo.geologie-geomol-isotherme_150',
        },
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
      visible: false,
      displayed: true,
      transparency: DEFAULT_LAYER_TRANSPARENCY,
      propsOrder: EARTHQUAKES_PROP_ORDER,
      downloadUrl: 'https://download.swissgeol.ch/earthquakes/earthquakes_last_90d.txt',
      detailsUrl: 'http://www.seismo.ethz.ch/en/earthquakes/switzerland/last-90-days',
    },
    {
      type: LAYER_TYPES.earthquakes,
      label: t('lyr_historical_earthquakes_label'),
      layer: 'historical_earthquakes',
      visible: false,
      displayed: false,
      transparency: DEFAULT_LAYER_TRANSPARENCY,
      propsOrder: EARTHQUAKES_PROP_ORDER,
      downloadUrl: 'https://download.swissgeol.ch/earthquakes/earthquakes_magnitude_gt_3.txt',
      detailsUrl: 'http://www.seismo.ethz.ch',
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
          assetId: 474235,
          label: t('lyr_voxel_aaretal_litho_label'),
          layer: 'voxel_aaretal_litho',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Aaretal-Legende.pdf',
        },
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 474238,
          label: t('lyr_voxel_aaretal_logk_label'),
          layer: 'voxel_aaretal_logk',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Aaretal-Legende.pdf',
        },
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 474233,
          label: t('lyr_voxel_birrfeld_litho_label'),
          layer: 'voxel_birrfeld_litho',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Birrfeld-Legende.pdf',
        },
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 474239,
          label: t('lyr_voxel_birrfeld_logk_label'),
          layer: 'voxel_birrfeld_logk',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Birrfeld-Legende.pdf',
        },
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 474234,
          label: t('lyr_voxel_geneva_litho_label'),
          layer: 'voxel_geneva_litho',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-GVA-Legende.pdf',
        },
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 474237,
          label: t('lyr_voxel_geneva_logk_label'),
          layer: 'voxel_geneva_logk',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-GVA-Legende.pdf',
        },
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 474231,
          label: t('lyr_voxel_visp_litho_label'),
          layer: 'voxel_visp_litho',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Visp-Legende.pdf',
        },
        {
          type: LAYER_TYPES.tiles3d,
          style: LAS_POINT_CLOUD_STYLE,
          assetId: 474240,
          label: t('lyr_voxel_visp_logk_label'),
          layer: 'voxel_visp_logk',
          transparencyDisabled: true,
          pickable: false,
          zoomToBbox: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Visp-Legende.pdf',
        },
      ]
    },
    {
      label: t('lyr_top_bedrock_surface_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267898,
          label: t('lyr_top_bedrock_label'),
          layer: 'top_bedrock',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Bedrock.zip',
          geocatId: '133b54a9-60d1-481c-85e8-e1a222d6ac3f',
        },
      ]
    },
    {
      label: t('lyr_consolidated_rocks_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267959,
          label: t('lyr_top_omm_label'),
          layer: 'top_omm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-UpperMarineMolasse.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267961,
          label: t('lyr_top_usm_label'),
          layer: 'top_usm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerFreshwaterMolasse.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267966,
          label: t('lyr_top_umm_label'),
          layer: 'top_umm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerMarineMolasse.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267954,
          label: t('lyr_base_cenozoic_label'),
          layer: 'base_cenozoic',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Base-Cenozoic.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267958,
          label: t('lyr_top_cretaceous_label'),
          layer: 'top_cretaceous',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Cretaceous.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267962,
          label: t('lyr_top_upper_malm_label'),
          layer: 'top_upper_malm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-UpperMalm.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267963,
          label: t('lyr_top_lower_malm_label'),
          layer: 'top_lower_malm',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerMalm.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267957,
          label: t('lyr_top_dogger_label'),
          layer: 'top_dogger',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Dogger.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267899,
          label: t('lyr_top_lias_label'),
          layer: 'top_lias',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Lias.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267960,
          label: t('lyr_top_keuper_label'),
          layer: 'top_keuper',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Keuper.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267953,
          label: t('lyr_top_muschelkalk_label'),
          layer: 'top_muschelkalk',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Muschelkalk.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267952,
          label: t('lyr_base_mesozoic_label'),
          layer: 'base_mesozoic',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Base-Mesozoic.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267965,
          label: t('lyr_base_permocarboniferous'),
          layer: 'base_permocarboniferous',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Permocarboniferous.zip'
        },
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267964,
          label: t('lyr_base_permocarboniferous_supposed'),
          layer: 'base_permocarboniferous_supposed',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Permocarboniferous-inferred.zip'
        },
      ]
    },
    {
      label: t('lyr_fault_zones_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 267872,
          label: t('lyr_faults_geomol_label'),
          layer: 'faults_geomol',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          propsOrder: FAULTS_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Faults.zip',
          downloadDataType: 'indexed_download',
          downloadDataPath: 'https://download.swissgeol.ch/Faults/footprints_boxed.geojson',
        },
      ]
    },
    {
      label: t('lyr_3d_model_label'),
      children: [
        {
          type: LAYER_TYPES.tiles3d,
          assetId: 493224,
          label: t('lyr_3d_model_berne_label'),
          layer: '3d_model_berne',
          transparency: DEFAULT_LAYER_TRANSPARENCY,
          pickable: true,
          zoomToBbox: true,
          propsOrder: ['3DBern-Unit', '3DBern-Link', '3DBern-Lithology', '3DBern-TectonicUnit',
          '3DBern-ChronoB-T', '3DBern-OrigDesc', '3DBern-Version', '3DBern-Aothor', '3DBern-Purpose',
          '3DBern-Download'],
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
      assetId: 244982,
      label: t('lyr_road_tunnel_label'),
      layer: 'road_tunnel',
      pickable: true,
      transparencyDisabled: true,
      geocatId: '752146b4-7fd4-4621-8cf8-fdb19f5335a5',
    },
    {
      type: LAYER_TYPES.tiles3d,
      assetId: 244984,
      label: t('lyr_rail_tunnel_label'),
      layer: 'rail_tunnel',
      pickable: true,
      transparencyDisabled: true,
      geocatId: '4897848c-3777-4636-9c7e-16ef91c723f6',
    },
    {
      type: LAYER_TYPES.tiles3d,
      assetId: 244985,
      label: t('lyr_water_tunnel_label'),
      layer: 'water_tunnel',
      pickable: true,
      transparencyDisabled: true,
      geocatId: '71ee97cb-91f8-427d-b217-f293a0a9760a',
    },
    {
      type: LAYER_TYPES.tiles3d,
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20190924/tileset.json',
      label: t('lyr_swiss_buildings_label'),
      layer: 'ch.swisstopo.swisstlm3d.3d',
      pickable: false,
      transparency: DEFAULT_LAYER_TRANSPARENCY,
      geocatId: '21c98c73-48da-408b-ab73-8f1ab9d5fbe4',
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
