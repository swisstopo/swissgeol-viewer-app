import {html} from 'lit';
import {customElement} from 'lit/decorators.js';
import './core-tooltip-box';
import {CoreBasePopup} from 'src/components/core/base/core-base-popup';
import {CoreTooltipBox} from 'src/components/core/core-tooltip-box';

@customElement('ngm-core-tooltip')
export class CoreTooltip extends CoreBasePopup<CoreTooltipBox> {
  readonly defaultPosition = 'top';

  readonly defaultAlign = 'center';

  readonly enterEvents = ['pointerenter', 'focus'];

  readonly leaveEvents = ['pointerleave', 'blur'];

  readonly findBoxElement = () => (
    this.shadowRoot!.querySelector('ngm-core-tooltip-box')! as CoreTooltipBox
  );

  readonly renderBox = () => html`
    <ngm-core-tooltip-box></ngm-core-tooltip-box>
  `;
}
