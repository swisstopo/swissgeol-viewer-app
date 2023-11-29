import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import './ngm-gst-interaction';
import './ngm-swissforages-modal';
import './ngm-swissforages-interaction';
import ToolboxStore from '../store/toolbox';
import type {NgmGeometry} from './interfaces';
import i18next from 'i18next';

@customElement('ngm-draw-tool')
export class NgmAreaOfInterestDrawer extends LitElementI18n {
  @property({type: Boolean})
  accessor hidden = true;
  @state()
  accessor selectedAreaId: string | undefined;


  constructor() {
    super();
    ToolboxStore.openedGeometryOptions.subscribe(options => {
      this.selectedAreaId = options ? options.id : undefined;
    });
  }

  render() {
    return html`
      <ngm-draw-section ?hidden=${this.hidden}></ngm-draw-section>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
         listTitle="${i18next.t('tbx_my_geometries')}"
        .selectedId=${this.selectedAreaId}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => {
          ToolboxStore.nextGeometryAction({id: evt.detail.id, action: 'zoom'});
          ToolboxStore.setOpenedGeometryOptions({id: evt.detail.id!});
        }}>
      </ngm-geometries-list>
      <ngm-geometries-list
         listTitle=${i18next.t('tbx_geometries_from_topic')}
        .geometryFilter=${(geom: NgmGeometry) => geom.fromTopic}
      ></ngm-geometries-list>`;
  }

  createRenderRoot() {
    return this;
  }

}
