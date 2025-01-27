import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { BaseLayerConfig } from '../viewer';

@customElement('ngm-map-chooser')
export class NgmMapChooser extends LitElement {
  @property({ type: Array })
  accessor choices: BaseLayerConfig[] = [];
  @property({ type: Object })
  accessor active: BaseLayerConfig | undefined = undefined;
  @property({ type: Boolean })
  accessor initiallyOpened = true;
  @state()
  accessor open = true;

  protected firstUpdated() {
    this.open = this.initiallyOpened;
  }

  updated() {
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          active: this.active,
        },
      }),
    );
  }

  getMapTemplate(mapConfig) {
    if (!mapConfig) return '';
    return html` <div
      class="ngm-map-preview ${classMap({
        active: !!(this.active && mapConfig.id === this.active.id),
      })}"
      @click=${() => (this.active = mapConfig)}
    >
      <img src=${mapConfig.backgroundImgSrc} />
    </div>`;
  }

  render() {
    return html` <div class="ngm-maps-container" .hidden=${!this.open}>
        ${this.choices.map((c) => this.getMapTemplate(c))}
        <div class="ngm-close-icon" @click=${() => (this.open = false)}></div>
      </div>
      <div
        class="ngm-selected-map-container"
        .hidden=${this.open}
        @click=${() => (this.open = true)}
      >
        ${this.getMapTemplate(this.active)}
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
