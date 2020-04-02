import i18next from 'i18next';
import {I18nMixin} from '../i18n';
import {LitElement, html} from 'lit-element';

const popupId = 'ngm-navigation-info';

const t = a => a;
const infoConfig = [
  {
    title: t('info_tilt_label'),
    content: t('info_tilt')
  },
  {
    title: t('info_look_label'),
    content: t('info_look_key')
  },
  {
    title: t('info_zoom_label'),
    content: t('info_zoom_key')
  },
  {
    title: t('info_move_label'),
    content: t('info_move')
  },
  {
    title: t('info_move_forward_label'),
    content: t('info_move_forward')
  },
  {
    title: t('info_elevator_label'),
    content: t('info_elevator')
  }
];

class NgmKeyboardInfoPopup extends I18nMixin(LitElement) {
  closeInfoPopup() {
    document.getElementById(popupId).classList.toggle('visible');
  }

  get infoLineTemplate() {
    return infoConfig.map(value => html`
    <div class="row">
    <div class="column">
      <div>
        ${i18next.t(value.title)}:
        ${value.img ? html`<img src="${value.img}">` : ''}
      </div>
      <div>${i18next.t(value.content)}</div>
      </div>
    </div>`);
  }

  render() {
    return html`
    <button
      class="ui compact mini icon button"
      data-position="left center"
      data-variation="mini"
      data-tooltip=${i18next.t('info_btn')} @click=${this.closeInfoPopup}>
      <i class="keyboard icon"></i>
    </button>
    <div id=${popupId} class="ui basic popup left center">
      <div class="ui internally celled grid ngm-keyboard-info-content">
       ${this.infoLineTemplate}
      </div>
      <h4 class="ngm-keyboard-tip">${i18next.t('info_tip')}</h4>
    </div>`;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-keyboard-info-popup', NgmKeyboardInfoPopup);
