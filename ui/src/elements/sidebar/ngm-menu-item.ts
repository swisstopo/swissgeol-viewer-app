import {customElement, property} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n.js';
import {css, html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {IconKey} from '../../icons/icons';
import i18next from 'i18next';
import '../shared/ngm-icon';


@customElement('ngm-menu-item')
export class MenuItem extends LitElementI18n {
  @property({type: String})
  accessor title: string = '';
  @property()
  accessor icon: IconKey = 'config';
  @property({type: Boolean})
  accessor isActive: boolean = false;
  @property({type: Boolean})
  accessor isMobile: boolean = false;

  constructor() {
    super();
  }

  static readonly styles = css`

    :host {
      position: relative;
      width: 68px;
      height: 58px;
      display: flex;
      justify-content: center;
      align-items: center;
      color: #295969;
      padding-inline: 5px;
      z-index: 10;
    }

    :host > .container,
    :host > .container:active {
      position: relative;
      text-decoration: none;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }

    .container {
      .box > .icon {
        display: flex;
        justify-content: center;
        align-items: center;
        min-width: 58px;
        height: 40px;

        transition: ease-out 100ms;
        transition-property: color, background-color;
      }

      .box {
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

        transition: ease-out 100ms;
        transition-property: color;
        background-color: transparent;
        color: #295969;

        .icon {
          color: #295969;
        }

        & > .title {
          transform: scaleX(0);
          transition: ease-out 100ms;
          transition-property: transform;
          transform-origin: left;
        }
      }
    }

    .container:hover .box {
        background-color: #295969;
        color: white;
        width: unset;
        white-space: nowrap;

        & > .title {
          transform: scaleX(1);
        }

        .icon {
          color: white;
        }
      }

    @media (min-height: 629px) and (min-width: 599px)  {
      .container:hover .box {
        padding-right: 22px;
      }
    }

    .container .isActive {
      background-color: #607D52;

      .icon {
        color: white;
      }
    }

  `;

  render() {
    return html`
      <div class="container ">
        <div class="box ${classMap({'isActive': this.isActive})}">
          <div class="icon">
            <ngm-icon icon=${this.icon}></ngm-icon>
          </div>
          <div class="title" translate ?hidden="${this.isMobile}">
            ${i18next.t(this.title)}
          </div>
        </div>
      </div>
    `;
  }
}
