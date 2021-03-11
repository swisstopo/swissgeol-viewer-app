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
      this.mapChooser.choices = this.choices;
    });
  }

  initMapChooser(element) {
    this.mapChooser = element;
    this.mapChooser.choices = this.choices;
    this.mapChooser.active = this.selectedMap;
    this.mapChooser.addEventListener('change', (event) => this.selectMap(event.detail.active.id));
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
    this.mapChooser.active = mapConfig;
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
