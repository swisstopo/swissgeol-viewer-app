import i18next from 'i18next';
import { html } from 'lit';
import { customElement, property, query, queryAll } from 'lit/decorators.js';
import { LitElementI18n } from '../i18n';
import draggable from './draggable';
import { dragArea } from './helperElements';
import {
  createLithologyIncludeUniform,
  getVoxelShader,
} from '../layers/voxels-helper';
import { repeat } from 'lit/directives/repeat.js';
import type { Viewer } from 'cesium';
import { LayerConfig } from '../layertree';

@customElement('ngm-voxel-filter')
export class NgmVoxelFilter extends LitElementI18n {
  @property({ type: Object })
  accessor config: LayerConfig | undefined;
  @property({ type: Object })
  accessor viewer!: Viewer;

  @query('.min-conductivity')
  accessor minConductivityInput!: HTMLInputElement;
  @query('.max-conductivity')
  accessor maxConductivityInput!: HTMLInputElement;
  @query('.vox_filter_include_undefined')
  accessor includeUndefinedConductivity!: HTMLInputElement;
  @queryAll('.lithology-checkbox input[type="checkbox"]')
  accessor lithologyCheckbox!: NodeListOf<HTMLInputElement>;

  private minConductivity = NaN;
  private maxConductivity = NaN;

  private minConductivityValue = NaN;
  private maxConductivityValue = NaN;

  shouldUpdate(): boolean {
    return this.config !== undefined;
  }

  willUpdate() {
    if (!this.config) return;
    this.minConductivityValue = this.minConductivity =
      this.config.voxelFilter!.conductivityRange[0];
    this.maxConductivityValue = this.maxConductivity =
      this.config.voxelFilter!.conductivityRange[1];

    this.hidden = false;
  }

  render() {
    const hideCheckboxColor = this.config!.voxelDataName !== 'Index';
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('vox_filter_filtering_on')} ${i18next.t(this.config!.label)}
        <div class="ngm-close-icon" @click=${() => this.close()}></div>
      </div>
      <div class="content-container">
        <form class="ui form">
          <div class="filter-label">
            ${i18next.t('vox_filter_hydraulic_conductivity')}
          </div>
          <div class="two fields">
            <div class="field">
              <label>${i18next.t('vox_filter_min')}</label>
              <input
                required
                class="min-conductivity"
                type="number"
                step="0.01"
                value="${this.minConductivity}"
                min="${this.minConductivityValue}"
                max="${this.maxConductivity}"
                @input="${(evt) => this.minConductivityChanged(evt)}"
              />
            </div>
            <div class="field">
              <label>${i18next.t('vox_filter_max')}</label>
              <input
                required
                class="max-conductivity"
                type="number"
                step="0.01"
                value="${this.maxConductivity}"
                min="${this.minConductivity}"
                max="${this.maxConductivityValue}"
                @input="${(evt) => this.maxConductivityChanged(evt)}"
              />
            </div>
          </div>
          <div>
            <label>
              <input
                class="vox_filter_include_undefined"
                type="checkbox"
                value="fixme"
                checked
              />
              ${i18next.t('vox_filter_undefined_conductivity')}
            </label>
          </div>
        </form>
        <form class="ui form">
          <div class="inline fields">
            <div class="field">
              <div class="ui radio checkbox">
                <input
                  type="radio"
                  id="operator_and"
                  name="operator"
                  value="0"
                  checked
                />
                <label for="operator_and">${i18next.t('vox_filter_and')}</label>
              </div>
            </div>
            <div class="field">
              <div class="ui radio checkbox">
                <input
                  type="radio"
                  id="operator_or"
                  name="operator"
                  value="1"
                />
                <label for="operator_or">${i18next.t('vox_filter_or')}</label>
              </div>
            </div>
            <div class="field">
              <div class="ui radio checkbox">
                <input
                  type="radio"
                  id="operator_xor"
                  name="operator"
                  value="2"
                />
                <label for="operator_xor">${i18next.t('vox_filter_xor')}</label>
              </div>
            </div>
          </div>
        </form>
        <form class="lithology-checkbox">
          <div class="filter-label">${i18next.t('vox_filter_lithology')}</div>
          ${repeat(
            this.config!.voxelFilter.lithology,
            (lithology: any, index: number) =>
              html` <label>
                <input type="checkbox" value="${lithology.index}" checked />
                <div
                  ?hidden=${hideCheckboxColor}
                  style="background-color: ${this.config!.voxelColors?.colors[
                    index
                  ]}; width: 20px;"
                ></div>
                ${i18next.t(lithology.label)}
              </label>`,
          )}
          <div class="lithology-filter-buttons">
            <button
              class="ui button"
              type="button"
              @click="${() => {
                this.lithologyCheckbox.forEach(
                  (checkbox) => (checkbox.checked = true),
                );
              }}"
            >
              ${i18next.t('vox_filter_select_all')}
            </button>
            <button
              class="ui button"
              type="button"
              @click="${() => {
                this.lithologyCheckbox.forEach(
                  (checkbox) => (checkbox.checked = false),
                );
              }}"
            >
              ${i18next.t('vox_filter_unselect_all')}
            </button>
          </div>
        </form>
        <div>
          <button
            class="ui button ngm-action-btn"
            @click="${() => this.applyFilter()}"
          >
            ${i18next.t('vox_filter_apply')}
          </button>
        </div>
      </div>
      ${dragArea}
    `;
  }

  minConductivityChanged(evt) {
    this.minConductivity = parseFloat(evt.target.value);
    this.maxConductivityInput.min = this.minConductivity.toString();
  }

  maxConductivityChanged(evt) {
    this.maxConductivity = parseFloat(evt.target.value);
    this.minConductivityInput.max = this.maxConductivity.toString();
  }

  close() {
    this.hidden = true;
    this.resetShader();
    this.resetForm();

    this.config = undefined;
  }

  applyFilter() {
    const shader = getVoxelShader(this.config);
    shader.setUniform('u_filter_conductivity_min', this.minConductivity);
    shader.setUniform('u_filter_conductivity_max', this.maxConductivity);

    const lithologyInclude: number[] = [];
    this.lithologyCheckbox.forEach((checkbox) =>
      lithologyInclude.push(checkbox.checked ? 1 : 0),
    );

    // @ts-ignore https://github.com/CesiumGS/cesium/pull/11284
    shader.setUniform(
      'u_filter_selected_lithology',
      createLithologyIncludeUniform(lithologyInclude),
    );
    const operator = this.querySelector<HTMLInputElement>(
      'input[name="operator"]:checked',
    )!;
    shader.setUniform('u_filter_operator', parseInt(operator.value, 10));
    shader.setUniform(
      'u_filter_include_undefined_conductivity',
      this.includeUndefinedConductivity.checked,
    );

    this.viewer.scene.requestRender();
  }

  resetShader() {
    const shader = getVoxelShader(this.config);
    shader.setUniform('u_filter_conductivity_min', this.minConductivityValue);
    shader.setUniform('u_filter_conductivity_max', this.maxConductivityValue);
    // @ts-ignore https://github.com/CesiumGS/cesium/pull/11284
    shader.setUniform(
      'u_filter_selected_lithology',
      createLithologyIncludeUniform(
        Array(this.config!.voxelFilter.lithology).fill(1),
      ),
    );
    shader.setUniform('u_filter_operator', 0);
    this.viewer.scene.requestRender();
  }

  resetForm() {
    this.querySelectorAll<HTMLFormElement>('.content-container form').forEach(
      (form) => form.reset(),
    );
    this.includeUndefinedConductivity.checked = true;
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
