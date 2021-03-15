import {html} from 'lit-element';

import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';

const cancel = event => event.preventDefault();

class NgmDropFiles extends LitElementI18n {

  static get properties() {
    return {
      target: {type: Object},
    };
  }

  constructor() {
    super();

    /**
     * @type {HTMLElement}
     */
    this.target;

    this.onDragEnterFunction = this.onDragEnter.bind(this);
  }

  connectedCallback() {
    this.dimmer = this.querySelector('.ui.dimmer');
    this.target.addEventListener('dragover', cancel, false);
    this.target.addEventListener('dragenter', this.onDragEnterFunction, false);
    // dragleave and drop events are triggered by the dimmer
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.target.removeEventListener('dragover', cancel, false);
    this.target.removeEventListener('dragenter', this.onDragEnterFunction, false);
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
