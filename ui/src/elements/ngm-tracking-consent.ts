import {css, html} from 'lit';
import {LitElementI18n} from '../i18n';
import i18next from 'i18next';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {customElement, query, state} from "lit/decorators.js";
import '../components/core/core-button';
import {applyTypography} from "../styles/theme";

@customElement('ngm-tracking-consent')
export class NgmTrackingConsent extends LitElementI18n {
  @state()
  accessor allowed: boolean  = true;
  @state()
  accessor accepted: boolean  = false;

  @query('#disclaimer')
  accessor dialog!: HTMLDialogElement

  constructor() {
    super();
  }

  updated(changedProperties) {
    if (!this.dialog.open) {
      this.dialog.showModal()
    }
  }

  static readonly styles = css`
  dialog {
    width: 900px;
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

    .checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    input[type="checkbox"] {
      height: 20px;
      width: 20px;
      margin: 0;
    }

    input[type="checkbox"]:checked {
      accent-color: #607D52;
      border-color: #607D52;
    }

    label {
      ${applyTypography('body-2')};
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
          </div>
          <div class="main">
            <h2>${i18next.t('tracking_limitations_of_liability_header')}</h2>
            <p>${unsafeHTML(i18next.t('tracking_limitations_of_liability_text'))}</p>
            <h2>${i18next.t('tracking_data_acquisition_header')}</h2>
            <p>${unsafeHTML(i18next.t('tracking_data_acquisition_text'))}</p>
            <div class="checkbox">
              <input type="checkbox" checked="${this.allowed}" @change="${(e) => this.saveResponse(e.target.checked)}"
                     id="tracking-consent"/>
              <label for="tracking-consent">${i18next.t('tracking_agree_label')}</label>
          </div>

          </div>
          <div class="footer">
            <ngm-core-button @click="${() => this.accept()}">
              ${i18next.t('accept')}
            </ngm-core-button>
          </div>
        </dialog>
      `;
  }

  saveResponse(allowed) {
    this.allowed = allowed;
  }

  private accept() {
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        allowed: this.allowed
      }
    }));
    this.dialog.close()
  }
}
