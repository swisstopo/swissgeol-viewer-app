import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  applyEffect,
  applyTransition,
  applyTypography,
} from 'src/styles/theme';

const some: boolean = true;

@customElement('ngm-core-button')
export class CoreButton extends LitElement {
  @property({ reflect: true })
  accessor variant: Variant = 'primary';

  @property({ reflect: true })
  accessor shape: Shape = 'default';

  @property({ type: Boolean, attribute: 'disabled', reflect: true })
  accessor isDisabled: boolean = false;

  @property({ type: Boolean, attribute: 'active', reflect: true })
  accessor isActive: boolean = false;

  set test(bool) {
    this.shape = bool;
  }

  get test() {
    return this.shape;
  }

  static readonly styles = css`
    button {
      ${applyTypography('button')};

      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border: 1px solid;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;

      ${applyTransition('fade')};
      transition-property: color, background-color, border-color;
    }

    ::slotted(ngm-core-icon) {
      width: 20px;
      height: 20px;
    }

    /** large */
    :host([shape='large']) button {
      padding: 12px 16px;
    }

    :host([shape='large']) ::slotted(ngm-core-icon) {
      width: 24px;
      height: 24px;
    }

    /* primary */
    :host([variant='primary']) button {
      color: var(--color-text--invert);
      background-color: var(--color-primary);
      border-color: var(--color-primary);

      &:hover,
      &:focus {
        background-color: var(--color-primary--hovered);
        border-color: var(--color-primary--hovered);
      }

      &:focus {
        ${applyEffect('focus')};
      }

      &:active {
        background-color: var(--color-primary--pressed);
        border-color: var(--color-primary--pressed);
      }

      &[disabled] {
        background-color: var(--color-primary--disabled);
        border-color: var(--color-primary--disabled);
      }
    }

    :host([variant='primary'][active]) button:not([disabled]) {
      color: var(--color-text--invert);
      background-color: var(--color-primary--active);
      border-color: var(--color-primary--active);
    }

    /* secondary */
    :host([variant='secondary']) button {
      color: var(--color-primary);
      background-color: var(--color-secondary);
      border-color: var(--color-primary);

      &:hover,
      &:focus {
        color: var(--color-text--emphasis--medium);
        background-color: var(--color-secondary--hovered);
        border-color: var(--color-text--emphasis--medium);
      }

      &:focus {
        ${applyEffect('focus')};
      }

      &:active {
        color: var(--color-text--emphasis--medium);
        background-color: var(--color-secondary--pressed);
        border-color: var(--color-secondary--pressed);
      }

      &[disabled] {
        color: var(--color-bg--disabled);
        background-color: var(--color-secondary--disabled);
        border-color: var(--color-bg--disabled);
      }
    }

    :host([variant='secondary'][active]) button:not([disabled]) {
      background-color: var(--color-secondary--active);
      border-color: var(--color-secondary--active);
    }

    /* tertiary */
    :host([variant='tertiary']) button {
      color: var(--color-primary);
      background-color: var(--color-bg--white);
      border-color: var(--color-bg--white);

      &:hover,
      &:focus {
        color: var(--color-text--emphasis--medium);
        background-color: var(--color-secondary--hovered);
        border-color: var(--color-secondary--hovered);
      }

      &:focus {
        ${applyEffect('focus')};
      }

      &:active {
        color: var(--color-text--emphasis--medium);
        background-color: var(--color-secondary--pressed);
        border-color: var(--color-secondary--pressed);
      }

      &[disabled] {
        color: var(--color-bg--disabled);
        background-color: var(--color-secondary--disabled);
        border-color: var(--color-secondary--disabled);
      }
    }

    :host([variant='tertiary'][active]) button:not([disabled]) {
      background-color: var(--color-secondary--active);
      border-color: var(--color-secondary--active);
    }

    /* icon shape */
    :host([shape='icon']) button,
    :host([shape='icon-round']) button {
      padding: 8px;
    }
  `;

  readonly render = () => html`
    <button ?disabled="${this.isDisabled}">
      <slot></slot>
    </button>
  `;
}

export type Variant = 'primary' | 'secondary' | 'tertiary';

export type Shape = 'default' | 'large' | 'icon' | 'icon-round';
