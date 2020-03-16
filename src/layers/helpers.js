import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import IonResource from 'cesium/Core/IonResource.js';
import GeoJsonDataSource from 'cesium/DataSources/GeoJsonDataSource.js';
import Cesium3DTileset from 'cesium/Scene/Cesium3DTileset.js';
import Cesium3DTileStyle from 'cesium/Scene/Cesium3DTileStyle.js';
import {getSwisstopoImagery} from '../swisstopoImagery.js';

export function createEarthquakeFromConfig(viewer, config) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer);
  if (config.visible) {
    earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = visible => earthquakeVisualizer.setVisible(visible);
  config.setOpacity = opacity => earthquakeVisualizer.setOpacity(opacity);
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
    show: !!config.visible
  });
  if (config.style) {
    tileset.style = new Cesium3DTileStyle(config.style);
  }
  tileset.pickable = config.pickable !== undefined ? config.pickable : false;
  viewer.scene.primitives.add(tileset);

  config.setVisibility = visible => tileset.show = !!visible;
  if (!config.opacityDisabled) {
    config.setOpacity = opacity => {
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
  }

  return tileset;
}

export function createSwisstopoWMTSImageryLayer(viewer, config) {
  let layer = null;
  config.setVisibility = visible => layer.show = !!visible;
  config.setOpacity = opacity => layer.alpha = opacity;
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
    layer.alpha = config.opacity || 1;
    layer.show = !!config.visible;
    return layer;
  });
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
