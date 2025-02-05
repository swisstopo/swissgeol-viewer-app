import {customElement, property} from 'lit/decorators.js';
import {CoreElement} from 'src/components/core';
import {css, html} from 'lit';
import i18next from 'i18next';
import {BackgroundLayer} from 'src/components/layer/layer.model';
import {applyTransition} from 'src/styles/theme';

@customElement('ngm-background-layer-item')
export class BackgroundLayerItem extends CoreElement {
  @property()
  accessor layer: BackgroundLayer | null = null;

  @property({type: Boolean, reflect: true, attribute: 'active'})
  accessor isActive: boolean = false;

  @property({type: String, reflect: true})
  accessor size: Size = 'normal';

  render() {
    if (this.layer == null) {
      return;
    }
    return html`
      <img
        src="${this.layer.imagePath}"
        alt="${i18next.t(this.layer.label)}"
        loading="eager"
        width="40"
        height="40"
      >
    `;
  }

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      --size: 42px;

      display: block;
      width: var(--size);
      height: var(--size);
    }
    :host([size="large"]) {
      --size: 52px;
    }

    img {
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      border: 2px solid transparent;

      ${applyTransition('fade')};
      transition-property: border-color;
    }

    :host([active]) img {
      border-color: var(--color-primary--active);
    }
  `;
}

type Size =
  | 'normal'
  | 'large'
