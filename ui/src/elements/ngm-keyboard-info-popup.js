import i18next from 'i18next';
import { LitElementI18n } from '../i18n';
import { html } from 'lit';
import $ from 'jquery';

import 'fomantic-ui-css/components/popup.js';

const popupId = 'ngm-navigation-info';
const btnId = 'ngm-navigation-info-btn';

const t = (a) => a;
const infoConfig = [
  {
    title: t('nav_info_tilt_label'),
    content: t('nav_info_tilt'),
  },
  {
    title: t('nav_info_look_label'),
    content: t('nav_info_look_key'),
  },
  {
    title: t('nav_info_zoom_label'),
    content: t('nav_info_zoom_key'),
  },
  {
    title: t('nav_info_move_label'),
    content: t('nav_info_move'),
  },
  {
    title: t('nav_info_move_forward_label'),
    content: t('nav_info_move_forward'),
  },
  {
    title: t('nav_info_elevator_label'),
    content: t('nav_info_elevator'),
  },
];

// todo remove or reuse
class NgmKeyboardInfoPopup extends LitElementI18n {
  updated() {
    if (!this.popupInitialized && i18next.language) {
      $(`#${btnId}`).popup({
        position: 'left center',
        content: i18next.t('nav_info_btn_hint'),
        variation: 'mini',
        onShow: () => {
          if (this.querySelector(`#${popupId}`).classList.contains('visible')) {
            return false;
          }
        },
      });
      $(this).popup({
        popup: $(`#${popupId}`),
        on: 'click',
        closable: false,
        onShow: () => this.toggleInfoPopup(),
        onHide: () => this.toggleInfoPopup(false),
        position: 'left center',
      });
      this.popupInitialized = true;
    }
  }

  toggleInfoPopup(show = true) {
    const buttonClassList = this.querySelector(`#${btnId}`).classList;
    if (show) {
      buttonClassList.add('grey');
      $(`#${btnId}`).popup('hide');
      return;
    }
    buttonClassList.remove('grey');
  }

  get infoLineTemplate() {
    return infoConfig.map(
      (value) =>
        html` <div class="row">
          <div>${i18next.t(value.title)}:</div>
          <div>${i18next.t(value.content)}</div>
        </div>`,
    );
  }

  render() {
    return html` <button id=${btnId} class="ui compact mini icon button">
        <i class="keyboard icon"></i>
      </button>
      <div id=${popupId} class="ui popup">
        <h4>${i18next.t('nav_info_popup_label')}</h4>
        <div class="ngm-keyboard-info-content">
          <div class="ngm-keyboard-layout"></div>
          ${this.infoLineTemplate}
        </div>
        <h4 class="ngm-keyboard-tip">${i18next.t('nav_info_tip')}</h4>
      </div>`;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-keyboard-info-popup', NgmKeyboardInfoPopup);
