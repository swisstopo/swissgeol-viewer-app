import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import IonResource from 'cesium/Core/IonResource.js';
import GeoJsonDataSource from 'cesium/DataSources/GeoJsonDataSource.js';
import Cesium3DTileset from 'cesium/Scene/Cesium3DTileset.js';
import Cesium3DTileStyle from 'cesium/Scene/Cesium3DTileStyle.js';
import {getSwisstopoImagery} from '../swisstopoImagery.js';
import {LAYER_TYPES, BILLBOARDS_PREFIX} from '../constants.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import NearFarScalar from 'cesium/Core/NearFarScalar.js';
import VerticalOrigin from 'cesium/Scene/VerticalOrigin.js';
import {isLabelOutlineEnabled} from '../permalink.js';
import LabelStyle from 'cesium/Scene/LabelStyle.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Ellipsoid from 'cesium/Core/Ellipsoid.js';
import Matrix3 from 'cesium/Core/Matrix3.js';

export function createEarthquakeFromConfig(viewer, config) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer);
  if (config.visible) {
    earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = visible => earthquakeVisualizer.setVisible(visible);
  config.setTransparency = transparency => earthquakeVisualizer.setOpacity(1 - transparency);
  return earthquakeVisualizer;
}

export function createIonGeoJSONFromConfig(viewer, config) {
  return IonResource.fromAssetId(config.assetId)
    .then(resource => GeoJsonDataSource.load(resource))
    .then(dataSource => {
      viewer.dataSources.add(dataSource);
      dataSource.show = !!config.visible;
      config.setVisibility = visible => dataSource.show = !!visible;
      return dataSource;
    });
}

export function create3DTilesetFromConfig(viewer, config) {
  const tileset = new Cesium3DTileset({
    url: config.url ? config.url : IonResource.fromAssetId(config.assetId),
    show: !!config.visible,
    maximumScreenSpaceError: 0 // required for billboards render
  });

  if (config.style) {
    if (config.layer === 'ch.swisstopo.swissnames3d.3d') { // for performance testing
      config.style.labelStyle = isLabelOutlineEnabled() ? LabelStyle.FILL_AND_OUTLINE : LabelStyle.FILL;
    }
    tileset.style = new Cesium3DTileStyle(config.style);
  }
  tileset.pickable = config.pickable !== undefined ? config.pickable : false;
  viewer.scene.primitives.add(tileset);

  config.setVisibility = visible => {
    tileset.show = !!visible;
    const dataSource = viewer.dataSources.getByName(getBillboardDataSourceName(config.layer)); // Check for billboards
    if (dataSource.length) {
      dataSource[0].show = !!visible;
    }
  };

  if (!config.transparencyDisabled) {
    config.setTransparency = transparency => {
      const opacity = 1 - transparency;
      const style = config.style;
      if (style && (style.color || style.labelColor)) {
        const {propertyName, colorType, colorValue} = styleColorParser(style);
        const color = `${colorType}(${colorValue}, ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, [propertyName]: color});
      } else {
        const color = `color("white", ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, color});
      }
    };
    config.setTransparency(!isNaN(config.transparency) ? config.transparency : 0);
  }

  if (config.billboards && config.billboards.latPropName && config.billboards.lonPropName) {
    addBillboardsForTileset(viewer, tileset, config);
  }

  return tileset;
}

export function createSwisstopoWMTSImageryLayer(viewer, config) {
  let layer = null;
  config.setVisibility = visible => layer.show = !!visible;
  config.setTransparency = transparency => layer.alpha = 1 - transparency;
  config.remove = () => viewer.scene.imageryLayers.remove(layer, false);
  config.add = (toIndex) => {
    const layersLength = viewer.scene.imageryLayers.length;
    if (toIndex > 0 && toIndex < layersLength) {
      const imageryIndex = layersLength - toIndex;
      viewer.scene.imageryLayers.add(layer, imageryIndex);
      return;
    }
    viewer.scene.imageryLayers.add(layer);
  };

  return getSwisstopoImagery(config.layer).then(l => {
    layer = l;
    viewer.scene.imageryLayers.add(layer);
    layer.alpha = 1 - config.transparency || 0;
    layer.show = !!config.visible;
    return layer;
  });
}


export function createCesiumObject(viewer, config) {
  const factories = {
    [LAYER_TYPES.ionGeoJSON]: createIonGeoJSONFromConfig,
    [LAYER_TYPES.tiles3d]: create3DTilesetFromConfig,
    [LAYER_TYPES.swisstopoWMTS]: createSwisstopoWMTSImageryLayer,
    [LAYER_TYPES.earthquakes]: createEarthquakeFromConfig,
  };
  return factories[config.type](viewer, config);
}

