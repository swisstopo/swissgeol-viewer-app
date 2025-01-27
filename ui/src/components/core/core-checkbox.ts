import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './core-icon';
import { applyTransition, applyTypography } from '../../styles/theme';

@customElement('ngm-core-checkbox')
export class CoreCheckbox extends LitElement {
  @property({ type: Boolean })
  accessor isActive: boolean = false;

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
    this.dispatchEvent(
      new CustomEvent('update', { bubbles: true, composed: true }),
    );
  }

  readonly render = () => html`
    <label @click="${this.handleClick}">
      <input type="checkbox" ?checked="${this.isActive}" />
      <div class="icon">
        <svg
          width="12"
          height="10"
          viewBox="0 0 12 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11.2585 0.990983C11.4929 1.22539 11.6245 1.54328 11.6245 1.87473C11.6245 2.20619 11.4929 2.52407 11.2585 2.75848L5.00853 9.00848C4.77412 9.24282 4.45623 9.37447 4.12478 9.37447C3.79332 9.37447 3.47544 9.24282 3.24103 9.00848L0.741026 6.50848C0.513329 6.27273 0.387336 5.95698 0.390184 5.62923C0.393032 5.30149 0.524493 4.98797 0.756253 4.75621C0.988014 4.52445 1.30153 4.39299 1.62927 4.39014C1.95702 4.38729 2.27277 4.51329 2.50853 4.74098L4.12478 6.35723L9.49103 0.990983C9.72544 0.756644 10.0433 0.625 10.3748 0.625C10.7062 0.625 11.0241 0.756644 11.2585 0.990983Z"
            fill="currentColor"
          />
        </svg>
      </div>
      ${this.hasSlot
        ? html`<span class="label"><slot></slot></span>`
        : html`<slot></slot>`}
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
    }

    label {
      display: flex;
      align-items: center;
      cursor: pointer;
      gap: 12px;
    }

    input {
      display: none;
    }

    /* icon */
    .icon {
      ${applyTransition('fade')}

      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      width: 20px;
      height: 20px;
      border-radius: 1px;
      border: 2px solid var(--color-primary);

      ${applyTransition('fade')};
      transition-property: background-color, border-color;
    }

    label:has(input[checked]) .icon {
      border-color: var(--color-primary--active);
      background-color: var(--color-primary--active);
    }

    /* checkbox highlight */
    .icon::before {
      position: absolute;
      content: ' ';
      width: 45px;
      height: 45px;
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

    label:not(:hover) .icon::before {
      opacity: 0;
    }

    /* checkmark */
    svg {
      color: transparent;
    }

    label:has(input[checked]) svg {
      color: var(--color-bg--white);
    }

    /* label */
    .label {
      ${applyTypography('body-2')}
    }
  `;
}

export type Variant = 'default' | 'text';
