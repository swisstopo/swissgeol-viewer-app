import {css, html} from 'lit';
import i18next from 'i18next';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {customElement, state} from "lit/decorators.js";
import '../core';
import '../language-selector/ngm-language-selector';
import {LitElementI18n} from "../../i18n";
import {applyTypography} from "../../styles/theme";

@customElement('ngm-tracking-consent')
export class NgmTrackingConsent extends LitElementI18n {
  @state()
  accessor isAllowed: boolean = true;
  @state()
  accessor isAccepted: boolean = false;

  constructor() {
    super();
  }

  static readonly styles = css`
    :host  > div {
      padding: 24px;
    }

    h1 {
      ${applyTypography('modal-title')}
      margin: 0;
    }

    h2 {
      margin: 0;
      font-weight: 700;
      font-size: 16px;
      line-height: 24px;
      margin-bottom: 16px;

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

  render() {
    return html`
          <div class="header">
            <h1>${i18next.t('tracking_header')}</h1>
            <ngm-language-selector></ngm-language-selector>
          </div>
          <div class="main">
            <h2>${i18next.t('tracking_limitations_of_liability_header')}</h2>
            <p>${unsafeHTML(i18next.t('tracking_limitations_of_liability_text'))}</p>
            <h2>${i18next.t('tracking_data_acquisition_header')}</h2>
            <p>${unsafeHTML(i18next.t('tracking_data_acquisition_text'))}</p>
              <ngm-core-checkbox .isActive="${this.isAllowed}"  @update="${() => this.isAllowed = !this.isAllowed}">${i18next.t('tracking_agree_label')}</ngm-core-checkbox>
          </div>
          <div class="footer">
            <ngm-core-button @click="${() => this.accept()}">
              ${i18next.t('accept')}
            </ngm-core-button>
          </div>
      `;
  }

  private accept() {
    this.dispatchEvent(new CustomEvent('confirm', {
      detail: {
        allowed: this.isAllowed
      }
    }));
  }
}
