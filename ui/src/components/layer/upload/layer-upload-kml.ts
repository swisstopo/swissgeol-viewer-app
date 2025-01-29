import { css, html, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import i18next from 'i18next';
import { classMap } from 'lit-html/directives/class-map.js';
import { LitElementI18n } from '../../../i18n';
import { showSnackbarError, showSnackbarInfo } from '../../../notifications';
import fomanticLoaderCss from 'fomantic-ui-css/components/loader.css?raw';
import '../../core';
import './layer-upload-kml-modal';
import { applyTransition, applyTypography } from '../../../styles/theme';
import { CoreModal } from '../../core/core-modal';

@customElement('ngm-layer-upload-kml')
export default class NgmLayerUploadKml extends LitElementI18n {
  @property({ type: Number })
  accessor maxFileSize: number | null = null;

  @state()
  private accessor isLoading = false;

  @state()
  private accessor violation: string | null = null;

  @query('button.upload')
  private accessor uploadButton!: HTMLButtonElement;

  @query('input')
  private accessor fileInput!: HTMLInputElement;

  private modal: CoreModal | null = null;

  constructor() {
    super();

    this.handleUpload = this.handleUpload.bind(this);
  }

  firstUpdated() {
    this.initializeDropZone();
  }

  disconnectedCallback(): void {
    this.modal?.close();
  }

  private initializeDropZone(): void {
    let dragCounter = 0;
    const handleDragStart = (_e: DragEvent) => {
      if (dragCounter === 0) {
        this.uploadButton.classList.add('is-active');
      }
      dragCounter += 1;
    };
    const handleDragEnd = (e: DragEvent) => {
      e.preventDefault();
      dragCounter -= 1;
      if (dragCounter === 0) {
        this.uploadButton.classList.remove('is-active');
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      dragCounter = 0;
      this.handleDrop(e);
    };
    this.uploadButton.addEventListener('dragenter', handleDragStart);
    this.uploadButton.addEventListener('dragleave', handleDragEnd);
    this.uploadButton.addEventListener('dragend', handleDragEnd);
    this.uploadButton.addEventListener('dragover', handleDragOver);
    this.uploadButton.addEventListener('drop', handleDrop);
  }

  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    (event.target as HTMLElement).classList.remove('is-active');
    for (const file of event.dataTransfer!.files) {
      this.uploadFile(file);
    }
  }

  private handleFileSelection(e: InputEvent): void {
    const file = (e.target as HTMLInputElement | null)?.files?.[0];
    this.uploadFile(file ?? null);
  }

  private uploadFile(file: File | null): void {
    if (!this.validateFile(file)) {
      return;
    }
    this.modal = CoreModal.open(
      { size: 'small' },
      html`
        <ngm-layer-upload-kml-modal
          .file="${file}"
          @confirm="${this.handleUpload}"
          @cancel="${() => this.modal?.close()}"
        ></ngm-layer-upload-kml-modal>
      `,
    );
  }

  private validateFile(file: File | null): boolean {
    if (file == null) {
      showSnackbarInfo(i18next.t('dtd_no_file_to_upload_warn'));
      return false;
    }
    if (!file.name.toLowerCase().endsWith('.kml')) {
      this.violation = i18next.t('dtd_file_not_kml');
      return false;
    }
    if (this.isFileTooLarge(file)) {
      this.violation = `${i18next.t('dtd_max_size_exceeded_warn')} ${this.maxFileSize}MB`;
      return false;
    }
    this.violation = null;
    return true;
  }

  private handleUpload(e: KmlUploadEvent): void {
    this.isLoading = true;
    try {
      this.dispatchEvent(
        new CustomEvent<KmlUploadEventDetail>('upload', {
          detail: e.detail,
        }),
      );
      this.modal?.close();
      this.fileInput.value = '';
    } catch (e) {
      console.error(e);
      showSnackbarError(i18next.t('dtd_cant_upload_kml_error'));
    } finally {
      this.isLoading = false;
    }
  }

  private isFileTooLarge(file: File): boolean {
    return (
      typeof this.maxFileSize === 'number' &&
      !isNaN(this.maxFileSize) &&
      file.size > this.maxFileSize * 1024 * 1024
    );
  }

  readonly render = () => html`
    <button class="upload" @click="${() => this.fileInput.click()}">
      <span class="title">
        <ngm-core-icon icon="upload" ?hidden=${this.isLoading}></ngm-core-icon>
        <div
          class="ui inline mini loader ${classMap({ active: this.isLoading })}"
        ></div>
        ${i18next.t('dtd_kml_upload_button_title')}
      </span>
      <span class="subtitle">
        ${i18next.t('dtd_kml_upload_button_subtitle')}
      </span>
    </button>
    <input
      type="file"
      accept=".kml,.KML"
      hidden
      @change=${this.handleFileSelection}
    />
    ${this.violation == null
      ? ''
      : html` <span class="violation">${this.violation}</span> `}
  `;

  static readonly styles = css`
    ${unsafeCSS(fomanticLoaderCss)}

    :host, :host * {
      box-sizing: border-box;
    }

    /* upload button */
    button.upload {
      ${applyTypography('button')}

      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 180px;
      gap: 6px;
      padding: 12px 16px;

      background-color: var(--color-bg--white);
      border: 2px dashed var(--color-primary);
      border-radius: 4px;

      cursor: pointer;
    }

    button.upload:hover,
    button.upload.is-active {
      ${applyTransition('fade')};

      color: var(--color-text--emphasis--medium);
      background-color: var(--color-secondary--hovered);
      border-color: var(--color-text--emphasis--medium);
    }

    button.upload > .title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--color-primary);
    }

    button.upload > .subtitle {
      color: var(--color-text--disabled);
    }

    /* violation message */
    span.violation {
      ${applyTypography('body-2')}

      color: var(--color-bg--error);
      margin-top: 2px;
    }
  `;
}

export type KmlUploadEvent = CustomEvent<KmlUploadEventDetail>;
export interface KmlUploadEventDetail {
  file: File;
  isClampEnabled: boolean;
}
