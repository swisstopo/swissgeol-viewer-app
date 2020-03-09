import {onAccordionClick} from '../utils.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import {html, LitElement} from 'lit-element';
import './ngm-gst-interaction.js';


export function accordionElementFactory({title, content, fup}) {
  return class extends I18nMixin(LitElement) {
    render() {
      return html`
      <div class="ui styled accordion">
        <div class="title" @click=${onAccordionClick}>
          <i class="dropdown icon"></i>
          ${title()}
        </div>
        <div class="content">
          ${content()}
        </div>
      </div></div>`;
    }

    firstUpdated() {
      fup(this);
      super.firstUpdated();
    }

    createRenderRoot() {
      // no shadow dom
      return this;
    }
  };
}


export function setupWebComponents(viewer) {
  const GSTAccordion = accordionElementFactory({
    title: () => html`${i18next.t('gst_accordion_title')}`,
    content: () => html`<ngm-gst-interaction></ngm-gst-interaction>`,
    fup: instance => instance.querySelector('ngm-gst-interaction').viewer = viewer
  });

  customElements.define('ngm-gst-accordion', GSTAccordion);
}
