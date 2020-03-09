import {LitElement, html} from 'lit-element';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import {cartesiantoDegrees, degreesToLv95, round} from '../projection.js';
import {crossSection, getCrossSectionUrl} from '../gst.js';
import {showError} from '../message.js';

class NgmGstInteraction extends LitElement {

  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  updated() {
    if (!this.draw_ && this.viewer) {
      this.draw_ = new CesiumDraw(this.viewer, 'line');
      this.draw_.addEventListener('drawstart', () => this.draw_.clear());
      this.draw_.addEventListener('drawend', (event) => this.getCrossSection(event.detail.positions));
    }
  }

  getCrossSection(positions) {
    const coordinates = positions.map(cartesiantoDegrees).map(degreesToLv95).map(round);
    if (this.draw_.type === 'line') {
      // FIXME: temporary
      window.open(getCrossSectionUrl(coordinates), '_blank');
      this.viewer.canvas.style.cursor = 'wait';
      crossSection(coordinates)
        .then(json => {
          console.log(json);
        })
        .catch(err => {
          showError(`${err.name}: ${err.message}`);
        })
        .finally(() => {
          this.viewer.canvas.style.cursor = 'default';
        });
    }

  }

  changeTool(event, type) {
    this.querySelectorAll('button').forEach(button => button.classList.remove('active'));

    this.draw_.clear();
    this.viewer.scene.requestRender();

    if (this.draw_.active && this.draw_.type === type) {
      // tool is already active, turn it off
      this.draw_.active = false;
      event.currentTarget.classList.remove('active');
    } else {
      this.draw_.type = type;
      this.draw_.active = true;
      event.currentTarget.classList.add('active');
    }
  }

  toggleCrossSection(event) {
    this.changeTool(event, 'line');
  }

  toggleHorizontalCrossSection(event) {
    this.changeTool(event, 'polygon');
  }

  render() {
    return html`
      <div class="ui segment">
        <div class="ui icon buttons">
          <button class="ui button" @click="${this.toggleCrossSection}"><i class="map outline icon"></i></button>
          <button class="ui button" @click="${this.toggleHorizontalCrossSection}"><i class="map icon"></i></button>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-gst-interaction', NgmGstInteraction);
