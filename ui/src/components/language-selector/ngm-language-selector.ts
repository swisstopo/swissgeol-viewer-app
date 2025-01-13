import {css, html, PropertyValues, unsafeCSS} from 'lit';
import i18next from 'i18next';
import {SUPPORTED_LANGUAGES} from "../../constants";
import {customElement} from "lit/decorators.js";
import {LitElementI18n} from "../../i18n";
import {styleMap} from "lit/directives/style-map.js";
import 'fomantic-ui-css/components/dropdown';
import $ from 'jquery';
import '../core/core-icon';
import fomanticTransitionCss from "fomantic-ui-css/components/transition.css";
import fomanticDropdownCss from "fomantic-ui-css/components/dropdown.css";

@customElement('ngm-language-selector')
export class NgmLanguageSelector extends LitElementI18n {

  firstUpdated(): void {
    if (this.shadowRoot != null) {
      $(this.shadowRoot.querySelectorAll('.ui.dropdown')).dropdown({
        on: 'mouseup',
        collapseOnActionable: false,
      });
    }
  }

  static readonly styles = css`

    .ngm-lang-dropdown {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      width: 69px;

      padding: 8px 0;
      border-radius: 4px;
      color: var(--color-main);
    }

    .ngm-lang-dropdown:hover {
      background-color: var(--color-hovered);
      color: var(--color-main--dark);
    }

    .ngm-lang-dropdown.active ngm-icon[icon="dropdown"] {
      transform: rotate(180deg);
    }

    .ngm-lang-title {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
    }

    .ngm-lang-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      font-size: 14px;
      font-family: var(--font);
      line-height: 20px;
      letter-spacing: calc(14px * 0.0025);
    }

    .ngm-lang-item:hover {
      background-color: var(--color-pressed);
    }

    .ngm-lang-title .ngm-dropdown-icon {
      background-color: var(--ngm-interaction);
      transform: rotate(90deg);
    }
    ${unsafeCSS(fomanticTransitionCss)}
    ${unsafeCSS(fomanticDropdownCss)}

  `;


  render() {
    return html`
          <div class="ui dropdown ngm-lang-dropdown">
          <div class="ngm-lang-title">
            ${i18next.language?.toUpperCase()}
            <ngm-core-icon icon="dropdown" />
          </div>
          <div class="menu">
            ${SUPPORTED_LANGUAGES.map(lang => html`
              <div class="item" @click="${() => i18next.changeLanguage(lang)}" style="padding: 0; width: 85px;">
                <div class="ngm-lang-item">
                  <ngm-core-icon style="${styleMap({'visibility': i18next.language?.toUpperCase() === lang?.toUpperCase() ? 'visible' : 'hidden'})}" icon="checkmark"></ngm-core-icon>
                  <span>${lang.toUpperCase()}</span>
                </div>
                </div>
            `)}
          </div>
        </div>
      `;
  }
}
