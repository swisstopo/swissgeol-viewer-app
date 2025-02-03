import {customElement, property, state} from 'lit/decorators.js';
import {css, html} from 'lit';
import 'src/components/core';
import {applyTransition, applyTypography} from 'src/styles/theme';
import {SliderChangeEvent} from 'src/components/core/core-slider';
import {classMap} from 'lit/directives/class-map.js';
import {CoreElement} from 'src/components/core';
import 'src/components/layer/background/background-layer-select.component';

@customElement('ngm-layer-display-list-item')
export class LayerDisplayListItem extends CoreElement {
  @property({type: String})
  accessor title = '';

  @property({type: String})
  accessor label = '';

  @property({type: Boolean, attribute: 'visible', reflect: true})
  accessor isVisible = false

  @property({type: Number})
  accessor opacity = 1

  @state()
  accessor isOpacityActive = false;

  @state()
  accessor isBackgroundActive = false;

  constructor() {
    super();

    this.toggleVisibility = this.toggleVisibility.bind(this);
    this.toggleOpacityActive = this.toggleOpacityActive.bind(this);
    this.toggleBackgroundActive = this.toggleBackgroundActive.bind(this);
    this.handleOpacityChangeEvent = this.handleOpacityChangeEvent.bind(this);
  }

  private toggleVisibility(): void {
    this.dispatchEvent(new CustomEvent<VisibilityChangedEventDetail>('visibility-changed', {
      detail: {
        isVisible: !this.isVisible,
      },
    }));
  }

  private toggleOpacityActive(): void {
    this.isBackgroundActive = false;
    this.isOpacityActive = !this.isOpacityActive;
    this.classList.toggle('has-active-opacity', this.isOpacityActive);
  }

  private toggleBackgroundActive(): void {
    this.isOpacityActive = false;
    this.isBackgroundActive = !this.isBackgroundActive;
  }

  private handleOpacityChangeEvent(event: SliderChangeEvent): void {
    this.dispatchEvent(new CustomEvent<OpacityChangedEventDetail>('opacity-changed', {
      detail: {
        opacity: event.detail.value,
      },
    }));
  }

  readonly render = () => html`
    <div class="main">
      <ngm-core-button transparent variant="tertiary" shape="icon" @click="${this.toggleVisibility}">
        <ngm-core-icon icon="${this.isVisible ? 'visible' : 'hidden'}"></ngm-core-icon>
      </ngm-core-button>

      <span class="title">${this.title}</span>

      <div class="suffix">
        <span
          class="label ${classMap({'is-active': this.isBackgroundActive})}"
          role="button"
          @click="${this.toggleBackgroundActive}"
        >${this.label}</span>

        <ngm-core-button
          transparent
          variant="secondary"
          shape="chip"
          justify="end"
          class="opacity-toggle"
          ?active="${this.isOpacityActive}"
          @click="${this.toggleOpacityActive}"
        >
          ${Math.round(this.opacity * 100)}%
        </ngm-core-button>
        <ngm-core-tooltip>Deckkraft</ngm-core-tooltip>

        <ngm-core-button transparent variant="tertiary" shape="icon">
          <ngm-core-icon icon="menu"></ngm-core-icon>
        </ngm-core-button>
      </div>
    </div>
    ${this.isOpacityActive ? this.renderOpacity() : ''}
    ${this.isBackgroundActive ? this.renderBackground() : ''}
  `;

  private readonly renderOpacity = () => html`
    <hr>
    <div class="opacity">
      <ngm-core-slider
        .value="${this.opacity}"
        .min="${0}"
        .max="${1}"
        .step="${0.01}"
        @change="${this.handleOpacityChangeEvent}"
      ></ngm-core-slider>
    </div>
  `;

  private readonly renderBackground = () => html`
    <hr>
    <ngm-background-layer-select></ngm-background-layer-select>
  `;

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      padding: 9px;
      gap: 16px;

      border-radius: 4px;
      background-color: var(--color-bg--white);
      border: 1px solid var(--color-bg--white);

      ${applyTransition('fade')};
      transition-property: background-color, border-color;
    }

    :host(:hover), :host(.has-active-opacity) {
      background-color: var(--color-bg--white--hovered);
      border-color: var(--color-hovered);
    }

    :host > hr {
      --offset-h: 9px;

      margin: 0 var(--offset-h);
      width: calc(100% - var(--offset-h) * 2);
      height: 1px;
      border: 0;
      background-color: var(--color-border--emphasis-high)
    }


    /* main */
    :host > .main {
      display: flex;
      align-items: center;
      gap: 6px;

    }

    /* main suffix */
    :host > .main > .suffix {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    /* visibility */
    .visible > ngm-core-icon {
      color: var(--color-primary);
    }

    /* title */
    .title {
      ${applyTypography('body-2')};

      flex-grow: 1;
    }

    /* label */
    /* TODO this style is improvised, as the Figma interaction for this label has not yet been finalized. */
    .label {
      ${applyTypography('overline')};

      display: flex;
      align-items: center;
      padding: 10px;
      height: 27px;
      border-radius: 22px;
      cursor: pointer;

      color: var(--color-text--emphasis-high);
      background-color: var(--color-bg--grey);


      ${applyTransition('fade')};
      transition-property: background-color;
    }

    .label:hover {
      background-color: var(--color-green-disabled);
    }

    .label.is-active {
      color: var(--color-text--emphasis-medium);
      background-color: var(--color-secondary--active);
      border-color: var(--color-secondary--active);
    }

    /* opacity */
    ngm-core-button.opacity-toggle {
      width: 61px;
    }

    .opacity {
      display: flex;
      align-items: center;
      padding: 0 9px 11px 9px;
      gap: 6px;
    }

  `;
}

export type VisibilityChangedEvent = CustomEvent<VisibilityChangedEventDetail>
export interface VisibilityChangedEventDetail {
  isVisible: boolean
}

export type OpacityChangedEvent = CustomEvent<OpacityChangedEventDetail>
export interface OpacityChangedEventDetail {
  opacity: number
}

