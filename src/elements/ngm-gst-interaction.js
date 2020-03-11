import {LitElement, html} from 'lit-element';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import {degreesToLv95, round} from '../projection.js';
import {borehole, verticalCrossSection, horizontalCrossSection} from '../gst.js';
import {showError} from '../message.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

import './ngm-gst-modal.js';

const CSS_ACTIVE_CLASS = 'grey';

class NgmGstInteraction extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  updated() {
    if (!this.draw_ && this.viewer) {
      this.draw_ = new CesiumDraw(this.viewer, 'line');
      this.draw_.addEventListener('drawstart', () => this.draw_.clear());
      this.draw_.addEventListener('drawend', (event) => this.getGST(event.detail.positions));
    }
  }

  getGST(positions) {
    let promise;
    if (this.draw_.type === 'point') {
      promise = borehole;
    } else if (this.draw_.type === 'line') {
      promise = verticalCrossSection;
    } else if (this.draw_.type === 'rectangle') {
      promise = horizontalCrossSection;
    }
    this.loading = true;
    const coordinates = positions.map(degreesToLv95).map(round);
    promise(coordinates)
      .then(json => {
        this.imageUrl = json.imageUrl;
        this.requestUpdate();
      })
      .catch(err => showError(`${err.name}: ${err.message}`))
      .finally(() => this.loading = false);
  }

  set loading(loading) {
    const buttons = this.querySelectorAll('button');
    if (loading) {
      this.viewer.canvas.style.cursor = 'wait';
      buttons.forEach(button => button.classList.add('disabled'));
    } else {
      this.viewer.canvas.style.cursor = 'default';
      buttons.forEach(button => button.classList.remove('disabled'));
    }
    this.draw_.active = !loading;
  }

  changeTool(event, type) {
    this.querySelectorAll('button').forEach(button => button.classList.remove(CSS_ACTIVE_CLASS));

    this.draw_.clear();
    this.viewer.scene.requestRender();

    if (this.draw_.active && this.draw_.type === type) {
      // tool is already active, turn it off
      this.draw_.active = false;
      event.currentTarget.classList.remove(CSS_ACTIVE_CLASS);
    } else {
      this.draw_.type = type;
      this.draw_.active = true;
      event.currentTarget.classList.add(CSS_ACTIVE_CLASS);
    }
  }

  toggleBoreHole(event) {
    this.changeTool(event, 'point');
  }

  toggleCrossSection(event) {
    this.changeTool(event, 'line');
  }

  toggleHorizontalCrossSection(event) {
    this.changeTool(event, 'rectangle');
  }

  render() {
    return html`
      <div class="ui tiny icon buttons">
        <button class="ui button" @click="${this.toggleBoreHole}"
          data-tooltip=${i18next.t('Borehole')}
          data-position="top center"
          data-variation="mini"
        >
          <i class="ruler vertical icon"></i>
        </button>
        <button class="ui button" @click="${this.toggleCrossSection}"
          data-tooltip=${i18next.t('Vertical cross sections')}
          data-position="top center"
          data-variation="mini"
        >
          <i class="map icon"></i>
        </button>
        <button class="ui button" @click="${this.toggleHorizontalCrossSection}"
          data-tooltip=${i18next.t('Horizontal cross sections')}
          data-position="top center"
          data-variation="mini"
        >
          <i class="horizontal-layer svg-icon icon"></i>
        </button>
      </div>
      <ngm-gst-modal .imageUrl="${this.imageUrl}"></ngm-gst-modal>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-gst-interaction', NgmGstInteraction);
