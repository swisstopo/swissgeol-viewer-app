import { html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LitElementI18n } from '../i18n.js';
import i18next from 'i18next';
import { showBannerError, showSnackbarInfo } from '../notifications';
import $ from 'jquery';
import { classMap } from 'lit-html/directives/class-map.js';

@customElement('ngm-layers-upload-action')
export default class LayersUpload extends LitElementI18n {
  @property({ type: Object })
  accessor toastPlaceholder!: HTMLElement;
  @property({ type: Function })
  accessor onKmlUpload!: (
    file: File,
    clampToGround: boolean,
  ) => Promise<void> | void;
  @property({ type: Number })
  accessor maxFileSize: number | undefined;
  @state()
  accessor loading = false;
  @state()
  accessor clampToGround = true;
  @query('.ngm-upload-kml')
  accessor uploadKmlInput!: HTMLInputElement;

  async uploadKml(file: File) {
    if (!file) {
      showSnackbarInfo(i18next.t('dtd_no_file_to_upload_warn'));
    } else if (!file.name.toLowerCase().endsWith('kml')) {
      showBannerError(this.toastPlaceholder, i18next.t('dtd_file_not_kml'));
    } else if (
      typeof this.maxFileSize === 'number' &&
      !isNaN(this.maxFileSize) &&
      file.size > this.maxFileSize * 1024 * 1024
    ) {
      showBannerError(
        this.toastPlaceholder,
        `${i18next.t('dtd_max_size_exceeded_warn')} ${this.maxFileSize}MB`,
      );
    } else {
      try {
        this.loading = true;
        await this.onKmlUpload(file, this.clampToGround);
        this.uploadKmlInput.value = '';
        this.loading = false;
      } catch (e) {
        this.loading = false;
        console.error(e);
        showBannerError(
          this.toastPlaceholder,
          i18next.t('dtd_cant_upload_kml_error'),
        );
      }
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    $(event.target!).removeClass('active');

    for (const file of event.dataTransfer!.files) {
      this.uploadKml(file);
    }
  }

  render() {
    return html`
      <button
        class="ngm-upload-kml-btn"
        @click="${() => this.uploadKmlInput.click()}"
        @drop="${this.onDrop}"
        @dragenter=${(event: DragEvent) => $(event.target!).addClass('active')}
        @dragover="${(event: DragEvent) => event.preventDefault()}"
        @dragleave=${(event: DragEvent) =>
          $(event.target!).removeClass('active')}
      >
        ${i18next.t('dtd_add_own_kml')}
        <div
          ?hidden=${this.loading}
          class="ngm-layer-icon ngm-file-upload-icon"
        ></div>
        <div
          class="ui inline mini loader ${classMap({ active: this.loading })}"
        ></div>
      </button>
      <input
        class="ngm-upload-kml"
        type="file"
        accept=".kml,.KML"
        hidden
        @change=${(e) => this.uploadKml(e.target ? e.target.files[0] : null)}
      />
      <div
        class="ngm-checkbox ${classMap({ active: this.clampToGround })}"
        @click=${() =>
          (<HTMLInputElement>(
            this.querySelector('.ngm-checkbox > input')
          )).click()}
      >
        <input
          type="checkbox"
          ?checked=${this.clampToGround}
          @change=${(evt) => (this.clampToGround = evt.target.checked)}
        />
        <span class="ngm-checkbox-icon"> </span>
        <label>${i18next.t('dtd_clamp_to_ground')}</label>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
