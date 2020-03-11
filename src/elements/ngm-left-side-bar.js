import {LitElement, html} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import {onAccordionClick} from '../utils.js';
import i18next from 'i18next';
import AreaOfInterestDrawer from '../areaOfInterest/AreaOfInterestDrawer.js';

class LeftSideBar extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
    };
  }

  updated() {
    if (this.viewer && !this.aoiDrawer) {
      this.aoiDrawer = new AreaOfInterestDrawer(this.viewer);
    }
  }


  render() {
    if (!this.viewer) {
      return '';
    }
    return html`
    <div class="left sidebar">
      <div class="ui styled accordion" id="layers"></div>
      <div id="areasOfInterest" class="ui styled accordion"></div>
      <div class="ui styled accordion">
        <div class="title" @click=${onAccordionClick}>
          <i class="dropdown icon"></i>
          ${i18next.t('gst_accordion_title')}
        </div>
        <div class="content">
          <ngm-gst-interaction .viewer=${this.viewer}></ngm-gst-interaction>,
        </div>
      </div>
    `;
  }
  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-left-side-bar', LeftSideBar);
