import { LitElementI18n } from 'src/i18n';
import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../core';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-navigation-panel-header')
export class NavigationPanelHeader extends LitElementI18n {
  @property({ type: Boolean, attribute: 'closeable' })
  accessor isCloseable: boolean = false;

  constructor() {
    super();

    this.close = this.close.bind(this);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'heading');
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  readonly render = () => html`
    <slot></slot>
    ${
      this.isCloseable
        ? html`
            <ngm-core-icon
              icon="close"
              interactive
              @click=${this.close}
            ></ngm-core-icon>
          `
        : nothing
    }
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      ${applyTypography('modal-title-1')};

      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 12px 14px 16px;
      height: var(--panel-header-height);
      border-bottom: 1px solid #e0e2e6;
    }
  `;
}
