import { css, html } from 'lit';
import i18next from 'i18next';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, state } from 'lit/decorators.js';
import '../core';
import '../layout/language-selector';
import { LitElementI18n } from '../../i18n';
import { applyTypography } from '../../styles/theme';

@customElement('ngm-tracking-consent-modal')
export class NgmTrackingConsentModal extends LitElementI18n {
  @state()
  accessor isAllowed: boolean = true;
  @state()
  accessor isAccepted: boolean = false;

  private accept() {
    this.dispatchEvent(
      new CustomEvent<TrackingConsentModalEventDetail>('confirm', {
        detail: {
          isAllowed: this.isAllowed,
        },
      }),
    );
  }

  render() {
    return html`
      <div class="header">
        <h2>${i18next.t('tracking_header')}</h2>
        <ngm-language-selector></ngm-language-selector>
      </div>
      <div class="main">
        <h3>${i18next.t('tracking_limitations_of_liability_header')}</h3>
        <p>
          ${unsafeHTML(i18next.t('tracking_limitations_of_liability_text'))}
        </p>
        <h3>${i18next.t('tracking_data_acquisition_header')}</h3>
        <p>${unsafeHTML(i18next.t('tracking_data_acquisition_text'))}</p>
        <ngm-core-checkbox
          .isActive="${this.isAllowed}"
          @update="${() => (this.isAllowed = !this.isAllowed)}"
          >${i18next.t('tracking_agree_label')}</ngm-core-checkbox
        >
      </div>
      <div class="footer">
        <ngm-core-button @click="${() => this.accept()}">
          ${i18next.t('accept')}
        </ngm-core-button>
      </div>
    `;
  }

  static readonly styles = css`
    :host > div {
      padding: var(--modal-padding);
    }

    h2 {
      ${applyTypography('modal-title-1')}
      margin: 0;
    }

    h3 {
      ${applyTypography('modal-title-2')}
      margin: 0 0 16px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
    }

    .main {
      border-top: 1px solid var(--color-border--default);
      border-bottom: 1px solid var(--color-border--default);
      padding: 24px 0;

      & > p {
        margin-bottom: 24px;
        margin-top: 0;
      }
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 24px;
    }
  `;
}

export type TrackingConsentModalEvent =
  CustomEvent<TrackingConsentModalEventDetail>;

export interface TrackingConsentModalEventDetail {
  isAllowed: boolean;
}
