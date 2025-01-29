import {html} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map.js';
import './ngm-map-chooser';
import {getMapOpacityParam} from '../permalink';
import MainStore from '../store/main';
import {Viewer} from 'cesium';
import type MapChooser from '../MapChooser.js';

@customElement('ngm-map-configuration')
export class NgmMapConfiguration extends LitElementI18n {
  @state()
  accessor viewer: Viewer | null | undefined;
  @state()
  accessor mapChooser: MapChooser | null | undefined;
  @state()
  accessor opacity: number = getMapOpacityParam();
  @state()
  accessor baseMapId = 'ch.swisstopo.pixelkarte-grau';
  @query('ngm-map-chooser')
  accessor mapChooserElement;

  // private readonly debouncedOpacityUpdate = debounce((evt: Event) => this.updateOpacity(Number((<HTMLInputElement>evt.target).value)), 250);

  constructor() {
    super();

    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
    });
    MainStore.mapChooser.subscribe(chooser => {
      this.mapChooser = chooser;
    });

    // TODO maybe use this?
    // MainStore.syncMap.subscribe(() => this.updateOpacity(getMapOpacityParam()));
  }

  firstUpdated() {
    this.mapChooser!.addMapChooser(this.mapChooserElement);
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


  render() {
    return html`
      <div class="base-map-labels">
        <label>${i18next.t('dtd_aerial_map_label')}</label><label>${i18next.t('dtd_grey_map_label')}</label><label>${i18next.t('dtd_lakes_rivers_map_label')}</label>
      </div>
      <ngm-map-chooser ></ngm-map-chooser>
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
        </div>
      </div>
      <div class="ui divider"></div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
