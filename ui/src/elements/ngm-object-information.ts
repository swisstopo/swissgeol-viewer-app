import { html } from 'lit';
import draggable from './draggable';
import i18next from 'i18next';
import { LitElementI18n } from '../i18n';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import QueryStore from '../store/query';
import { dragArea } from './helperElements';
import { customElement, property } from 'lit/decorators.js';
import type { QueryResult } from '../query/types';

@customElement('ngm-object-information')
export class NgmObjectInformation extends LitElementI18n {
  @property({ type: Object })
  accessor info: QueryResult | undefined;
  @property({ type: Boolean })
  accessor opened: boolean;

  constructor() {
    super();
    this.opened = false;
    this.hidden = !this.opened;

    QueryStore.objectInfo.subscribe((info) => {
      this.info = info;
      this.opened = !!info;
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.opened = false;
      }
    });
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle',
    });
    super.connectedCallback();
  }

  render() {
    this.hidden = !this.opened;
    if (
      this.info &&
      (this.info.popupItems?.length || this.info.properties?.length)
    ) {
      const content = this.info.popupItems?.length
        ? this.info.popupItems.map(
            (it) =>
              html` <div
                class="query-list-item"
                @mouseenter=${() => it.mouseEnter()}
                @mouseleave=${() => it.mouseLeave()}
              >
                <div class="item-zoom-btn-container" ?hidden="${!it.zoom}">
                  <button
                    @click="${it.zoom}"
                    class="ui button ngm-zoom-obj-btn ngm-action-btn"
                  >
                    ${i18next.t('obj_info_zoom_to_object_btn_label')}
                    <div class="ngm-zoom-plus-icon"></div>
                  </button>
                </div>
                ${unsafeHTML(it.content)}
              </div>`,
          )
        : html` <table class="ui compact small very basic table ngm-info-table">
            <tbody>
              ${this.info.properties!.map((row) => {
                const key = row[0];
                const value = row[1];
                if (typeof value === 'string' && value.startsWith('http')) {
                  return html`
                    <tr class="top aligned">
                      <td class="key">${i18next.t(`assets:${key}`)}</td>
                      <td class="value">
                        <a href="${value}" target="_blank" rel="noopener"
                          >${value.split('/').pop()}</a
                        >
                      </td>
                    </tr>
                  `;
                } else {
                  return html`
                    <tr class="top aligned">
                      <td class="key">
                        ${key.includes(' ') ? key : i18next.t(`assets:${key}`)}
                      </td>
                      <td class="value">${value}</td>
                    </tr>
                  `;
                }
              })}
            </tbody>
          </table>`;

      if (this.opened && this.info.onshow) {
        this.info.onshow();
      }
      if (!this.opened && this.info.onhide) {
        this.info.onhide();
      }

      return html`
        <div class="ngm-floating-window-header drag-handle">
          <div
            class="ngm-close-icon"
            @click=${() => (this.opened = false)}
          ></div>
        </div>
        <div class="htmlpopup-header" ?hidden="${!this.info.zoom}">
          <button
            @click="${this.info.zoom}"
            class="ui button ngm-zoom-obj-btn ngm-action-btn"
          >
            ${i18next.t('obj_info_zoom_to_object_btn_label')}
            <div class="ngm-zoom-plus-icon"></div>
          </button>
        </div>
        <div class="content-container">${content}</div>
        ${dragArea}
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
