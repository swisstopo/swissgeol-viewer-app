import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {applyEffect, applyTransition, applyTypography} from 'src/styles/theme';


@customElement('ngm-core-button')
export class CoreButton extends LitElement {
  @property({reflect: true})
  accessor variant: Variant = 'primary'

  @property({reflect: true})
  accessor shape: Shape = 'default'

  @property({reflect: true})
  accessor justify: Justify = 'center'

  @property({type: Boolean, attribute: 'disabled', reflect: true})
  accessor isDisabled: boolean = false

  @property({type: Boolean, attribute: 'active', reflect: true})
  accessor isActive: boolean = false

  @property({type: Boolean, attribute: 'transparent', reflect: true})
  accessor isTransparent: boolean = false

  readonly render = () => html`
    <button ?disabled="${this.isDisabled}">
      <slot></slot>
    </button>
  `;

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      width: fit-content;
      height: fit-content;
    }

    /*
       SIZING - PADDINGS AND BORDER
       ============================

       Every variant and shape defined here has a border of exactly 1px.
       Due to this, paddings are 1px less then they are defined as in the Figma.
     */

    button {
      ${applyTypography('button')};

      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 11px;
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

    :host([shape="large"]) button {
      padding: 11px 15px;
    }

    :host([shape="large"]) ::slotted(ngm-core-icon) {
      width: 24px;
      height: 24px;
    }

    /* primary */

    :host([variant="primary"]) button {
      color: var(--color-text--invert);
      background-color: var(--color-primary);
      border-color: var(--color-primary);

      &:hover, &:focus {
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

    :host([variant="primary"][active]) button:not([disabled]) {
      color: var(--color-text--invert);
      background-color: var(--color-primary--active);
      border-color: var(--color-primary--active);
    }

    /* secondary */

    :host([variant="secondary"]) button {
      color: var(--color-primary);
      background-color: var(--color-secondary);
      border-color: var(--color-primary);

      &:hover, &:focus {
        color: var(--color-text--emphasis-medium);
        background-color: var(--color-secondary--hovered);
        border-color: var(--color-text--emphasis-medium);
      }

      &:focus {
        ${applyEffect('focus')};
      }

      &:active {
        color: var(--color-text--emphasis-medium);
        background-color: var(--color-secondary--pressed);
        border-color: var(--color-secondary--pressed);
      }

      &[disabled] {
        color: var(--color-bg--disabled);
        background-color: var(--color-secondary--disabled);
        border-color: var(--color-bg--disabled);
      }
    }

    :host([variant="secondary"][active]) button:not([disabled]) {
      color: var(--color-text--emphasis-medium);
      background-color: var(--color-secondary--active);
      border-color: var(--color-secondary--active);
    }


    /* tertiary */
    :host([variant="tertiary"]) button {
      color: var(--color-primary);
      background-color: var(--color-bg--white);
      border-color: var(--color-bg--white);

      &:hover, &:focus {
        color: var(--color-text--emphasis-medium);
        background-color: var(--color-secondary--hovered);
        border-color: var(--color-secondary--hovered);
      }

      &:focus {
        ${applyEffect('focus')};
      }

      &:active {
        color: var(--color-text--emphasis-medium);
        background-color: var(--color-secondary--pressed);
        border-color: var(--color-secondary--pressed);
      }

      &[disabled] {
        color: var(--color-bg--disabled);
        background-color: var(--color-secondary--disabled);
        border-color: var(--color-secondary--disabled);
      }
    }

    :host([variant="tertiary"][active]) button:not([disabled]) {
      background-color: var(--color-secondary--active);
      border-color: var(--color-secondary--active);
    }

    /* transparent */
    :host([transparent]) button {
      background-color: transparent;
    }

    /* icon shape */
    :host([shape="icon"]) button,
    :host([shape="icon-round"]) button {
      padding: 7px;
    }

    /* chip shape */
    :host([shape="chip"]) button {
      border-radius: 60px;
      padding-block: 2.5px;
    }

    /* justify */
    :host([justify="center"]) button {
      justify-content: center;
    }

    :host([justify="start"]) button {
      justify-content: flex-start;
    }

    :host([justify="end"]) button {
      justify-content: flex-end;
    }
  `;
}

export type Variant =
  | 'primary'
  | 'secondary'
  | 'tertiary'

export type Shape =
  | 'default'
  | 'large'
  | 'icon'
  | 'icon-round'
  | 'chip'

export type Justify =
  | 'center'
  | 'start'
  | 'end'
