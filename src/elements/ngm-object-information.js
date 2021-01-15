import {html} from 'lit-element';
import draggable from './draggable.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {unsafeHTML} from 'lit-html/directives/unsafe-html';

class NgmObjectInformation extends LitElementI18n {

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

  render() {
    if (this.info && (this.info.popupContent || this.info.properties)) {
      const content = this.info.popupContent ?
        unsafeHTML(this.info.popupContent) :
        html`
          <table class="ui compact small very basic table">
            <tbody>
            ${this.info.properties.map(row => {
              const key = row[0];
              const value = row[1];
              if ((typeof value === 'string') && (value.startsWith('http'))) {
                return html`
                  <tr class="top aligned">
                    <td class="key">${i18next.t(`assets:${key}`)}</td>
                    <td class="val"><a href="${value}" target="_blank" rel="noopener">${value.split('/').pop()}</a></td>
                  </tr>
                `;
              } else {
                return html`
                  <tr class="top aligned">
                    <td class="key">${i18next.t(`assets:${key}`)}</td>
                    <td class="val">${value}</td>
                  </tr>
                `;
              }
            })}
            </tbody>
          </table>`;

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
                <i class="search plus icon"></i>${i18next.t('obj_info_zoom_to_object_btn_label')}
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
