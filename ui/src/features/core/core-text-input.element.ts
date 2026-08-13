import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { applyTypography } from 'src/styles/theme';

@customElement('ngm-core-text-input')
export class CoreTextInput extends LitElement {
  @property()
  accessor label: string = '';

  @property()
  accessor placeholder: string = '';

  @property()
  accessor value: string = '';

  @property()
  accessor icon: string = '';

  emitInputEvent(event: InputEvent): void {
    this.dispatchEvent(
      new CustomEvent<InputChangeEventDetail>('inputChange', {
        detail: {
          value: (event.target as HTMLInputElement).value,
        },
      }),
    );
  }

  readonly render = () =>
    html`<span>${this.label}</span>
      <div class="input-wrapper ${this.icon ? 'has-icon' : ''}">
        ${
          this.icon
            ? html`<ngm-core-icon .icon="${this.icon}"></ngm-core-icon>`
            : null
        }
        <input
          type="text"
          .value=${this.value}
          .placeholder=${this.placeholder}
          @input=${(evt: InputEvent) => {
            this.emitInputEvent(evt);
          }}
        />
      </div>`;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    input {
      border-radius: 3px;
      border: 1px solid #596978;
      height: 44px;
      width: 100%;
      padding-left: 12px;
    }

    .input-wrapper.has-icon input {
      padding-left: 36px;
    }

    ngm-core-icon {
      position: absolute;
      left: 11px;
      height: 20px;
      width: 20px;
      pointer-events: none;
    }

    span {
      ${applyTypography('body-2-bold')};
      padding-left: 11px;
    }
  `;
}

export type InputChangeEvent = CustomEvent<InputChangeEventDetail>;

export interface InputChangeEventDetail {
  value: string;
}
