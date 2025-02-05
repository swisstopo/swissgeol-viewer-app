import {css, html} from 'lit';
import {customElement} from 'lit/decorators.js';
import './core-dropdown-box';
import {CoreBasePopup} from 'src/components/core/base/core-base-popup';
import {CoreDropdownBox} from 'src/components/core/core-dropdown-box';
import {CoreButton} from 'src/components/core/core-button';

@customElement('ngm-core-dropdown')
export class CoreDropdown extends CoreBasePopup<CoreDropdownBox> {
  readonly defaultPosition = 'bottom';

  readonly defaultAlign = 'start';

  readonly enterEvents = ['click'];

  readonly leaveEvents = ['click'];

  connectedCallback(): void {
    super.connectedCallback();

    document.addEventListener('click', this.hide);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.hide);
  }

  override show(event?: Event): void {
    super.show(event);
    if (this.target instanceof CoreButton) {
      this.target.isActive = true;
    }
  }

  override hide(event?: Event): void {
    super.hide(event);
    if (this.target instanceof CoreButton) {
      this.target.isActive = false;
    }
  }

  readonly findBoxElement = () => (
    this.shadowRoot!.querySelector('ngm-core-dropdown-box')! as CoreDropdownBox
  );

  readonly renderBox = () => html`
    <ngm-core-dropdown-box></ngm-core-dropdown-box>
  `;

  static readonly styles = css`
    ${CoreBasePopup.styles}
  `;
}
