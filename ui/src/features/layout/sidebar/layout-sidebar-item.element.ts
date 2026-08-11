import i18next from 'i18next';
import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { SidebarPanel } from 'src/features/layout/layout.model';
import { IconKey } from 'src/icons/icons';

@customElement('ngm-layout-sidebar-item')
export class LayoutSidebarItem extends CoreElement {
  @property()
  accessor panel!: SidebarPanel;

  @property()
  accessor icon!: IconKey;

  @property({ type: Number })
  accessor counter = 0;

  @property({ type: Boolean, attribute: 'active', reflect: true })
  accessor isActive: boolean = false;

  private readonly toggle = () => {
    if (this.isActive) {
      this.dispatchEvent(
        new CustomEvent('deactivate', {
          composed: true,
          detail: { panel: this.panel },
        }),
      );
    } else {
      this.dispatchEvent(
        new CustomEvent('activate', {
          composed: true,
          detail: { panel: this.panel },
        }),
      );
    }
  };

  readonly render = () => html`
    <div class="container">
      <div class="box" @click="${this.toggle}" role="button">
        <div class="icon">
          <ngm-core-icon icon=${this.icon}></ngm-core-icon>
          ${
            this.counter === 0
              ? ''
              : html`
                  <ngm-core-chip variant="highlight">
                    ${this.counter}
                  </ngm-core-chip>
                `
          }
        </div>
        <div class="title">${i18next.t(`layout:items.${this.panel}`)}</div>
      </div>
    </div>
  `;

  static readonly styles = css`
    :host {
      position: relative;
      width: 68px;
      height: 58px;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--color-main);
      z-index: 10;
      padding: 9px 5px;
    }

    :host > .container {
      position: relative;
      text-decoration: none;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }

    .container .box {
      position: absolute;
      width: 58px;
      min-width: 58px;
      left: 0;
      height: 40px;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      border-radius: 4px;
      background-color: transparent;
      color: var(--color-main);
      transition: ease-out 100ms;
      transition-property: color, background-color;
    }

    .container .box > .icon {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      min-width: 58px;
      height: 40px;
      color: var(--color-main);
    }

    .container .box > .title {
      transform: scaleX(0);
      transition: ease-out 100ms;
      transition-property: transform;
      transform-origin: left;
    }

    .container:hover .box {
      background-color: var(--color-main);
      color: var(--color-bg);
      width: unset;
      white-space: nowrap;
    }

    .container:hover .box > .title {
      transform: scaleX(1);
    }

    .container:hover .box .icon {
      color: var(--color-bg);
    }

    @media (min-width: 599px) {
      .container:hover .box {
        padding-right: 22px;
      }
    }

    :host([active]) .container .box {
      background-color: var(--color-active);
    }

    :host([active]) .container .box .icon {
      color: var(--color-bg);
    }

    ngm-core-chip {
      position: absolute;
      top: -8px;
      right: -5px;
    }
  `;
}
