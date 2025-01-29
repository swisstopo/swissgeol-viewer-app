import { customElement, property, state } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n';
import { html, PropertyValues } from 'lit';
import i18next from 'i18next';
import { classMap } from 'lit/directives/class-map.js';
import { Asset } from './ngm-dashboard';
import '../../layers/ngm-layers-upload';
import { PROJECT_ASSET_MAX_SIZE } from '../../constants';
import type { KmlUploadEvent } from '../../components/layer/upload/layer-upload-kml';

@customElement('ngm-project-assets-section')
export class NgmProjectAssetsSection extends LitElementI18n {
  @property({ type: Array })
  accessor assets: Asset[] = [];
  @property({ type: Object })
  accessor toastPlaceholder!: HTMLElement;
  @property({ type: Function })
  accessor onKmlUpload: ((file: File) => Promise<void> | void) | undefined;
  @property({ type: Boolean })
  accessor viewMode: boolean = false;
  @state()
  accessor kmlEditIndex: number | undefined;

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('assets')) {
      this.dispatchEvent(
        new CustomEvent('assetsChanged', { detail: { assets: this.assets } }),
      );
    }
    super.updated(changedProperties);
  }

  editButtons(index: number) {
    return html` <div
        class="ngm-icon ngm-edit-icon ${classMap({
          active: this.kmlEditIndex === index,
        })}"
        @click=${() => {
          this.kmlEditIndex = this.kmlEditIndex === index ? undefined : index;
        }}
      ></div>
      <div
        class="ngm-icon ngm-delete-icon"
        @click=${() => {
          this.assets.splice(index, 1);
          this.assets = [...this.assets];
        }}
      ></div>`;
  }

  handleKmlUpload(e: KmlUploadEvent): void {
    if (this.onKmlUpload != null) {
      this.onKmlUpload(e.detail.file);
    }
  }

  render() {
    return html` <div>
      <div class="ngm-proj-title-icon">
        <div class="ngm-file-upload-icon"></div>
        <div>${i18next.t('dashboard_project_kml')}</div>
      </div>
      <div class="project-edit-fields">
        ${this.viewMode
          ? ''
          : html`
              <ngm-layer-upload-kml
                .toastPlaceholder=${this.toastPlaceholder}
                .maxFileSize=${PROJECT_ASSET_MAX_SIZE}
                @upload=${this.handleKmlUpload}
              ></ngm-layer-upload-kml>
            `}
        ${this.assets?.map((kml, index) => {
          return html`
            <div class="ngm-action-list-item ngm-geom-item">
              <div
                class="ngm-action-list-item-header ${classMap({
                  view: this.viewMode,
                })}"
              >
                <div>
                  ${this.kmlEditIndex !== index
                    ? kml.name
                    : html` <div
                        class="ngm-input ${classMap({
                          'ngm-input-warning': !kml.name,
                        })}"
                      >
                        <input
                          type="text"
                          placeholder="required"
                          .value=${kml.name}
                          @input=${(evt) => {
                            kml.name = evt.target.value;
                            this.assets[index] = kml;
                            this.assets = [...this.assets];
                          }}
                        />
                      </div>`}
                </div>
                ${this.viewMode ? '' : this.editButtons(index)}
              </div>
            </div>
          `;
        })}
        <div .hidden=${this.assets?.length > 0}>
          ${i18next.t('dashboard_no_assets_text')}
        </div>
      </div>
    </div>`;
  }

  createRenderRoot() {
    return this;
  }
}
