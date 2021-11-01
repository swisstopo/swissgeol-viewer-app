import {customElement, html, state} from 'lit-element';
import {LitElementI18n} from '../i18n';
import './ngm-aoi-drawer.ts';
import i18next from 'i18next';

@customElement('ngm-tools')
export class NgmAreaOfInterestDrawer extends LitElementI18n {
  @state() activeTool: 'drawer' | '' = '';

  render() {

    return html`
      <div class="ngm-tools-list" .hidden="${this.activeTool !== ''}">
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'drawer'}>
          <div class="ngm-vector-icon"></div>
          <div>${i18next.t('tbx_draw')}</div>
        </div>
      </div>
      <ngm-aoi-drawer .hidden="${this.activeTool !== 'drawer'}"></ngm-aoi-drawer>`;
  }

  createRenderRoot() {
    return this;
  }

}
