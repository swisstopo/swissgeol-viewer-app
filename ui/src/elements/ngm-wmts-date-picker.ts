import { LitElementI18n } from '../i18n';
import { customElement, property, state } from 'lit/decorators.js';
import { html, PropertyValues } from 'lit';
import { dragArea } from './helperElements';
import draggable from './draggable';
import { LayerConfig } from '../layertree';
import i18next from 'i18next';
import { classMap } from 'lit/directives/class-map.js';
import MainStore from '../store/main';

@customElement('ngm-wmts-date-picker')
export class NgmWmtsDatePicker extends LitElementI18n {
  @property({ type: Object })
  accessor config: LayerConfig | undefined;
  @state()
  accessor dates: { title: string; value: string }[] | undefined;

  connectedCallback() {
    this.hidden = true;
    draggable(this, {
      allowFrom: '.drag-handle',
    });
    super.connectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('config')) {
      if (this.config?.wmtsTimes) {
        this.hidden = false;
        this.dates = this.config.wmtsTimes.map((t) => {
          let title = t;
          if (title.length > 4 && title !== 'current') {
            title = title.substring(0, 4);
          }
          if (title === '9999') {
            title = i18next.t('dtd_all_label');
          }
          return {
            title,
            value: t,
          };
        });
      } else {
        this.hidden = true;
        this.dates = undefined;
      }
    }
    super.updated(changedProperties);
  }

  onClose() {
    this.config = undefined;
  }

  render() {
    if (!this.dates || !this.config?.setVisibility) return '';
    return html` <div class="ngm-floating-window-header drag-handle">
        <div class="ngm-floating-window-header-title">
          ${this.config?.label}
        </div>
        <div class="ngm-close-icon" @click=${this.onClose}></div>
      </div>
      <div class="ngm-project-popup-content ngm-date-picker">
        ${this.dates.map(
          (d) =>
            html` <div
              class="ngm-label-btn ${classMap({
                active: d.value === this.config?.wmtsCurrentTime,
              })}"
              @click=${() => {
                if (!this.config?.setTime) return;
                this.config.setTime(d.value);
                MainStore.syncLayerParams.next();
                this.requestUpdate();
              }}
            >
              ${d.title}
            </div>`,
        )}
      </div>
      ${dragArea}`;
  }

  createRenderRoot() {
    return this;
  }
}
