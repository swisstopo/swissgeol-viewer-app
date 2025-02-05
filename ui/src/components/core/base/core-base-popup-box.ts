import {css, html, LitElement} from 'lit';
import {applyTransition} from 'src/styles/theme';

export abstract class CoreBasePopupBox extends LitElement {
  protected constructor() {
    super();
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
  }

  show(): void {
    this.classList.remove('is-hidden');
    setTimeout(() => {
      this.classList.add('is-visible');
    });
  }

  hide(): void {
    this.classList.remove('is-visible');
    setTimeout(() => {
      this.classList.add('is-hidden');
    }, 250);
  }

  readonly render = () => html``;

  static readonly styles = css`
    :host, :host * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;
      z-index: 10;

      ${applyTransition('fade')};
      transition-property: opacity;
    }

    :host(.is-hidden) {
      display: none;
    }

    :host(:not(.is-visible)) {
      opacity: 0;
    }
  `;
}
