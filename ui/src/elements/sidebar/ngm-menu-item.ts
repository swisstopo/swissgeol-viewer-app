import {customElement, property} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n.js';
import {css, html} from 'lit';
import {layerIcon} from "../../images/i_layer";
import {classMap} from "lit/directives/class-map.js";

const ICON_BASE_PATH = '../../images/';

@customElement('ngm-menu-item')
export class CustomElement extends LitElementI18n {
  @property({type: String})
  accessor title: string = '';
  @property({type: String})
  accessor icon: string = '';
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

        .icon svg {
          fill: #295969;
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
          fill: white;
        }
      }

    .container .isActive {
      background-color: #607D52;

      .icon svg {
        fill: white;
      }
    }

  `;

  render() {
    return html`
      <div class="container ">
        <div class="box ${classMap({'isActive': this.isActive})}">
          <div class="icon">
            ${layerIcon}
          </div>
          <div class="title" translate>
            ${this.title}
          </div>
        </div>
      </div>
    `;
  }
}
