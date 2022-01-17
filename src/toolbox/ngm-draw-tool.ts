import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import type {CesiumDraw} from '../draw/CesiumDraw.js';
import './ngm-gst-interaction';
import './ngm-swissforages-modal';
import './ngm-swissforages-interaction';
import ToolboxStore from '../store/toolbox';
import type {NgmGeometry} from './interfaces';
import DrawStore from '../store/draw';

@customElement('ngm-draw-tool')
export class NgmAreaOfInterestDrawer extends LitElementI18n {
  @property({type: Boolean}) drawerHidden = true;
  @state() selectedAreaId: string | undefined;
  private draw: CesiumDraw | undefined;


  constructor() {
    super();
    // todo remove in GSNGM-770
    DrawStore.draw.subscribe(draw => {
      this.draw = draw;
      if (draw) draw.addEventListener('statechanged', () => this.requestUpdate());
    });
    ToolboxStore.openedGeometryOptions.subscribe(options => {
      this.selectedAreaId = options ? options.id : undefined;
    });
  }

  // todo remove in GSNGM-770
  update(changedProperties) {
    if (changedProperties.has('drawerHidden') && !changedProperties.get('drawerHidden') && this.draw) {
      this.draw.active = false;
      this.draw.clear();
    }
    super.update(changedProperties);
  }

  render() {
    return html`
      <ngm-draw-section></ngm-draw-section>
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
