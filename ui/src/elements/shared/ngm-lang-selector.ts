import {customElement} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n';
import {css, html} from 'lit';
import {SUPPORTED_LANGUAGES} from '../../constants';
import {styleMap} from 'lit/directives/style-map.js';
import i18next from 'i18next';
import 'fomantic-ui-css/components/dropdown.js';
import $ from '../../jquery';

@customElement('ngm-lang-selector')
export class NgmLangSelector extends LitElementI18n {

  static readonly styles = css`
    .ngm-lang-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      gap: 12px;
      width: 85px;
      font-size: 14px;
    }
  `;

  firstUpdated() {
    this.initializeDropdown();
  }

  protected updated() {
    this.initializeDropdown();
    super.updated();
  }

  initializeDropdown() {
    this.querySelectorAll('.ui.dropdown').forEach(elem => $(elem).dropdown({
      direction: 'downward'
    }));
  }

  render() {
    return html`
      <div class="ui dropdown ngm-lang-dropdown">
        <div class="ngm-lang-title">
          ${i18next.language?.toUpperCase()}
          <div class="ngm-dropdown-icon"></div>
          <ngm-icon icon="ngm-dropdown-icon"></ngm-icon>
        </div>
        <div class="menu">
          ${SUPPORTED_LANGUAGES.map(lang => html`
            <div class="item" @click="${() => i18next.changeLanguage(lang)}" style="padding: 0">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; gap: 12px; width: 85px; font-size: 14px">
                <ngm-icon style="${styleMap({'visibility': i18next.language?.toUpperCase() === lang?.toUpperCase() ? 'visible' : 'hidden'})}" icon="checkmark"></ngm-icon>
                <span>${lang.toUpperCase()}</span>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
