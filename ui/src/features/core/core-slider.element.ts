import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { live } from 'lit/directives/live.js';

@customElement('ngm-core-slider')
export class CoreSlider extends LitElement {
  @property({ type: Boolean })
  accessor isActive: boolean = false;

  @property({ type: String })
  accessor label: string = '';

  @property({ type: Number })
  accessor min: number = 0;

  @property({ type: Number })
  accessor max: number = 10;

  @property({ type: Number })
  accessor step: number = 1;

  @property({ type: Number })
  accessor value: number = 0;

  handleInputChange(event: InputEvent) {
    this.value = (event.target as HTMLInputElement).valueAsNumber;
    this.emitChange();
  }

  private emitChange() {
    this.dispatchEvent(
      new CustomEvent<SliderChangeEventDetail>('change', {
        detail: {
          value: this.value,
        },
      }),
    );
  }

  /**
   * Arrow/Home/End keys are handled explicitly rather than relying on the
   * native range behaviour, so that the value is clamped consistently and a
   * `done` event is emitted for each discrete step (there is no pointerup).
   */
  handleKeyDown(event: KeyboardEvent) {
    const step = this.step === 0 ? 1 : Math.abs(this.step);
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = this.value - step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = this.value + step;
        break;
      case 'PageDown':
        next = this.value - step * 10;
        break;
      case 'PageUp':
        next = this.value + step * 10;
        break;
      case 'Home':
        next = this.min;
        break;
      case 'End':
        next = this.max;
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const clamped = Math.min(this.max, Math.max(this.min, next));
    if (clamped === this.value) {
      return;
    }
    this.value = clamped;
    this.emitChange();
    this.dispatchEvent(new CustomEvent('done'));
  }

  handlePointerUp(e: Event) {
    stopEvent(e);
    this.dispatchEvent(new CustomEvent('done'));
  }

  readonly render = () => html`
    <input
      type="range"
      class="ngm-slider"
      aria-label=${this.label || nothing}
      style="${styleMap({
        '--value': this.value,
        '--min': this.min,
        '--max': this.max,
      })}"
      min=${this.min}
      max=${this.max}
      step=${this.step}
      .value=${live(isNaN(this.value) ? 1 : this.value)}
      @input=${this.handleInputChange}
      @keydown=${this.handleKeyDown}
      @pointerdown="${stopEvent}"
      @pointerup=${this.handlePointerUp}
      @click="${stopEvent}"
      @mousedown="${stopEvent}"
      @mouseup="${stopEvent}"
      @touchstart="${stopEvent}"
      @touchend="${stopEvent}"
    />
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      --slider-thumb-size: 24px;
      --slider-thumb-border-size: 3px;
      --slider-track-height: 4px;

      display: flex;
      align-items: center;
      width: 100%;
      height: var(--slider-thumb-size);
    }

    input {
      height: 4px;
      border-radius: 4px;
    }

    input[type='range'] {
      appearance: none;
      cursor: pointer;
      width: 100%;
      margin: 0;

      background-image: linear-gradient(
        to right,
        var(--color-primary--active),
        var(--color-primary--active)
          calc((var(--value) - var(--min)) / (var(--max) - var(--min)) * 100%),
        var(--color-border--default)
          calc((var(--value) - var(--min)) / (var(--max) - var(--min)) * 100%)
      );
    }

    input[type='range']::-webkit-slider-runnable-track {
      border-radius: 4px;
      height: var(--slider-track-height);
    }

    input[type='range']:focus-visible {
      outline: 2px solid var(--color-primary--active);
      outline-offset: 6px;
    }

    input[type='range']::-moz-range-track {
      border-radius: 4px;
      height: var(--slider-track-height);
    }

    input[type='range']::-webkit-slider-thumb {
      box-sizing: border-box;
      appearance: none;
      width: var(--slider-thumb-size);
      height: var(--slider-thumb-size);
      background: var(--color-bg--white) 0 0 no-repeat padding-box;
      box-shadow: 0 2px 2px #00000029;
      border: var(--slider-thumb-border-size) solid var(--color-primary);
      border-radius: 50%;
      cursor: pointer;
      margin-top: calc(
        (var(--slider-track-height) / 2) - (var(--slider-thumb-size) / 2)
      );
    }

    input[type='range']::-moz-range-thumb {
      box-sizing: border-box;
      width: var(--slider-thumb-size);
      height: var(--slider-thumb-size);
      background: var(--color-bg--white) 0 0 no-repeat padding-box;
      box-shadow: 0 2px 2px #00000029;
      border: var(--slider-thumb-border-size) solid var(--color-primary);
      border-radius: 50%;
      cursor: pointer;
    }
  `;
}

export type SliderChangeEvent = CustomEvent<SliderChangeEventDetail>;

export interface SliderChangeEventDetail {
  value: number;
}

const stopEvent = (event: Event): void => {
  event.stopPropagation();
};
