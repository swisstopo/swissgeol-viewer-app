import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map.js';
import './ngm-map-chooser';
import {getMapOpacityParam, syncMapOpacityParam} from '../permalink';
import MainStore from '../store/main';
import Viewer from 'cesium/Source/Widgets/Viewer/Viewer';
import MapChooser from '../MapChooser.js';

@customElement('ngm-map-configuration')
export class NgmMapConfiguration extends LitElementI18n {
  @state() viewer: Viewer | null | undefined;
  @state() mapChooser: MapChooser | null | undefined;
  @state() opacity: number = getMapOpacityParam();
  @state() baseMapId = 'ch.swisstopo.pixelkarte-grau';

  constructor() {
    super();

    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    MainStore.mapChooser.subscribe(chooser => {
      this.mapChooser = chooser;
      this.requestUpdate();
    });
    MainStore.syncMap.subscribe(() => this.updateOpacity(getMapOpacityParam()));
  }

  updateOpacity(opacity: number) {
    this.opacity = opacity;
    if (this.opacity === 1) {
      this.viewer!.scene.globe.translucency.enabled = !!this.mapChooser!.selectedMap.hasAlphaChannel;
      this.viewer!.scene.globe.translucency.backFaceAlpha = 1;
    } else {
      this.viewer!.scene.globe.translucency.backFaceAlpha = 0;
      this.viewer!.scene.globe.translucency.frontFaceAlpha = this.opacity;
      if (!this.viewer!.scene.globe.translucency.enabled) {
        this.viewer!.scene.globe.translucency.enabled = true;
      }
    }
    this.viewer!.scene.requestRender();
    syncMapOpacityParam(this.opacity);
  }

  changeVisibility() {
    const mapId = this.mapChooser!.selectedMap.id;
    if (mapId === 'empty_map') {
      this.mapChooser!.selectMap(this.baseMapId);
    } else {
      this.baseMapId = mapId;
      this.mapChooser!.selectMap('empty_map');
    }
    this.requestUpdate();
  }

  firstUpdated() {
    this.mapChooser!.addMapChooser(this.querySelector('ngm-map-chooser')!);
  }

  render() {
    return html`
      <div class="base-map-labels">
        <label>${i18next.t('dtd_aerial_map_label')}</label><label>${i18next.t('dtd_grey_map_label')}</label><label>${i18next.t('dtd_lakes_rivers_map_label')}</label>
      </div>
      <ngm-map-chooser></ngm-map-chooser>
      <div class="ui divider"></div>
      <div class="ngm-base-layer">
        <div class="ngm-layer-icon ${classMap({
          'ngm-visible-icon': this.mapChooser!.selectedMap.id !== 'empty_map',
          'ngm-invisible-icon': this.mapChooser!.selectedMap.id === 'empty_map'
        })}"
             @click=${this.changeVisibility}></div>
        <div class="ngm-displayed-slider">
          <div>
            <label>${i18next.t('dtd_opacity_base_map')}</label>
            <label>${(this.opacity * 100).toFixed()} %</label>
          </div>
          <input type="range" class="ngm-slider"
                 style="background-image: linear-gradient(to right, #B9271A, #B9271A ${this.opacity * 100}%, white ${this.opacity * 100}%)"
                 min=0 max=1 step=0.01
                 value=${!isNaN(this.opacity) ? this.opacity : 0.4}
                 @input=${evt => this.updateOpacity(Number((<HTMLInputElement>evt.target).value))}/>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
