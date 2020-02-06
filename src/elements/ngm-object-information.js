import {LitElement, html} from 'lit-element';


class NgmObjectInformation extends LitElement {

  static get properties() {
    return {
      info: {type: Object},
      opened: {type: Boolean}
    };
  }

  constructor() {
    super();
    this.opened = true;

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.close();
      }
    });
  }

  close() {
    this.opened = false;
  }

  render() {
    return html`
      <div class="ui segment" ?hidden="${!this.opened}">
        <div class="header">
          <div style="flex: auto;"></div>
          <div class="ui horizontal link list">
            <a class="item" href="#"><i @click="${this.close}" class="times icon"></i></a>
          </div>
        </div>
        <table class="ui compact small very basic table">
          <tbody>
            ${this.info && Object.entries(this.info).map(([key, value]) => html`
              <tr class="top aligned">
                <td class="key">${key}</td>
                <td class="val">${value}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-object-information', NgmObjectInformation);
