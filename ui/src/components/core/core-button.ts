import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('ngm-core-button')
export class CoreButton extends LitElement {
  @property({reflect: true})
  accessor variant: Variant = 'default';

  @property({type: Boolean, attribute: 'active', reflect: true})
  accessor isActive: boolean = false;

  readonly render = () => html`
    <button>
      <slot></slot>
    </button>
  `;

  static readonly styles = css`
    button {
      font-family: var(--font);
      font-size: 14px;
    }

    :host([variant='text']) button {
      color: var(--color-highlight--darker);

      border: none;
      background-color: transparent;
      cursor: pointer;
    }

    :host([variant='text'][active]) button {
      color: var(--color-action);
    }

    :host([variant='text']) button:hover {
      color: var(--color-action--light);
    }
  `;
}

export type Variant =
  | 'default'
  | 'text'
