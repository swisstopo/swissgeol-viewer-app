import { LitElementI18n } from '../i18n';
import i18next from 'i18next';
import { html } from 'lit';
import 'fomantic-ui-css/components/accordion.js';
import $ from 'jquery';

export class NgmSlowLoading extends LitElementI18n {
  firstUpdated() {
    $(this.querySelector('.accordion')).accordion({
      duration: 150,
    });
  }

  render() {
    return html`
      <div class="ui inverted segment">
        <div class="ui inverted accordion">
          <div class="title">
            <i class="dropdown icon"></i>
            ${i18next.t('slow_connection_label')}
          </div>
          <div class="content active}">
            <p>${i18next.t('slow_connection_text')}</p>
            <p>${i18next.t('slow_connection_text_2')}</p>
            <ul>
              <li>
                Edge (${i18next.t('slow_connection_latest_stable_version')})
              </li>
              <li>
                Chrome (${i18next.t('slow_connection_latest_stable_version')})
              </li>
              <li>
                Safari (${i18next.t('slow_connection_latest_stable_version')})
              </li>
              <li>
                Firefox (${i18next.t('slow_connection_latest_stable_version')})
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-slow-loading', NgmSlowLoading);
