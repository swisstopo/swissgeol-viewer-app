import {css, html, unsafeCSS} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import i18next from 'i18next';
import $ from 'jquery';
import {classMap} from 'lit-html/directives/class-map.js';
import {LitElementI18n} from '../../../i18n';
import {showBannerError, showSnackbarInfo} from '../../../notifications';
import fomanticButtonCss from 'fomantic-ui-css/components/button.css';
import fomanticLoaderCss from 'fomantic-ui-css/components/loader.css';
import '../../core';

@customElement('ngm-layer-upload-kml')
export default class NgmLayerUploadKml extends LitElementI18n {
  @property({type: Object})
  accessor toastPlaceholder!: HTMLElement;

  @property({type: Number})
  accessor maxFileSize: number | null = null;

  @state()
  private accessor isLoading = false;

  @state()
  private accessor isClampingToGround = true;

  @query('.ngm-upload-kml')
  private accessor uploadKmlInput!: HTMLInputElement;

  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    (event.target as HTMLElement).classList.remove('active');
    for (const file of event.dataTransfer!.files) {
      this.uploadKml(file);
    }
  }

  private uploadKml(file: File): void {
    if (!file) {
      showSnackbarInfo(i18next.t('dtd_no_file_to_upload_warn'));
      return;
    }
    if (!file.name.toLowerCase().endsWith('kml')) {
      showBannerError(this.toastPlaceholder, i18next.t('dtd_file_not_kml'));
      return;
    }
    if (this.isFileTooLarge(file)) {
      showBannerError(this.toastPlaceholder, `${i18next.t('dtd_max_size_exceeded_warn')} ${this.maxFileSize}MB`);
      return;
    }
    this.isLoading = true;
    try {
      this.dispatchEvent(new CustomEvent<KmlUploadEventDetails>('upload', {
        detail: {
          file,
          isClampingToGround: this.isClampingToGround,
        }
      }));
      this.uploadKmlInput.value = '';
    } catch (e) {
      console.error(e);
      showBannerError(this.toastPlaceholder, i18next.t('dtd_cant_upload_kml_error'));
    } finally {
      this.isLoading = false;
    }
  }

  private isFileTooLarge(file: File): boolean {
    return typeof this.maxFileSize === 'number' && !isNaN(this.maxFileSize) && file.size > this.maxFileSize * 1024 * 1024;
  }

  readonly render = () => html`
    <button
      class="upload"
      @click="${() => this.uploadKmlInput.click()}"
      @drop="${this.handleDrop}"
      @dragenter=${(e: DragEvent) => $(e.target!).addClass('active')}
      @dragover="${(e: DragEvent) => e.preventDefault()}"
      @dragleave=${(e: DragEvent) => $(e.target!).removeClass('active')}
    >
      ${i18next.t('dtd_add_own_kml')}
      <ngm-core-icon icon="kmlUpload" ?hidden=${this.isLoading}></ngm-core-icon>
      <div class="ui inline mini loader ${classMap({active: this.isLoading})}"></div>
    </button>
    <input
      class="ngm-upload-kml"
      type="file"
      accept=".kml,.KML"
      hidden
      @change=${async (e: InputEvent) => {
        const file = (e.target as HTMLInputElement | null)?.files?.[0];
        if (file != null) {
          this.uploadKml(file);
        }
      }}
    />
    <ngm-core-checkbox
      .label="${i18next.t('dtd_clamp_to_ground')}"
      .isActive="${this.isClampingToGround}"
      @update=${() => this.isClampingToGround = !this.isClampingToGround}
    ></ngm-core-checkbox>
  `;

  static readonly styles = css`
    ${unsafeCSS(fomanticButtonCss)}
    ${unsafeCSS(fomanticLoaderCss)}

    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      justify-content: space-between;

      font-family: var(--font);
      font-size: 14px;
    }

    button.upload {
      font-family: var(--font);
      cursor: pointer;
      display: flex;
      align-items: center;
      letter-spacing: 0.25px;
      font-weight: bold;
      color: var(--ngm-interaction);
      background-color: #F1F3F5;
      border: 2px dashed var(--ngm-interaction);
      margin: 9px 0 16px 0;
      padding-left: 10px;
      height: 46px;
      width: 325px;
    }

    button.upload:hover {
      color: var(--color-action--light);
      border: 2px dashed var(--color-action--light);
    }

    button.upload > ngm-core-icon {
      pointer-events: none;
      color: var(--color-highlight--darker);
      margin-top: 0;
      margin-left: 12px;
      width: 20px;
      height: 20px;
    }

    button.upload:hover > ngm-core-icon {
      color: var(--color-action--light);
    }
  `;
}

export type KmlUploadEvent = CustomEvent<KmlUploadEventDetails>
export interface KmlUploadEventDetails {
  file: File
  isClampingToGround: boolean
}
