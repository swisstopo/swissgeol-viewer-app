import {css, html, LitElement, unsafeCSS} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import './core-icon';
import sliderCss from '../../style/ngm-slider.css';

@customElement('ngm-core-slider')
export class CoreCheckbox extends LitElement {
  @property({type: Boolean})
  accessor isActive: boolean = false;

  @property({type: Number})
  accessor min: number = 0;

  @property({type: Number})
  accessor max: number = 10;

  @property({type: Number})
  accessor step: number = 1;

  @property({type: Number})
  accessor value: number = 0;

  onInputChange(evt: InputEvent) {
    this.value = parseInt((<HTMLInputElement>evt.target).value);
    console.log('onInputChange', (<HTMLInputElement>evt.target).value);
    this.dispatchEvent(new CustomEvent('change', {
      detail: {
        value: parseInt((<HTMLInputElement>evt.target).value)
      }
    }));
  }

  onPointerUp() {
    this.dispatchEvent(new CustomEvent('pointerup'));
  }

  readonly render = () => html`
            <input
          type="range"
          class="ngm-slider"
          style="background-image: linear-gradient(to right, var(--color-primary--active), var(--color-primary--active) ${this.value * 5}%, var(--color-border--default) ${this.value * 5}%)"
          .min=${this.min} .max=${this.max} .step=${this.step}
          .value=${!isNaN(this.value) ? this.value : 1}
          @input=${(evt: InputEvent) => this.onInputChange(evt)}
          @pointerup=${this.onPointerUp}
        >
  `;

  static readonly styles = css`
   /*  ${unsafeCSS(sliderCss)} */

    input {
      height: 4px;
      border-radius: 4px;
    }

    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
      width: 15rem;
    }
  `;
}
