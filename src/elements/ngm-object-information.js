import {LitElement, html} from 'lit-element';
import draggable from './draggable.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

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

  updated() {
    if (!this.opened) {
      this.dispatchEvent(new CustomEvent('closed'));
    }
  }

  filterInfo([key, value]) {
    return !(value instanceof Function);
  }

  render() {
    if (this.info) {
      return html`
        <div class="ui segment" ?hidden="${!this.opened}">
          <div class="header">
            <div style="flex: auto;"></div>
            <div class="ui horizontal link list">
              <a class="item" href="#"><i @click="${() => this.opened = false}" class="times icon"></i></a>
            </div>
          </div>
          <table class="ui compact small very basic table">
            <tbody>
              ${Object.entries(this.info).filter(this.filterInfo).map(([key, value]) => html`
                <tr class="top aligned">
                  <td class="key">${key}</td>
                  <td class="val">${value}</td>
                </tr>
              `)}
            </tbody>
            <tfoot ?hidden="${!this.info.zoom}">
              <tr>
                <th colspan="2">
                  <button @click="${this.info.zoom}" class="ui right floated mini basic labeled icon button">
                    <i class="right arrow icon"></i>${i18next.t('zoom_to_object')}
                  </div>
                </th>
              </tr>
            </tfoot>
          </table>
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
