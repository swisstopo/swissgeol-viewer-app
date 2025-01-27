import i18next from 'i18next';
import { html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { LitElementI18n } from '../i18n';
import draggable from './draggable';
import { dragArea } from './helperElements';
import { getVoxelShader } from '../layers/voxels-helper';
import type { Viewer } from 'cesium';
import { LayerConfig } from '../layertree';

@customElement('ngm-voxel-simple-filter')
export class NgmVoxelSimpleFilter extends LitElementI18n {
  @property({ type: Object })
  accessor config: LayerConfig | undefined;
  @property({ type: Object })
  accessor viewer!: Viewer;

  @query('.min-conductivity')
  accessor minValueInput!: HTMLInputElement;
  @query('.max-conductivity')
  accessor maxValueInput!: HTMLInputElement;

  private minValue = NaN;
  private maxValue = NaN;

  private minInitialValue = NaN;
  private maxInitialValue = NaN;

  shouldUpdate(): boolean {
    return this.config !== undefined;
  }

  willUpdate() {
    if (this.config) {
      this.minInitialValue = this.minValue = this.config.voxelColors!.range[0];
      this.maxInitialValue = this.maxValue = this.config.voxelColors!.range[1];
    }

    this.hidden = false;
  }

  render() {
    if (!this.config) return;
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('vox_filter_filtering_on')} ${i18next.t(this.config.label)}
        <div class="ngm-close-icon" @click=${() => this.close()}></div>
      </div>
      <div class="content-container">
        <form class="ui form">
          <div class="filter-label">${this.config.voxelColors!.label}</div>
          <div class="two fields">
            <div class="field">
              <label>${i18next.t('vox_filter_min')}</label>
              <input
                required
                class="min-conductivity"
                type="number"
                value="${this.minValue}"
                min="${this.minInitialValue}"
                max="${this.maxValue}"
                @input="${(evt) => this.minValueChanged(evt)}"
              />
            </div>
            <div class="field">
              <label>${i18next.t('vox_filter_max')}</label>
              <input
                required
                class="max-conductivity"
                type="number"
                value="${this.maxValue}"
                min="${this.minValue}"
                max="${this.maxInitialValue}"
                @input="${(evt) => this.maxValueChanged(evt)}"
              />
            </div>
          </div>
        </form>
        <div>
          <button class="ui button" @click="${() => this.applyFilter()}">
            ${i18next.t('vox_filter_apply')}
          </button>
        </div>
      </div>
      ${dragArea}
    `;
  }

  minValueChanged(evt) {
    this.minValue = parseFloat(evt.target.value);
    this.maxValueInput.min = this.minValue.toString();
  }

  maxValueChanged(evt) {
    this.maxValue = parseFloat(evt.target.value);
    this.minValueInput.max = this.maxValue.toString();
  }

  close() {
    this.hidden = true;
    this.resetShader();
    this.resetForm();

    this.config = undefined;
  }

  applyFilter() {
    const shader = getVoxelShader(this.config);
    shader.setUniform('u_filter_min', this.minValue);
    shader.setUniform('u_filter_max', this.maxValue);

    this.viewer.scene.requestRender();
  }

  resetShader() {
    const shader = getVoxelShader(this.config);
    shader.setUniform('u_filter_min', this.minInitialValue);
    shader.setUniform('u_filter_max', this.maxInitialValue);
    this.viewer.scene.requestRender();
  }

  resetForm() {
    this.querySelectorAll<HTMLFormElement>('.content-container form').forEach(
      (form) => form.reset(),
    );
  }

  firstUpdated() {
    draggable(this, {
      allowFrom: '.drag-handle',
    });
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
