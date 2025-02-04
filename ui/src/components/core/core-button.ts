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

    :host {
      --button-padding-v: var(--button-padding, 7px);
      --button-padding-h: var(--button-padding, 11px);
    }

    button {
      ${applyTypography('button')};

      display: flex;
      align-items: center;
      gap: 6px;
      padding: var(-button-padding-v) var(--button-padding-h);
      border: 1px solid;
      border-radius: 4px;
      cursor: var(--button-cursor, pointer);
      width: 100%;

      ${applyTransition('fade')};
      transition-property: color, background-color, border-color;

      color: var(--button-text);
      background-color: var(--button-bg);
      border-color: var(--button-border);

      &:hover, &:focus {
        color: var(--button-text--hovered);
        background-color: var(--button-bg--hovered);
        border-color: var(--button-border--hovered);
      }

      &:focus {
        ${applyEffect('focus')};
      }

      &:active {
        color: var(--button-text--pressed);
        background-color: var(--button-bg--pressed);
        border-color: var(--button-border--pressed);
        cursor: var(--button-cursor--pressed);
      }

      &[disabled] {
        color: var(--button-text--disabled);
        background-color: var(--button-bg--disabled);
        border-color: var(--button-border--disabled);
      }
    }

    :host([active]) button:not([disabled]) {
      color: var(--button-text--active);
      background-color: var(--button-bg--active);
      border-color: var(--button-border--active);
    }


    ::slotted(ngm-core-icon) {
      width: var(--button-icon-width, var(--button-icon-size, 20px));
      height: var(--button-icon-height, var(--button-icon-size, 20px));
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
    :host([variant="primary"]) {
      --button-text: var(--color-text--invert);
      --button-bg: var(--color-primary);
      --button-border: var(--color-primary);

      --button-text--hovered: var(--color-text--invert);
      --button-bg--hovered: var(--color-primary--hovered);
      --button-border--hovered: var(--color-primary--hovered);

      --button-text--pressed: var(--color-text--invert);
      --button-bg--pressed: var(--color-primary--pressed);
      --button-border--pressed: var(--color-primary--pressed);

      --button-text--disabled: var(--color-text--invert);
      --button-bg--disabled: var(--color-primary--disabled);
      --button-border--disabled: var(--color-primary--disabled);

      --button-text--active: var(--color-text--invert);
      --button-bg--active: var(--color-primary--active);
      --button-border--active: var(--color-primary--active);
    }

    /* secondary */
    :host([variant="secondary"]) {
      --button-text: var(--color-primary);
      --button-bg: var(--color-secondary);
      --button-border: var(--color-primary);

      --button-text--hovered: var(--color-text--emphasis-medium);
      --button-bg--hovered: var(--color-secondary--hovered);
      --button-border--hovered: var(--color-text--emphasis-medium);

      --button-text--pressed: var(--color-text--emphasis-medium);
      --button-bg--pressed: var(--color-secondary--pressed);
      --button-border--pressed: var(--color-secondary--pressed);

      --button-text--disabled: var(--color-bg--disabled);
      --button-bg--disabled: var(--color-secondary--disabled);
      --button-border--disabled: var(--color-bg--disabled);

      --button-text--active: var(--color-text--emphasis-medium);
      --button-bg--active: var(--color-secondary--active);
      --button-border--active: var(--color-secondary--active);
    }


    /* tertiary */
    :host([variant="tertiary"]) {
      --button-text: var(--color-primary);
      --button-bg: var(--color-bg--white);
      --button-border: var(--color-bg--white);

      --button-text--hovered: var(--color-text--emphasis-medium);
      --button-bg--hovered: var(--color-secondary--hovered);
      --button-border--hovered: var(--color-secondary--hovered);

      --button-text--pressed: var(--color-text--emphasis-medium);
      --button-bg--pressed: var(--color-secondary--pressed);
      --button-border--pressed: var(--color-secondary--pressed);

      --button-text--disabled: var(--color-bg--disabled);
      --button-bg--disabled: var(--color-secondary--disabled);
      --button-border--disabled: var(--color-secondary--disabled);

      --button-text--active: var(--color-primary);
      --button-bg--active: var(--color-secondary--active);
      --button-border--active: var(--color-secondary--active);
    }

    /* transparent */
    :host([transparent]) {
      --button-bg: transparent;
    }

    /* icon shape */
    :host([shape="icon"]) button,
    :host([shape="icon-round"]) button {
      padding: var(--button-padding-v);
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
