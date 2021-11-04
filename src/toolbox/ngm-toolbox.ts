import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import './ngm-aoi-drawer';
import './ngm-slicer';
import './ngm-geometries-list';
import i18next from 'i18next';

@customElement('ngm-tools')
export class NgmAreaOfInterestDrawer extends LitElementI18n {
  @state() activeTool: 'draw' | 'slicing' | undefined;

  render() {
    return html`
      <div class="ngm-panel-header">
        <div ?hidden=${!this.activeTool} class="ngm-back-icon" @click=${() => this.activeTool = undefined}></div>
        ${i18next.t(this.activeTool ? `tbx_${this.activeTool}` : 'lsb_tools')}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-tools-list" .hidden="${this.activeTool}">
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'draw'}>
          <div class="ngm-vector-icon"></div>
          <div>${i18next.t('tbx_draw')}</div>
        </div>
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'slicing'}>
          <div class="ngm-slicing-icon"></div>
          <div>${i18next.t('tbx_slicing')}</div>
        </div>
      </div>
      <ngm-aoi-drawer .hidden="${this.activeTool !== 'draw'}"></ngm-aoi-drawer>
      <ngm-slicer .hidden="${this.activeTool !== 'slicing'}"></ngm-slicer>`;
  }

  createRenderRoot() {
    return this;
  }

}
