import {LitElementI18n} from '../i18n';
import {customElement, property} from 'lit/decorators.js';
import {html, PropertyValues} from 'lit';
import {dragArea} from './helperElements';
import draggable from './draggable';
import {LayerConfig} from '../layertree';

@customElement('ngm-wmts-date-picker')
export class NgmWmtsDatePicker extends LitElementI18n {
    @property({type: Object})
    accessor config: LayerConfig | undefined;

    connectedCallback() {
        this.hidden = true;
        draggable(this, {
            allowFrom: '.drag-handle'
        });
        super.connectedCallback();
    }

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has('config')) {
            if (this.config) {
                this.hidden = false;
            } else {
                this.hidden = true;
            }
        }
        super.updated(changedProperties);
    }

    onClose() {
        this.config = undefined;
    }

    render() {
        if (!this.config?.wmtsTimes) return '';
        return html`
      <div class="ngm-floating-window-header drag-handle">
        <div class="ngm-floating-window-header-title">${this.config?.label}</div>
        <div class="ngm-close-icon" @click=${this.onClose}></div>
      </div>
      <div class="ngm-project-popup-content ngm-date-picker">
          ${this.config.wmtsTimes.map(d => html`
              <div class="ngm-label-btn"
                   @click=${() => {}}>
                  ${d}
              </div>`)}
      </div>
      ${dragArea}`;
    }

    createRenderRoot() {
        return this;
    }
}
