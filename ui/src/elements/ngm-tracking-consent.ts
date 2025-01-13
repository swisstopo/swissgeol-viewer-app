import {css, html} from 'lit';
import {LitElementI18n} from '../i18n';
import i18next from 'i18next';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {customElement, query, state} from "lit/decorators.js";
import '../components/core/core-button';
import '../components/core/core-checkbox';
import {applyTypography} from "../styles/theme";
import '../components/language-selector/ngm-language-selector';

@customElement('ngm-tracking-consent')
export class NgmTrackingConsent extends LitElementI18n {
  @state()
  accessor isAllowed: boolean = true;
  @state()
  accessor isAccepted: boolean = false;

  @query('#disclaimer')
  accessor dialog!: HTMLDialogElement

  constructor() {
    super();
  }

  firstUpdated() {
    if (!this.dialog.open && !this.isAccepted) {
      this.dialog.showModal()
    }
  }

  static readonly styles = css`
  dialog {
    width: 909px;
    padding: 0;
    border: none;
    border-radius: 4px;

    & > div {
      padding: 24px;
    }
  }

    h1 {
      margin: 0;
      font-weight: 700;
      font-size: 20px;
      line-height: 24px;
    }

    h2 {
      margin: 0;
      font-weight: 700;
      font-size: 16px;
      line-height: 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .main {
      border-top: 1px solid #ccc;
      border-bottom: 1px solid #ccc;

      & > h2 {
        margin-bottom: 16px;
      }

      & > p {
        margin-bottom: 24px;
        margin-top: 0;
      }
    }

    .footer {
      display: flex;
      justify-content: flex-end;
    }
  `;

  render() {
      return html`
        <dialog id="disclaimer">
          <div class="header">
            <h1>${i18next.t('tracking_header')}</h1>
            <ngm-language-selector></ngm-language-selector>
          </div>
          <div class="main">
            <h2>${i18next.t('tracking_limitations_of_liability_header')}</h2>
            <p>${unsafeHTML(i18next.t('tracking_limitations_of_liability_text'))}</p>
            <h2>${i18next.t('tracking_data_acquisition_header')}</h2>
            <p>${unsafeHTML(i18next.t('tracking_data_acquisition_text'))}</p>
              <ngm-core-checkbox .isActive="${this.isAllowed}" .label="${i18next.t('tracking_agree_label')}" @update="${() => this.isAllowed = !this.isAllowed}"></ngm-core-checkbox>
          </div>
          <div class="footer">
            <ngm-core-button @click="${() => this.accept()}">
              ${i18next.t('accept')}
            </ngm-core-button>
          </div>
        </dialog>
      `;
  }

  private accept() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        allowed: this.isAllowed
      }
    }));
    this.dialog.close()
  }
}
