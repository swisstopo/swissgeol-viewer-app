import { customElement, property } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n.js';
import { css, html } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { IconKey } from '../../icons/icons';
import i18next from 'i18next';
import '../../components/core';

@customElement('ngm-menu-item')
export class MenuItem extends LitElementI18n {
  @property({ type: String })
  accessor title: string = '';
  @property()
  accessor icon: IconKey = 'config';
  @property({ type: Boolean, attribute: 'isactive', reflect: true })
  accessor isActive: boolean = false;
  @property({ type: Boolean })
  accessor isMobile: boolean = false;

  render() {
    return html`
      <div class="container">
        <div class="box ${classMap({ isActive: this.isActive })}">
          <div class="icon">
            <ngm-core-icon icon=${this.icon}></ngm-core-icon>
          </div>
          <div class="title" ?hidden="${this.isMobile}">
            ${i18next.t(this.title)}
          </div>
        </div>
      </div>
    `;
  }
  static readonly styles = css`
    :host {
      position: relative;
      width: 68px;
      height: 58px;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--color-main);
      padding-inline: 5px;
      z-index: 10;
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
      top: 9px;
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

    :host([isactive]) .container .box {
      background-color: var(--color-active);
    }

    :host([isactive]) .container .box .icon {
      color: var(--color-bg);
    }
  `;
}
