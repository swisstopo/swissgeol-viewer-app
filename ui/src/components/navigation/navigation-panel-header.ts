import { LitElementI18n } from '../../i18n';
import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../core';

@customElement('ngm-navigation-panel-header')
export class NavigationPanelHeader extends LitElementI18n {
  @property({ type: Boolean, attribute: 'closeable' })
  accessor isCloseable: boolean = false;

  constructor() {
    super();

    this.close = this.close.bind(this);
  }

  readonly render = () => html`
    <slot></slot>
    ${this.isCloseable
      ? html`
          <ngm-core-icon
            icon="close"
            interactive
            @click=${this.close}
          ></ngm-core-icon>
        `
      : nothing}
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'heading');
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  static readonly styles = css`
    :host {
      box-sizing: border-box;
      border-bottom: 2px solid #dfe2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      height: 34px;
      padding: 4px 16px 2px 16px;
      color: var(--color-bg-contrast--light);
    }
  `;
}
