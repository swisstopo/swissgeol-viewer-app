import {SWISSTOPO_LABEL_STYLE, LAS_POINT_CLOUD_STYLE} from '../constants.js';

const t = a => a;
export const layerCategories = [
  {
    label: t('geological_map_series_label'),
    id: 1786
  },
  {
    label: t('geological_maps_label'),
    id: 1787,
    parent: 1786
  },
  {
    label: t('geological_bases_label'),
    id: 1802
  },
  {
    label: t('borehole_data_profiles_label'),
    id: 15031,
    parent: 1802
  },
  {
    label: t('geo_energy_label'),
    id: 15070
  },
  {
    label: t('geothermal_energy_label'),
    id: 1826,
    parent: 15070
  },
  {
    label: t('natural_hazard_label'),
    id: 1858
  },
  {
    label: t('subsurface_label'),
    id: 1855
  },
  {
    label: t('bedrock_surface_sediments_label'),
    id: 1856,
    parent: 1855
  },
  {
    label: t('background_label'),
    id: 1890
  },
  {
    label: t('altitudes_label'),
    id: 1901,
    parent: 1890
  },
  {
    label: t('man_made_objects_label'),
    id: 1234, // random number
    parent: 1890
  }

];

export const layersConfig = [{
  type: 'swisstopoWMTS',
  label: t('ch_swisstopo_geologie_geocover'),
  layer: 'ch.swisstopo.geologie-geocover',
  visible: true,
  opacity: 0.7,
  parent: 1787
}, {
  type: '3dtiles',
  url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json',
  label: t('swissnames_label'),
  style: SWISSTOPO_LABEL_STYLE,
  visible: false,
  layer: 'ch.swisstopo.swissnames3d.3d',
  parent: 1890
}, {
  type: '3dtiles',
  assetId: 68857,
  label: t('boreholes_label'),
  layer: 'boreholes',
  parent: 15031
}, {
  parent: 1856,
  type: '3dtiles',
  assetId: 68722,
  label: t('base_mesozoic_label'),
  layer: 'base_mesozoic'
}, {
  type: '3dtiles',
  assetId: 68881,
  label: t('cross_section_label'),
  layer: 'cross_section',
  parent: 15031
}, {
  parent: 1858,
  type: 'earthquakes',
  label: t('earthquakes_label'),
  layer: 'earthquakes'
}, {
  parent: 1826,
  type: '3dtiles',
  style: LAS_POINT_CLOUD_STYLE,
  assetId: 69922,
  label: t('temperature_model_label'),
  layer: 'temperature_model'
}];

//   type: 'ionGeoJSON',
//   assetId: 56810,
//   label: t('tin_of_geological_layer'),
//   visible: false,
//   opacity: 0.8,
// }, {
//   type: 'swisstopoWMTS',
//   label: t('ch.swisstopo.swisstlm3d-wanderwege'),
//   layer: 'ch.swisstopo.swisstlm3d-wanderwege',
//   visible: false,
//   opacity: 0.7,
// }, {
//   type: '3dtiles',
//   assetId: 56812,
//   label: t('tunnel'),
//   visible: false,
//   opacity: 1,
