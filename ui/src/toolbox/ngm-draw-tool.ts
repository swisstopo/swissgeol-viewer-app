import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import './ngm-gst-interaction';
import './ngm-swissforages-modal';
import './ngm-swissforages-interaction';
import ToolboxStore from '../store/toolbox';
import type {NgmGeometry} from './interfaces';

@customElement('ngm-draw-tool')
export class NgmAreaOfInterestDrawer extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @state() selectedAreaId: string | undefined;


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
        .selectedId=${this.selectedAreaId}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => {
          ToolboxStore.nextGeometryAction({id: evt.detail.id, action: 'zoom'});
          ToolboxStore.setOpenedGeometryOptions({id: evt.detail.id!});
        }}>
      </ngm-geometries-list>`;
  }

  createRenderRoot() {
    return this;
  }

}