import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { applyTypography } from '../../../styles/theme';
import { KmlUploadEventDetail } from './layer-upload-kml';
import i18next from 'i18next';
import { LitElementI18n } from '../../../i18n';

@customElement('ngm-layer-upload-kml-modal')
export class LayerUploadKmlModal extends LitElementI18n {
  @property({ type: File })
  accessor file: File | null = null;

  @state()
  accessor isClampEnabled = false;

  private cancel(): void {
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  private confirm(): void {
    if (this.file == null) {
      throw new Error("Can't upload, no file selected.");
    }
    this.dispatchEvent(
      new CustomEvent<KmlUploadEventDetail>('confirm', {
        detail: {
          file: this.file,
          isClampEnabled: this.isClampEnabled,
        },
      }),
    );
  }

  render = () => html`
    <h2>${i18next.t('dtd_upload_modal_title')}</h2>
    <hr />
    <div class="file">${this.file!.name}</div>
    <hr />
    <div class="options">
      <ngm-core-checkbox
        .isActive="${this.isClampEnabled}"
        @update=${() => (this.isClampEnabled = !this.isClampEnabled)}
      >
        ${i18next.t('dtd_clamp_to_ground')}
      </ngm-core-checkbox>
    </div>
    <div class="actions">
      <ngm-core-button variant="secondary" @click="${this.cancel}">
        ${i18next.t('app_cancel_btn_label')}
      </ngm-core-button>
      <ngm-core-button variant="primary" @click="${this.confirm}">
        ${i18next.t('dtd_kml_add_button_label')}
      </ngm-core-button>
    </div>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    hr {
      margin: 0;
      height: 1px;
      border-width: 0;
      color: var(--color-border--default);
      background-color: var(--color-border--default);
    }

    h2 {
      ${applyTypography('modal-title-1')}
      color: var(--color-text--emphasis--high);
      margin: 0;
    }

    .file {
      ${applyTypography('body-2')}
      color: var(--color-primary);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 8px;
    }
  `;
}
