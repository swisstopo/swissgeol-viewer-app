import {SWISSTOPO_LABEL_STYLE} from '../constants';

export const layerCategories = [
  {
    label: 'Geological map series',
    id: 1786
  },
  {
    label: 'Geological maps',
    id: 1787,
    parent: 1786
  },
  {
    label: 'Geological bases',
    id: 1802
  },
  {
    label: 'Borehole data / Profiles',
    id: 15031,
    parent: 1802
  },
  {
    label: 'Geo-energy',
    id: 15070
  },
  {
    label: 'Geothermal energy',
    id: 1826,
    parent: 15070
  },
  {
    label: 'Natural hazards',
    id: 1858
  },
  {
    label: 'Subsurface geometry',
    id: 1855
  },
  {
    label: 'Bedrock surface / sediments',
    id: 1856,
    parent: 1855
  },
  {
    label: 'Background data',
    id: 1890
  },
  {
    label: 'Altitudes',
    id: 1901,
    parent: 1890
  },
  {
    label: 'Man-made objects',
    id: 1234, // random number
    parent: 1890
  }

];

const t = a => a;
export const layersConfig = [{
  type: 'swisstopoWMTS',
  label: t('ch_swisstopo_geologie_geocover'),
  layer: 'ch.swisstopo.geologie-geocover',
  visible: true,
  opacity: 0.7,
  parent: 1799
}, {
  type: '3dtiles',
  url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json',
  label: t('swissnames_label'),
  style: SWISSTOPO_LABEL_STYLE,
  visible: false,
  layer: 'ch.swisstopo.swissnames3d.3d'
}, {
  type: 'ion3dtiles',
  assetId: 68857,
  label: t('boreholes_label'),
  layer: 'boreholes', // TODO change to actual
  parent: 15031
}, {
  parent: 1856,
  type: 'ion3dtiles',
  assetId: 68722,
  label: t('base_mesozoic_label'),
  layer: 'base_mesozoic' // TODO change to actual
}, {
  type: 'ion3dtiles',
  assetId: 68881,
  label: t('cross_section_label'),
  layer: 'cross_section', // TODO change to actual
  parent: 15031
}, { // TODO parent?
  type: 'ion3dtiles',
  assetId: 69310,
  label: t('SG_test7_cesiumZip_noFanout'),
  layer: 'SG_test7_cesiumZip_noFanout' // TODO change to actual
}, {
  parent: 1858,
  type: 'earthquakes',
  label: t('earthquakes_label'),
  layer: 'earthquakes' // TODO change to actual
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
//   type: 'ion3dtiles',
//   assetId: 56812,
//   label: t('tunnel'),
//   visible: false,
//   opacity: 1,
