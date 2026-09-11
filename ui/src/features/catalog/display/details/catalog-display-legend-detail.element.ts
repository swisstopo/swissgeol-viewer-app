import { css, html, nothing } from 'lit';
import { until } from 'lit/directives/until.js';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, property, state } from 'lit/decorators.js';
import i18next from 'i18next';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { CoreElement } from 'src/features/core';
import { InfoBoxCustom, InformationValue, Layer } from 'src/features/layer';
import { run } from 'src/utils/fn.utils';
import { Id } from 'src/models/id.model';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';

@customElement('ngm-catalog-display-info-box-detail')
export class CatalogDisplayInfoBox extends CoreElement {
  @property()
  accessor layerId!: Id<Layer>;

  @state()
  accessor layer!: Layer;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @property({ type: Boolean })
  accessor shortenInfoText = true;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
      }),
    );
  }

  render() {
    const infoBox = this.layer.infoBox;
    if (infoBox === null) {
      return nothing;
    }

    switch (infoBox.source) {
      case 'api3.geo.admin.ch':
        return html` <div class="legend-html">${this.renderWmsLegend()}</div> `;
      case 'custom':
        return html`
          <div class="info-box-content">
            ${this.renderTitle()} ${this.renderInfoText()}
            <br />
            <span>${i18next.t('layers:info_box.labels.legend')}</span>
            ${this.renderLegend()}
            <br />
            <span>${i18next.t('layers:info_box.labels.information')}</span>
            ${this.renderInformation(infoBox)}
          </div>
        `;
    }
  }

  private readonly extendInfoText = () => {
    this.shortenInfoText = false;
  };

  private readonly renderTitle = () => {
    const titleKey = `layers:info_box.layers.${this.layer.id}.title`;
    const title = i18next.t(titleKey);
    if (title === titleKey) {
      return nothing;
    }

    return html`<p class="bod-title">${title}</p>`;
  };

  private readonly renderInfoText = () => {
    const key = `layers:info_box.layers.${this.layer.id}.description`;
    const text = i18next.t(key);
    if (text === key) {
      return nothing;
    }
    return html`<p
        class="info-text ${classMap({
          'shorten-info-text': this.shortenInfoText,
        })}"
      >
        ${text}
      </p>
      ${
        this.shortenInfoText
          ? html`<span @click=${this.extendInfoText} class="extend-info-text">
              ${i18next.t('layers:info_box.labels.extendInfoText')}
            </span>`
          : nothing
      }`;
  };

  private readonly renderLegend = () => {
    const imageKey = `layers:info_box.layers.${this.layer.id}.legend_image_url`;
    const linkKey = `layers:info_box.layers.${this.layer.id}.legend_link_url`;
    const imageUrl = i18next.t(imageKey);
    const linkUrl = i18next.t(linkKey);
    if (!imageUrl) {
      return nothing;
    }
    return html`
      <div class="info-url">
        <a href="${linkUrl ?? imageUrl}" target="_blank" rel="noopener">
          <img
            src="${imageUrl}"
            alt="info-box-legend"
            class="info-box-legend"
          />
        </a>
      </div>
    `;
  };

  private readonly renderInformation = (infoBox: InfoBoxCustom) => {
    const informationEntries = infoBox.information ?? [];
    if (informationEntries.length === 0) {
      return nothing;
    }
    return html`
      <table class="info-table">
        ${informationEntries.map(
          ({ labelKey, value }) => html`
            <tr>
              <td
                class="info-key"
                title=${this.getInformationKeyTitle(labelKey)}
              >
                ${this.getInformationKeyTitle(labelKey)}
              </td>
              <td
                class="info-value"
                title=${this.getInformationValueContent(value).label}
              >
                ${this.renderInformationValue(value)}
              </td>
            </tr>
          `,
        )}
      </table>
    `;
  };

  private readonly getInformationKeyTitle = (key: string): string => {
    return i18next.t(`layers:info_box.information.${key}`);
  };

  private readonly getInformationValueContent = (
    value: InformationValue,
  ): { url: string | null; label: string } => {
    if (typeof value === 'string') {
      return { url: null, label: i18next.t(value) };
    }

    let url = value.url;
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = i18next.t(`layers:info_box.information.${url}`);
    }

    const label = i18next.t(`layers:info_box.information.${value.key}`);
    return { url, label };
  };

  private readonly renderInformationValue = (value: InformationValue) => {
    const { url, label } = this.getInformationValueContent(value);
    if (!url) {
      return html`${label}`;
    }
    return html`<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
  };

  private readonly renderWmsLegend = () => {
    const htmlPromise = run(async () => {
      const response = await fetch(
        `https://api3.geo.admin.ch/rest/services/api/MapServer/${this.layer.id}/legend?lang=${i18next.language}`,
      );
      const text = await response.text();
      return html`<div class="html-legend">${unsafeHTML(text)}</div>`;
    });
    return until(htmlPromise, html`<div class="ui loader"></div>`);
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      --width: 370px;
      --table-col1-width: 200px;
      --table-col2-width: calc(var(--width) - var(--table-col1-width));

      user-select: text;
      width: var(--width);
    }

    .html-legend,
    .info-box-content {
      .bod-title {
        margin-top: 0;
      }

      span,
      p.bod-title {
        font-weight: bold;
        font-size: 14px;
      }

      a {
        display: block;
        img {
          width: 220px;
        }
      }

      table {
        border-collapse: collapse;
        border-spacing: 0;

        td {
          height: 44px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: var(--table-col2-width);

          a {
            max-width: var(--table-col2-width);
            color: #357183;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        td:first-child {
          padding-right: 16px;
          font-weight: 500;
          width: var(--table-col1-width);
          max-width: var(--table-col1-width);
          border-right: 1px solid var(--color-main);
        }
        td:not(:first-child) {
          padding-left: 16px;
        }

        tr:not(:first-child) {
          border-top: 1px solid var(--color-border--default);
        }
      }

      br + span {
        display: inline-block;
        border-top: 1px solid #e0e2e6;
        padding: 20px 0;
        width: 100%;
      }
    }

    .info-box-content {
      display: flex;
      flex-direction: column;

      .info-text.shorten-info-text {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        overflow: hidden;
      }

      .extend-info-text {
        color: #357183;
        text-decoration: underline;
        align-self: flex-end;
        margin-top: -15px;
        cursor: pointer;
      }
    }
  `;
}
