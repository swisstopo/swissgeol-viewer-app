import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import './core-icon';

@customElement('ngm-core-checkbox')
export class CoreCheckbox extends LitElement {
  @property({type: String})
  accessor label: string | null = null;

  @property({type: Boolean, attribute: 'is-active', reflect: true})
  accessor isActive: boolean = false;

  private handleClick(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('update', {bubbles: true, composed: true}));
  }

  readonly render = () => html`
    <label @click="${this.handleClick}">
      <input type="checkbox" ?checked="${this.isActive}">
      <div class="icon"></div>
      ${this.label == null
        ? ''
        : html`<span class="label">${this.label}</span>`}
    </label>
  `;

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      color: var(--color-highlight--darker);

      display: flex;
      align-items: center;
    }

    :host([is-active]) {
      color: var(--color-action);
    }

    label {
      display: flex;
      align-items: center;
      cursor: pointer;
      gap: 10px;
    }

    label:hover {
      color: var(--color-action--light);
    }

    :host([is-active]) > label:not(:hover) {
      color: var(--color-action);
    }

    input {
      display: none;
    }

    .icon {
      width: 19px;
      height: 18px;
      display: block;
      position: relative;
      border-radius: 2px;
      border: 2px solid var(--color-highlight--darker);
      transition: all 0.2s ease;
    }

    label:hover > .icon {
      border-color: var(--color-action--light);
      background-color: var(--color-action--light);
    }

    :host([is-active]) > label:not(:hover) > .icon {
      border-color: var(--color-action);
      background-color: var(--color-action);
    }

    .icon::before {
      content: "";
      top: -2px;
      left: 3px;
      width: 7px;
      height: 12px;
      display: none;
      position: absolute;
      transform: rotate(45deg);
      transition: all 0.2s ease;
      border-right: 2px solid #fff;
      border-bottom: 2px solid #fff;
    }

    input:checked + .icon::before {
      display: block;
    }
  `;
}

export type Variant =
  | 'default'
  | 'text'
