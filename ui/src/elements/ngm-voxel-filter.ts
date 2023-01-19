import i18next from 'i18next';
import {html, nothing} from 'lit';
import {customElement, property, queryAll} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import draggable from './draggable';
import {dragArea} from './helperElements';
import type {Config} from '../layers/ngm-layers-item';
import {getVoxelShader} from '../layers/voxels-helper';
import {repeat} from 'lit/directives/repeat.js';
import type {Viewer} from 'cesium';
import {setBit} from '../utils';

@customElement('ngm-voxel-filter')
export class NgmVoxelFilter extends LitElementI18n {
  @property({type: Object}) config!: Config;
  @property({type: Object}) viewer!: Viewer;
  @queryAll('.lithology-checkbox input[type="checkbox"]') lithologyCheckbox!: NodeListOf<HTMLInputElement>;
  private minConductivity = NaN;
  private maxConductivity = NaN;

  private minConductivityValue = NaN;
  private maxConductivityValue = NaN;

  shouldUpdate(): boolean {
    return this.config !== undefined;
  }

  willUpdate() {
    this.minConductivityValue = this.minConductivity = this.config.voxelFilter!.conductivityRange[0];
    this.maxConductivityValue = this.maxConductivity = this.config.voxelFilter!.conductivityRange[1];
    this.hidden = false;
  }

  render() {
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('vox_filter_filtering_on')} ${i18next.t(this.config.label)}
        <div class="ngm-close-icon" @click=${() => this.close()}></div>
      </div>
      <div class="content-container">
        <div class="ui form">
          <div class="filter-label">${i18next.t('vox_filter_hydraulic_conductivity')}</div>
          <div class="two fields">
            <div class="field">
              <label>${i18next.t('vox_filter_min')}</label>
              <input type="number" .value="${this.minConductivity}" min="${this.minConductivityValue}" @input="${evt => this.minConductivity = evt.target.value}"/>
            </div>
            <div class="field">
              <label>${i18next.t('vox_filter_max')}</label>
              <input type="number" .value="${this.maxConductivity}" max="${this.maxConductivityValue}" @input="${evt => this.maxConductivity = evt.target.value}"/>
            </div>
          </div>
        </div>
        ${this.config.voxelFilter?.lithology ? html`
        <div class="ui form">
          <div class="inline fields">
            <div class="field">
              <div class="ui radio checkbox">
                <input type="radio" id="operator_and" name="operator" value="0" checked>
                <label for="operator_and">${i18next.t('vox_filter_and')}</label>
              </div>
            </div>
            <div class="field">
              <div class="ui radio checkbox">
                <input type="radio" id="operator_or" name="operator" value="1">
                <label for="operator_or">${i18next.t('vox_filter_or')}</label>
              </div>
            </div>
            <div class="field">
              <div class="ui radio checkbox">
                <input type="radio" id="operator_xor" name="operator" value="2">
                <label for="operator_xor">${i18next.t('vox_filter_xor')}</label>
              </div>
            </div>
          </div>
        </div>
        <div class="lithology-checkbox">
          <div class="filter-label">${i18next.t('vox_filter_lithology')}</div>
          ${repeat(this.config.voxelFilter.lithology, (lithology: any) =>
            html`<label><input type="checkbox" value="${lithology.index}" checked> ${lithology.label}</label>`
          )}
        </div>
        ` : nothing}
        <div>
          <button class="ui button" @click="${() => this.applyFilter()}">
            ${i18next.t('vox_filter_apply')}
          </button>
        </div>
      </div>
      ${dragArea}
    `;
  }

  close() {
    this.hidden = true;
    this.resetFilter();
    this.config = undefined;
  }

  applyFilter() {
    const shader = getVoxelShader(this.config);
    shader.setUniform('u_filter_conductivity_min', this.minConductivity);
    shader.setUniform('u_filter_conductivity_max', this.maxConductivity);

    let lithologyExclude = 0;
    this.lithologyCheckbox.forEach((checkbox, index) => {
      if (!checkbox.checked) {
        lithologyExclude = setBit(lithologyExclude, index);
      }
    });
    shader.setUniform('u_filter_lithology_exclude', lithologyExclude);
    const operator = this.querySelector<HTMLInputElement>('input[name="operator"]:checked');
    if (operator) {
      shader.setUniform('u_filter_operator', operator.value);
    }

    this.viewer.scene.requestRender();
  }

  resetFilter() {
    const shader = getVoxelShader(this.config);
    shader.setUniform('u_filter_conductivity_min', this.minConductivityValue);
    shader.setUniform('u_filter_conductivity_max', this.maxConductivityValue);
    shader.setUniform('u_filter_lithology_exclude', 0);
    shader.setUniform('u_filter_operator', 0);
    this.viewer.scene.requestRender();
  }


  firstUpdated() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
