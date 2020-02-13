import '@geoblocks/ga-search';

import {getLayersConfig, containsSwisstopoImagery, getSwisstopoImagery} from './swisstopoImagery.js';

import Rectangle from 'cesium/Core/Rectangle.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import Math from 'cesium/Core/Math.js';

/**
 * @param {import('cesium/Widgets/Viewer/Viewer').default} viewer
 * @param {HTMLElement} element
 */
export function setupSearch(viewer, element) {

  // search filter configuration
  getLayersConfig().then(layersConfig => {
    element.filterResults = result => {
      if (result.properties.origin === 'layer') {
        const layerConfig = layersConfig[result.properties.layer];
        return !!layerConfig && layerConfig.type === 'wmts';
      } else {
        return true;
      }
    };
  });

  element.renderResult = (result, label) => {
    const iconName = result.properties.origin === 'layer' ? 'layer group' : 'map pin';
    return `<i class="${iconName} grey icon"></i> ${label}`;
  };

  // location search result
  element.addEventListener('submit', event => {
    const result = event.detail.result;
    const origin = result.properties.origin;
    const rectangle = Rectangle.fromDegrees(...result.bbox);
    if (origin === 'layer') {
      // add layer
      getSwisstopoImagery(result.properties.layer, rectangle).then(imageryLayer => {
        if (!containsSwisstopoImagery(viewer.scene.imageryLayers, imageryLayer)) {
          viewer.scene.imageryLayers.add(imageryLayer);
        }
      });
    } else {
      // recenter to location
      if (rectangle.width < Math.EPSILON3 || rectangle.height < Math.EPSILON3) {
        // rectangle is too small
        const center = Rectangle.center(rectangle);
        center.height = 5000;
        viewer.camera.flyTo({
          destination: Cartographic.toCartesian(center)
        });
      } else {
        // rectangle
        viewer.camera.flyTo({
          destination: rectangle
        });
      }
    }
    event.target.autocomplete.input.blur();
  });

}
