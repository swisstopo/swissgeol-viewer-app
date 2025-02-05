import {css} from 'lit';
import {customElement} from 'lit/decorators.js';
import './core-icon';
import {applyEffect} from 'src/styles/theme';
import {CoreBasePopupBox} from 'src/components/core/base/core-base-popup-box';

@customElement('ngm-core-tooltip-box')
export class CoreTooltipBox extends CoreBasePopupBox {
  static readonly styles = css`
    ${CoreBasePopupBox.styles}

    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 5px 8px;
      pointer-events: none;
      border-radius: 4px;
      z-index: 10;

      background-color: var(--color-text--emphasis-high);
      color: var(--color-text--invert);

      ${applyEffect('overlay-shadow')};
    }
  `;
}
