import {customElement, property} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n.js';
import {css, html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {IconKey, icons} from '../../icons/icons';


@customElement('ngm-menu-item')
export class CustomElement extends LitElementI18n {
  @property({type: String})
  accessor title: string = '';
  @property()
  accessor icon: IconKey = 'config';
  @property({type: Boolean})
  accessor isActive: boolean = false;

  constructor() {
    super();
  }

  static readonly styles = css`

    :host {
      position: relative;
      width: 100%;
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
        padding-right: 22px;

        display: flex;
        justify-content: flex-start;
        align-items: center;

        border-radius: 4px;

        transition: ease-out 100ms;
        transition-property: color;
        background-color: transparent;
        color: #295969;

        .icon svg {
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

        & > .title {
          transform: scaleX(1);
        }

        .icon svg {
          color: white;
        }
      }

    .container .isActive {
      background-color: #607D52;

      .icon svg {
        color: white;
      }
    }

  `;

  render() {
    const icon = icons[this.icon];
    return html`
      <div class="container ">
        <div class="box ${classMap({'isActive': this.isActive})}">
          <div class="icon">
            ${icon}
          </div>
          <div class="title" translate>
            ${this.title}
          </div>
        </div>
      </div>
    `;
  }
}
