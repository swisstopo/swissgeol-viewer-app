import {css, html, LitElement} from 'lit';
import './core-dropdown-box';
import {customElement} from 'lit/decorators.js';
import {applyTransition} from 'src/styles/theme';

@customElement('ngm-core-dropdown-item')
export class CoreDropdownItem extends LitElement {
  readonly render = () => html`
    <slot></slot>
  `;

  private static readonly containerStyles = css`
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
  `;

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      ${CoreDropdownItem.containerStyles};
      height: 48px;

      ${applyTransition('fade')};
      transition-property: background-color;
    }

    :host(:hover) {
      background-color: #F0F4F7;
    }

    /* button item */
    :host([role="button"]) {
      cursor: pointer;
    }

    /* anchor item */
    :host([role="link"]) {
      padding: 0;
      justify-content: stretch;
      align-items: stretch;
    }

    :host([role="link"]) > ::slotted(a) {
      ${CoreDropdownItem.containerStyles};
      width: 100%;
      height: 100%;
    }

    :host([role="link"]) > ::slotted(a),
    :host([role="link"]) > ::slotted(a:active),
    :host([role="link"]) > ::slotted(a:focus) {
      text-decoration: none;
      color: var(--color-text--emphasis-high);
    }

  `;
}
