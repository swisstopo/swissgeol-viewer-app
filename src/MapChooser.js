import {getMapParam, syncMapParam} from './permalink.js';
import i18next from 'i18next';

export default class MapChooser {

  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   * @param {Array<import('./viewer').BaseLayerConfig>} config
   */
  constructor(viewer, config) {
    this.viewer = viewer;
    this.config = config;
    this.selectedMap = this.getInitialMap();

    i18next.on('languageChanged', () => {
      this.element.choices = this.choices;
    });
  }

  initMapChooser(element) {
    this.element = element;
    this.element.choices = this.choices;
    this.element.active = this.selectedMap;
    this.element.addEventListener('change', (event) => this.selectMap(event.detail.active.id));
  }

  /**
   * @return {import('./viewer').BaseLayerConfig}
   */
  getInitialMap() {
    const mapId = getMapParam();
    const mapConfig = this.config.find(map => map.id === mapId);
    if (mapConfig) {
      return mapConfig;
    } else {
      return this.config.find(map => map.default === true) || this.config[0];
    }
  }

  /**
   * @param {string} active
   */
  selectMap(active) {
    const mapConfig = this.config.find(map => map.id === active);
    this.element.active = mapConfig;
    this.selectedMap.layers.forEach(layer => layer.show = false);
    mapConfig.layers.forEach(layer => layer.show = true);
    this.selectedMap = mapConfig;
    this.viewer.scene.requestRender();
    syncMapParam(mapConfig.id);
  }

  get choices() {
    return this.config.map(map => {
      const choice = {...map, labelKey: i18next.t(map.labelKey)};
      delete choice.layers;
      return choice;
    });
  }
}
