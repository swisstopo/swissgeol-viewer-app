import { css, html, unsafeCSS } from 'lit';
import i18next from 'i18next';
import { SUPPORTED_LANGUAGES } from '../../constants';
import { customElement } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n';
import 'fomantic-ui-css/components/dropdown';
import $ from 'jquery';
import '../core/core-icon';
import fomanticTransitionCss from 'fomantic-ui-css/components/transition.css?raw';
import fomanticDropdownCss from 'fomantic-ui-css/components/dropdown.css?raw';
import { applyTypography } from 'src/styles/theme';
import { classMap } from 'lit/directives/class-map.js';

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

  render() {
    return html`
      <div class="ui dropdown container">
        <div class="title">
          ${i18next.language?.toUpperCase()}
          <ngm-core-icon icon="dropdown"></ngm-core-icon>
        </div>
        <div class="menu">
          ${SUPPORTED_LANGUAGES.map(
            (lang) => html`
              <div
                class="item no-padding"
                @click="${() => i18next.changeLanguage(lang)}"
              >
                <div class="item">
                  <ngm-core-icon
                    class="${classMap({
                      hidden:
                        i18next.language?.toUpperCase() !== lang?.toUpperCase(),
                    })}"
                    icon="checkmark"
                  ></ngm-core-icon>
                  <span>${lang.toUpperCase()}</span>
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  static readonly styles = css`
    ${unsafeCSS(fomanticTransitionCss)}
    ${unsafeCSS(fomanticDropdownCss)}

    .container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      width: 69px;

      padding: 8px 0;
      border-radius: 4px;
      color: var(--color-primary);
    }

    .container:hover {
      background-color: var(--color-secondary--hovered);
      color: var(--color-text--emphasis--medium);
    }

    .container.active ngm-core-icon[icon='dropdown'] {
      transform: rotate(180deg);
    }

    ngm-core-icon.hidden {
      visibility: hidden;
    }

    .title {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
    }

    .item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      ${applyTypography('button')}
    }

    .ui.dropdown .menu > .item.no-padding {
      padding: 0;
      width: 85px;
    }

    .item:hover {
      background-color: var(--color-tertiary--hovered);
    }

    .title .ngm-dropdown-icon {
      background-color: var(--color-highlight--darker);
      transform: rotate(90deg);
    }
  `;
}
