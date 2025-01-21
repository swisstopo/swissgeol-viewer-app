import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import './core-tooltip-box';
import {CoreTooltipBox} from './core-tooltip-box';

@customElement('ngm-core-tooltip')
export class CoreTooltip extends LitElement {
  private static readonly ENTER_EVENTS = ['pointerenter', 'focus'];
  private static readonly LEAVE_EVENTS = ['pointerleave', 'blur'];

  @property()
  accessor position: Position = 'top';

  private _target: Element | null = null;

  private box!: CoreTooltipBox;

  private slotObserver: MutationObserver | null = null;

  constructor() {
    super();
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
  }

  @property()
  set target(target: Element | null) {
    this.unregisterTarget();
    this._target = target;
    this.registerTarget();
  }

  get target(): Element | null {
    return this._target ?? this.previousElementSibling;
  }

  private registerTarget(): void {
    const {target} = this;
    if (target == null) {
      return;
    }
    console.log(target);
    CoreTooltip.ENTER_EVENTS.forEach((event) => target.addEventListener(event, this.show));
    CoreTooltip.LEAVE_EVENTS.forEach((event) => target.addEventListener(event, this.hide));
  }

  private unregisterTarget(): void {
    const {_target: target} = this;
    if (target == null) {
      return;
    }
    CoreTooltip.ENTER_EVENTS.forEach((event) => target.removeEventListener(event, this.show));
    CoreTooltip.LEAVE_EVENTS.forEach((event) => target.removeEventListener(event, this.hide));
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.hide();
    this.slotObserver?.disconnect();
    this.box.remove();
  }

  firstUpdated(): void {
    this.box = this.shadowRoot!.querySelector('ngm-core-tooltip-box')!;
    document.body.appendChild(this.box);
    this.hide();

    this.slotObserver = new MutationObserver(() => this.syncSlot());
    this.syncSlot();

    if (this._target == null) {
      this.registerTarget();
    }
  }

  private syncSlot(): void {
    const slot = this.shadowRoot!.querySelector('slot')!;
    const assignedNodes = slot.assignedNodes({flatten: true});
    const box = this.box.shadowRoot!;
    while (box.lastChild != null) {
      box.removeChild(box.lastChild);
    }
    if (assignedNodes.length === 0) {
      this.updatePosition();
      return;
    }
    this.updatePosition({allowViewportCheck: true});
    assignedNodes.forEach(node => {
      box.appendChild(node.cloneNode(true));
      this.slotObserver?.observe(node, {childList: true, subtree: true, characterData: true, attributes: true});
    });
    this.updatePosition({allowViewportCheck: true});
    this.slotObserver?.observe(slot, {childList: true, subtree: true, characterData: true, attributes: true});
  }

  private show(): void {
    this.box.show();
    this.updatePosition({allowViewportCheck: true});
  }

  private hide(): void {
    this.box.hide();
  }

  private updatePosition(options: { position?: Position, allowViewportCheck?: boolean } = {}): void {
    if (this.target == null) {
      return;
    }

    const target = this.target.getBoundingClientRect();
    const box = this.box.getBoundingClientRect();

    const position = options.position ?? this.position;
    const boxStyle = this.box.style;

    // Update x axis
    switch (position) {
      case 'top':
      case 'bottom':
        boxStyle.left = `${target.x + (target.width * 0.5) - (box.width * 0.5)}px`;
        break;
      case 'left':
        boxStyle.left = `${target.x - box.width - FIXED_OFFSET_PX}px`;
        break;
      case 'right':
        boxStyle.left = `${target.x + target.width + FIXED_OFFSET_PX}px`;
        break;

    }

    // Update y axis
    switch (position) {
      case 'top':
        boxStyle.top = `${target.y - box.height - FIXED_OFFSET_PX}px`;
        break;
      case 'bottom':
        boxStyle.top = `${target.y + target.height + FIXED_OFFSET_PX}px`;
        break;
      case 'left':
      case 'right':
        boxStyle.top = `${target.y + (target.height * 0.5) - (box.height * 0.5)}px`;
        break;
    }

    if (options.allowViewportCheck) {
      this.adjustPositionToViewport(position);
    }
  }

  private adjustPositionToViewport(position: Position): void {
    const box = this.box.getBoundingClientRect();
    switch (position) {
      case 'top':
        if (box.y < 0) {
          this.updatePosition({position: 'bottom'});
        }
        break;
      case 'bottom':
        if (box.y + box.height > window.innerHeight) {
          this.updatePosition({position: 'top'});
        }
        break;
      case 'left':
        if (box.x < 0) {
          this.updatePosition({position: 'right'});
        }
        break;
      case 'right':
        if (box.x + box.width > window.innerWidth) {
          this.updatePosition({position: 'left'});
        }
        break;

    }
  }

  readonly render = () => html`
    <slot></slot>
    <ngm-core-tooltip-box></ngm-core-tooltip-box>
  `;

  static readonly styles = css`
    :host {
      display: none;
    }
  `;
}

type Position =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'

const FIXED_OFFSET_PX = 4;
