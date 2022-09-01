import {html, LitElement} from 'lit';
import {customElement} from 'lit/decorators.js';


@customElement('hide-overflow')
export class HideOverflow extends LitElement {
  private observer: IntersectionObserver;

  constructor() {
    super();
    const options = {
      root: this,
      threshold: [0.0, 1.0]
    };
    const callback = (entries) => {
      entries.forEach((entry) => {
        entry.target.style.visibility = entry.intersectionRatio < 1 ? 'hidden' : 'visible';
      });
    };
    this.observer = new IntersectionObserver(callback, options);
  }

  slotReady(event: Event) {
    const items = (event.target as HTMLSlotElement).assignedElements();
    items.forEach(item => this.observer.observe(item));
  }

  disconnectedCallback() {
    this.observer.disconnect();
  }

  override render() {
    return html`
      <slot @slotchange="${this.slotReady}" ></slot>
    `;
  }
}
