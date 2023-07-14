import '@geoblocks/ga-search';

import {getLayersConfig} from './swisstopoImagery.js';
import {escapeRegExp} from './utils';

import {Cartographic, Math, Rectangle} from 'cesium';
import {extractEntitiesAttributes} from './query/objectInformation.ts';
import NavToolsStore from './store/navTools';
import defaultLayerTree from './layertree';
import i18next from 'i18next';
import auth from './store/auth';


/**
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 * @param {HTMLElement} element
 * @param layerTree
 */
export function setupSearch(viewer, element, layerTree) {

  // search filter configuration
  getLayersConfig().then(layersConfig => {
    element.filterResults = result => {
      if (result.properties && result.properties.origin === 'layer') {
        const layerConfig = layersConfig[result.properties.layer];
        return !!layerConfig && (layerConfig.type === 'wmts' || layerConfig.type === 'wms');
      } else {
        return true;
      }
    };
  });

  // add icon before the label in the result list
  element.renderResult = (result, label) => {
    let imgName;
    if (result.properties) {
      // from geoadmin
      imgName = result.properties.origin === 'layer' ? 'i_layer' : 'i_place';
    } else {
      imgName = 'i_extrusion';
    }
    // else {
    //   // from cesium entities
    //   iconName = 'cube'; // todo
    // }
    return `<img src='./images/${imgName}.svg' alt=""/> <b>${label}</b> `;
  };

  // location search result
  element.addEventListener('submit', event => {
    const result = event.detail.result;
    if (result.properties) {
      // from geoadmin
      const origin = result.properties.origin;
      const rectangle = Rectangle.fromDegrees(...result.bbox);
      if (origin === 'layer') {
        // add layer
        layerTree.addLayerFromSearch(result.properties);
      } else {
        NavToolsStore.hideTargetPoint();
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
    } else {
      NavToolsStore.hideTargetPoint();
      layerTree.addLayerFromSearch(result);
      if (result.entity) viewer.zoomTo(result.entity);
    }
    event.target.autocomplete.input.blur();
  });

  // search primitives
  element.additionalSource = {
    search: input => {
      const matches = [];
      const regexp = new RegExp(escapeRegExp(input), 'i');
      const dataSources = viewer.dataSources;
      for (let i = 0, ii = dataSources.length; i < ii; i++) {
        const dataSource = dataSources.get(i);
        dataSource.entities.values.forEach(entity => {
          const attributes = extractEntitiesAttributes(entity);
          if (attributes && regexp.test(attributes.EventLocationName)) {
            matches.push({
              entity: entity,
              label: `${attributes.EventLocationName} (${attributes.Magnitude})`,
              dataSourceName: dataSource.name
            });
          }
        });
      }

      // search catalog layers
      const user = auth.user.getValue();
      const addCatalogLayer = (layerTree) => {
        for (const layer of layerTree) {
          if (layer.children) {
            addCatalogLayer(layer.children);
          } else {
            if (regexp.test(layer.label)) {
              layer.label = `${i18next.t(layer.label)}`;
              if (!layer.restricted || user?.['cognito:groups'].includes(layer.restricted)) matches.push(layer);
            }
          }
      }};
      addCatalogLayer(defaultLayerTree);

      return Promise.resolve(matches);
    },
    getResultValue: result => result.label
  };

  const icon = element.querySelector('.ngm-search-icon-container');
  const input = element.querySelector('input');
  icon.addEventListener('click', () => {
    if (icon.classList.contains('ngm-search-icon')) return;
    input.value = '';
    icon.classList.remove('ngm-close-icon');
    icon.classList.add('ngm-search-icon');
  });
  input.addEventListener('input', evt => {
    if (evt.target.value && icon.classList.contains('ngm-search-icon')) {
      icon.classList.remove('ngm-search-icon');
      icon.classList.add('ngm-close-icon');
    } else if (!evt.target.value) {
      icon.classList.remove('ngm-close-icon');
      icon.classList.add('ngm-search-icon');
    }
  });

}
