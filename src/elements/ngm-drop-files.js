import {html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';

const cancel = event => event.preventDefault();

class NgmDropFiles extends LitElementI18n {

  static get properties() {
    return {
      target: {type: Object},
      active: {type: Boolean},
    };
  }

  constructor() {
    super();

    /**
     * @type {HTMLElement}
     */
    this.target;

    /**
     * @type {boolean}
     */
    this.active = false;

    this.onDragEnterFunction = this.onDragEnter.bind(this);
  }

  firstUpdated() {
    this.dimmer = this.querySelector('.ui.dimmer');
  }

  connectedCallback() {
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

  /**
   * @param {DragEvent} event
   */
  onDragEnter(event) {
    cancel(event);
    this.active = true;
  }

  /**
   * @param {DragEvent} event
   */
  onDragLeave(event) {
    if (event.target === this.dimmer) {
      cancel(event);
      this.active = false;
    }
  }

  /**
   * @param {DragEvent} event
   * @param {'toolbox'|'model'} type
   */
  onDrop(event, type) {
    cancel(event);
    this.active = false;
    for (const file of event.dataTransfer.files) {
      this.dispatchEvent(new CustomEvent('filedrop', {
        detail: {
          file,
          type
        }
      }));
    }
  }

  render() {
    return html`
      <div class="ui page dimmer ${classMap({active: this.active})}"
           @drop="${event => this.onDrop(event, 'model')}"
           @dragleave="${event => this.onDragLeave(event)}">
        <div class="content"><h1>${i18next.t('drop_file_models_message')}</h1></div>
      </div>
      <div class="ui page dimmer ${classMap({active: this.active})}"
           @drop="${event => this.onDrop(event, 'toolbox')}"
           @dragleave="${event => this.onDragLeave(event)}">
        <div class="content"><h1>${i18next.t('drop_file_toolbox_message')}</h1></div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-drop-files', NgmDropFiles);
