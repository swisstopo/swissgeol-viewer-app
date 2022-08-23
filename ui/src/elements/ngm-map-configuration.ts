import {html} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map.js';
import './ngm-map-chooser';
import {getMapOpacityParam, syncMapOpacityParam} from '../permalink';
import MainStore from '../store/main';
import type {Viewer} from 'cesium';
import type MapChooser from '../MapChooser.js';
import {debounce} from '../utils';

@customElement('ngm-map-configuration')
export class NgmMapConfiguration extends LitElementI18n {
  @state() viewer: Viewer | null | undefined;
  @state() mapChooser: MapChooser | null | undefined;
  @state() opacity: number = getMapOpacityParam();
  @state() baseMapId = 'ch.swisstopo.pixelkarte-grau';
  @query('ngm-map-chooser') mapChooserElement;
  private debouncedOpacityUpdate = debounce((evt: Event) => this.updateOpacity(Number((<HTMLInputElement>evt.target).value)), 250, true);

  constructor() {
    super();

    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
    });
    MainStore.mapChooser.subscribe(chooser => {
      this.mapChooser = chooser;
      this.updateOpacity(getMapOpacityParam());
    });
    MainStore.syncMap.subscribe(() => this.updateOpacity(getMapOpacityParam()));
  }

  firstUpdated() {
    this.mapChooser!.addMapChooser(this.mapChooserElement);
  }

  updateOpacity(opacity: number, skipUpdate = false) {
    if (!skipUpdate) this.opacity = opacity;
    if (opacity === 1 && this.mapChooser!.selectedMap.id !== 'empty_map') {
      this.viewer!.scene.globe.translucency.enabled = !!this.mapChooser!.selectedMap.hasAlphaChannel;
      this.viewer!.scene.globe.translucency.backFaceAlpha = 1;
    } else {
      this.viewer!.scene.globe.translucency.backFaceAlpha = 0;
      this.viewer!.scene.globe.translucency.frontFaceAlpha = opacity;
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

  onMapChange(evt) {
    if (evt.detail.active.id === 'empty_map')
      this.updateOpacity(1, true);
    else
      this.updateOpacity(this.opacity);
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="base-map-labels">
        <label>${i18next.t('dtd_aerial_map_label')}</label><label>${i18next.t('dtd_grey_map_label')}</label><label>${i18next.t('dtd_lakes_rivers_map_label')}</label>
      </div>
      <ngm-map-chooser @change=${this.onMapChange}></ngm-map-chooser>
      <div class="ui divider"></div>
      <div class="ngm-base-layer">
        <div
          title=${this.mapChooser!.selectedMap.id !== 'empty_map' ? i18next.t('dtd_hide') : i18next.t('dtd_show')}
          class="ngm-layer-icon ${classMap({
            'ngm-visible-icon': this.mapChooser!.selectedMap.id !== 'empty_map',
            'ngm-invisible-icon': this.mapChooser!.selectedMap.id === 'empty_map'
          })}"
          @click=${this.changeVisibility}></div>
        <div class="ngm-displayed-slider">
          <div>
            <label>${i18next.t('dtd_opacity_base_map')}</label>
            <label>${(this.opacity * 100).toFixed()} %</label>
          </div>
          <input type="range"
                 class="ngm-slider ${classMap({'ngm-disabled': this.mapChooser!.selectedMap.id === 'empty_map'})}"
                 style="background-image: linear-gradient(to right, var(--ngm-interaction-active), var(--ngm-interaction-active) ${this.opacity * 100}%, white ${this.opacity * 100}%)"
                 min=0 max=1 step=0.01
                 .value=${!isNaN(this.opacity) ? this.opacity : 0.4}
                 @input=${evt => {
                   this.opacity = Number((<HTMLInputElement>evt.target).value);
                   this.debouncedOpacityUpdate(evt);
                 }}/>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
