import {onAccordionClick} from "../utils.js";
import i18next from "i18next";
import {I18nMixin} from "../i18n.js";
import {html, LitElement} from "lit-element";
import './ngm-gst-interaction.js';


export function accordionElementFactory({title, content, BaseElement}) {
  return class extends BaseElement {
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

    createRenderRoot() {
      // no shadow dom
      return this;
    }
  };
}


export function setupWebComponents() {
  const GSTAccordion = accordionElementFactory({
    title: () => html`${i18next.t('gst_accordion_title')}`,
    content: () => html`<ngm-gst-interaction></ngm-gst-interaction>`,
    BaseElement: I18nMixin(LitElement)});

  customElements.define('ngm-gst-accordion', GSTAccordion);

}