function styleColorParser(style) {
  const propertyName = style.color ? 'color' : 'labelColor';
  let colorType = style[propertyName].slice(0, style[propertyName].indexOf('('));
  const lastIndex = colorType === 'rgba' ? style[propertyName].lastIndexOf(',') : style[propertyName].indexOf(')');
  const colorValue = style[propertyName].slice(style[propertyName].indexOf('(') + 1, lastIndex);
  colorType = colorType === 'rgb' ? 'rgba' : colorType;
  return {propertyName, colorType, colorValue};
}


/**
 * To avoid incorrect handling of checkboxes during render
 * @param layers
 */
export function syncCheckboxes(layers) {
  layers.forEach(l => {
    const elements = document.getElementsByName(l.layer);
    for (let i = 0; i < elements.length; i++) {
      elements[i].checked = l.visible;
    }
  });
}

/**
 * Adds on terrain billboards for tileset based on longitude and latitude properties
 * @param viewer
 * @param tileset
 * @param config
 */
function addBillboardsForTileset(viewer, tileset, config) {
  const dataSourceName = getBillboardDataSourceName(config.layer);
  viewer.dataSources.add(new CustomDataSource(dataSourceName));

  tileset.tileLoad.addEventListener(tile => {
    for (let i = 0; i < tile.content.featuresLength; i++) {
      const feature = tile.content.getFeature(i);
      const longitude = feature.getProperty(config.billboards.lonPropName);
      const latitude = feature.getProperty(config.billboards.latPropName);
      const position = new Cartographic(longitude, latitude, 20);

      const dataSource = viewer.dataSources.getByName(dataSourceName)[0];
      dataSource.entities.add({
        position: Cartographic.toCartesian(position),
        billboard: {
          image: './src/images/map-pin-solid.svg',
          scale: 0.1,
          translucencyByDistance: new NearFarScalar(6000, 0.9, 60000, 0.1),
          verticalOrigin: VerticalOrigin.BOTTOM,
          heightReference: HeightReference.RELATIVE_TO_GROUND
        }
      });
    }
  });
}

function getBillboardDataSourceName(layer) {
  return `${BILLBOARDS_PREFIX}${layer}`;
}

/**
 * Returns box sizes
 * @param rectangle
 * @param height
 * @param result
 * @returns {Cartesian3}
 */
export function getBoxFromRectangle(rectangle, height, result = new Cartesian3()) {
  const sw = Cartographic.toCartesian(Rectangle.southwest(rectangle, new Cartographic()));
  const se = Cartographic.toCartesian(Rectangle.southeast(rectangle, new Cartographic()));
  const nw = Cartographic.toCartesian(Rectangle.northwest(rectangle, new Cartographic()));
  result.x = Cartesian3.distance(sw, se); // gets box width
  result.y = Cartesian3.distance(sw, nw); // gets box length
  result.z = height;
  return result;
}

/**
 * Returns rectangle from width height and center point
 * @param width
 * @param height
 * @param center
 * @param result
 * @returns {Rectangle}
 */
export function calculateRectangle(width, height, center, result = new Rectangle()) {
  const w = new Cartesian3(center.x, center.y - width / 2, center.z);
  result.west = Ellipsoid.WGS84.cartesianToCartographic(w).longitude;
  const s = new Cartesian3(center.x + height / 2, center.y, center.z);
  result.south = Ellipsoid.WGS84.cartesianToCartographic(s).latitude;
  const e = new Cartesian3(center.x, center.y + width / 2, center.z);
  result.east = Ellipsoid.WGS84.cartesianToCartographic(e).longitude;
  const n = new Cartesian3(center.x - height / 2, center.y, center.z);
  result.north = Ellipsoid.WGS84.cartesianToCartographic(n).latitude;

  return result;
}

/**
 * Calculates box from bounding volume
 * @param {Matrix3} halfAxes
 * @param {Number} boundingSphereRadius
 * @param {Cartesian3} result
 * @returns {Cartesian3|Cartesian3}
 */
export function calculateBox(halfAxes, boundingSphereRadius, result = new Cartesian3()) {
  const absMatrix = Matrix3.abs(halfAxes, new Matrix3());
  for (let i = 0; i < 3; i++) {
    const column = Matrix3.getColumn(absMatrix, i, new Cartesian3());
    const row = Matrix3.getRow(absMatrix, i, new Cartesian3());
    result.y = result.y + column.x + row.x;
    result.x = result.x + column.y + row.y;
    result.z = result.z + column.z + row.z;
  }
  // scale according to bounding sphere
  const diagonal = Math.sqrt(result.x * result.x + result.y * result.y);
  const radius = boundingSphereRadius;
  const scale = Math.max(diagonal / (radius * 2), (radius * 2) / diagonal);
  result.x = result.x * scale;
  result.y = result.y * scale;
  result.z = result.z > 60000 ? 60000 : result.z;

  return new Cartesian3(result.x, result.y, result.z);
}
