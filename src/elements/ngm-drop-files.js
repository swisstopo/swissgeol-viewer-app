import {html, css} from 'lit-element';

import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';

const cancel = event => event.preventDefault();

class NgmDropFiles extends LitElementI18n {

  static get properties() {
    return {
      target: {type: String},
    };
  }

  static get styles() {
    return css`

    `;
  }

  firstUpdated() {
    this.dimmer = this.querySelector('.ui.dimmer');
    const target = document.querySelector(this.target);
    target.addEventListener('dragover', cancel, false);
    target.addEventListener('dragenter', event => this.onDragEnter(event), false);
    // dragleave and drop events are triggered by the dimmer
  }

  onDragEnter(event) {
    cancel(event);
    this.dimmer.classList.add('active');
  }
  onDragLeave(event) {
    if (event.target === this.dimmer) {
      cancel(event);
      this.dimmer.classList.remove('active');
    }
  }
  onDrop(event) {
    cancel(event);
    this.dimmer.classList.remove('active');
    for (const file of event.dataTransfer.files) {
      this.dispatchEvent(new CustomEvent('filedrop', {
        detail: {
          file
        }
      }));
    }
  }

  render() {
    return html`
      <div class="ui page dimmer" @drop="${event => this.onDrop(event)}" @dragleave="${event => this.onDragLeave(event)}">
        <div class="content"><h1>${i18next.t('drop_file_message')}</h1></div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-drop-files', NgmDropFiles);
