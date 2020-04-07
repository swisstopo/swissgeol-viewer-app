import {getMapParam, syncMapParam} from './permalink.js';

export default class MapChooser {
  constructor(viewer, config) {
    this.viewer = viewer;
    this.config = config;
    this.selectedMap = this.getInitialMap();

    this.mapChooser = document.querySelector('ngm-map-chooser');
    this.mapChooser.choices = this.config;
    this.mapChooser.active = this.selectedMap;
    this.mapChooser.addEventListener('change', (event) => this.selectMap(event.detail.active));
  }

  getInitialMap() {
    const mapId = getMapParam();
    const linkMap = this.config.find(map => map.id === mapId);
    const defaultMap = this.config.find(map => map.layer.show) || this.config[0];
    if (linkMap) {
      defaultMap.layer.show = false;
      linkMap.layer.show = true;
      return linkMap;
    }
    defaultMap.layer.show = true;
    return defaultMap;
  }

  selectMap(active) {
    const mapConfig = this.config.find(map => map.id === active.id);
    this.selectedMap.layer.show = false;
    mapConfig.layer.show = true;
    this.selectedMap = mapConfig;
    this.viewer.scene.requestRender();
    syncMapParam(mapConfig.id);
  }


}
