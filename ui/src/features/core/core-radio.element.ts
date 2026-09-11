import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { applyTransition, applyTypography } from 'src/styles/theme';

@customElement('ngm-core-radio')
export class CoreRadio extends LitElement {
  @property({ type: Boolean })
  accessor isActive: boolean = false;

  @property({ type: String })
  accessor name: string | null = null;

  @property({ type: Boolean, attribute: 'disabled', reflect: true })
  accessor isDisabled: boolean = false;

  firstUpdated() {
    const slot = this.shadowRoot?.querySelector('slot');
    slot?.addEventListener('slotchange', () => {
      this.requestUpdate();
    });
  }

  private get hasSlot(): boolean {
    const slot = this.shadowRoot?.querySelector('slot');
    return slot != null && slot.assignedNodes().length > 0;
  }

  private handleClick(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    if (!this.isDisabled && !this.isActive) {
      this.dispatchEvent(new CustomEvent('click', { composed: true }));
    }
  }

  readonly render = () => html`
    <label @click="${this.handleClick}">
      <input
        type="radio"
        ?checked="${live(this.isActive)}"
        name="${this.name}"
      />
      <div class="icon"></div>
      ${
        this.hasSlot
          ? html`<span class="label"><slot></slot></span>`
          : html`<slot></slot>`
      }
    </label>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      align-items: center;

      --color: var(--color-primary);
    }

    :host([disabled]) {
      --color: var(--color-primary--disabled);
    }

    label {
      display: flex;
      align-items: center;
      cursor: pointer;
      gap: 8px;
    }

    :host([disabled]) label {
      cursor: pointer;
    }

    :host([disabled]) .icon {
      cursor: not-allowed;
    }

    input {
      display: none;
    }

    /* icon */
    .icon {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--color);

      ${applyTransition('fade')};
      transition-property: background-color, border-color;
    }

    /* checkbox highlight */
    .icon::before {
      position: absolute;
      content: ' ';
      width: 40px;
      height: 40px;
      max-width: 40px;
      max-height: 40px;
      top: 0;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      margin: auto;
      background-color: #828e9a26;
      border-radius: 50%;

      ${applyTransition('fade')};
      transition-property: opacity;
    }

    label:not(:hover) .icon::before,
    :host([disabled]) .icon::before {
      opacity: 0;
    }

    /* checkmark */
    .icon::after {
      position: absolute;
      content: ' ';
      width: 12px;
      height: 12px;
      max-width: 12px;
      max-height: 12px;
      top: 50%;
      left: 50%;
      transform: translateX(-50%) translateY(-50%);
      background-color: transparent;
      border-radius: 50%;

      ${applyTransition('fade')};
      transition-property: background-color;
    }

    label:has(input[checked]) .icon::after {
      background-color: var(--color);
    }

    /* label */
    .label {
      display: flex;
      align-items: center;
      ${applyTypography('body-2')}
    }
  `;
}

export type CheckboxVariant = 'default' | 'text';
