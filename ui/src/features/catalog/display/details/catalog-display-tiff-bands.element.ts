import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { applyTypography } from 'src/styles/theme';
import {
  getLayerAttributeName,
  LayerService,
  TiffLayer,
  TiffLayerBand,
} from 'src/features/layer';
import i18next from 'i18next';
import { Id } from 'src/models/id.model';
import { consume } from '@lit/context';

@customElement('catalog-display-layer-tiff-bands')
export class LayerTiffBands extends CoreElement {
  @property()
  accessor layerId!: Id<TiffLayer>;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor layer!: TiffLayer;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
      }),
    );
  }

  private readonly activateBand = (index: number): void => {
    this.layerService.update(this.layerId, { bandIndex: index });
  };

  readonly render = () => html`
    <ul>
      ${repeat(this.layer.bands, (band) => band.index, this.renderBand)}
    </ul>
    ${this.renderLegend()}
  `;

  private readonly renderBand = (band: TiffLayerBand, index: number) => {
    const name = getLayerAttributeName(this.layer, band.name);
    const [unitSymbol, unitName] =
      band.unit === null
        ? [null, null]
        : [
            `[${i18next.t(`layers:units.${band.unit}.symbol`)}]`,
            i18next.t(`layers:units.${band.unit}.name`),
          ];
    return html`
      <li>
        <ngm-core-radio
          title="${unitSymbol === null ? name : `${name} ${unitSymbol}`}"
          .isActive="${this.layer.bandIndex === index}"
          ?disabled="${band.display === null}"
          @click="${() => this.activateBand(index)}"
        >
          <span class="text">
            ${name}
            ${
              unitSymbol === null
                ? ''
                : html` <span title="${unitName}">${unitSymbol}</span> `
            }
          </span>
        </ngm-core-radio>
      </li>
    `;
  };

  private readonly renderLegend = () => {
    const band = this.layer.bands[this.layer.bandIndex];
    if (band.display === null) {
      return null;
    }
    return html`
      <catalog-display-tiff-legend
        .layer="${this.layer}"
        .band="${band}"
        .display="${band.display}"
      ></catalog-display-tiff-legend>
    `;
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      width: 420px;
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: 12px;

      list-style: none;
      padding: 0;
      margin: 0;
      width: calc(100% - 161px);

      ${applyTypography('body-2')};
      color: var(--color-primary);
    }

    ul > li {
      display: flex;
      height: 24px;
      align-items: center;
    }

    .text {
      display: inline-block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 200px;
    }
  `;
}
