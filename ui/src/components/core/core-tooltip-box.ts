import {css, html, LitElement} from 'lit';
import {customElement} from 'lit/decorators.js';
import './core-icon';
import {applyEffect, applyTransition} from 'src/styles/theme';

@customElement('ngm-core-tooltip-box')
export class CoreTooltipBox extends LitElement {
  show(): void {
    this.classList.remove('is-hidden');
    setTimeout(() => {
      this.classList.add('is-visible');
    });
  }

  hide(): void {
    this.classList.remove('is-visible');
    setTimeout(() => {
      this.classList.add('is-hidden');
    }, 250);
  }

  readonly render = () => html``;

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;

      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 5px 8px;
      pointer-events: none;
      border-radius: 4px;
      z-index: 10;

      background-color: var(--color-text--emphasis--high);
      color: var(--color-text--invert);

      ${applyEffect('overlay-shadow')};
    }

    :host {
      ${applyTransition('fade')};
      transition-property: opacity;
    }

    :host(.is-hidden) {
      display: none;
    }

    :host(:not(.is-visible)) {
      opacity: 0;
    }
  `;
}

export type Variant =
  | 'default'
  | 'text'
