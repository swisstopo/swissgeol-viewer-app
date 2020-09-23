import {LitElement, html} from 'lit-element';
import draggable from './draggable.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import {unsafeHTML} from 'lit-html/directives/unsafe-html';

class NgmObjectInformation extends I18nMixin(LitElement) {

  static get properties() {
    return {
      info: {type: Object},
      opened: {type: Boolean}
    };
  }

  constructor() {
    super();
    this.opened = false;

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.opened = false;
      }
    });
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.header'
    });
    super.connectedCallback();
  }

  filterInfo([key, value]) {
    return !(value instanceof Function);
  }

  render() {
    if (this.info) {
      let content = html`
        <table class="ui compact small very basic table">
        <tbody>
          ${Object.entries(this.info).filter(this.filterInfo).map(([key, value]) => html`
            <tr class="top aligned">
              <td class="key">${i18next.t(`assets:${key}`)}</td>
              <td class="val">${value}</td>
            </tr>
          `)}
          </tbody>
        </table>`;

      if (this.info.popupContent) {
        content = unsafeHTML(this.info.popupContent);
      }

      if (this.opened && this.info.onshow) {
        this.info.onshow();
      }
      if (!this.opened && this.info.onhide) {
        this.info.onhide();
      }

      return html`
        <div class="ui segment" ?hidden="${!this.opened}">
          <div class="header">
            <div class="ui horizontal link list">
              <a class="item" href="#"><i @click="${() => this.opened = false}" class="times icon"></i></a>
            </div>
            <div ?hidden="${!this.info.zoom}">
              <button @click="${this.info.zoom}" class="ui right floated mini basic labeled icon button">
                    <i class="search plus icon"></i>${i18next.t('zoom_to_object')}
              </button>
            </div>
          </div>
          <div class="ui divider"></div>
          <div class="content-container">
            ${content}
          </div>
        </div>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-object-information', NgmObjectInformation);
