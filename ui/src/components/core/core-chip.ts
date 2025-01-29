import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './core-icon';
import { applyTypography } from '../../styles/theme';
import { Variant } from './core-button';

@customElement('ngm-core-chip')
export class CoreChip extends LitElement {
  @property({ reflect: true })
  accessor variant: Variant = 'primary';

  readonly render = () => html`
    <span>
      <slot></slot>
    </span>
  `;

  static readonly styles = css`
    :host {
      border-radius: 22px;
      height: 27px;
      padding: 0 10px;
      align-content: center;
    }

    :host([variant='primary']) {
      background-color: var(--color-border--default);
      color: var(--color-text--emphasis--high);
      ${applyTypography('overline')};
    }

    :host([variant='secondary']) {
      background-color: var(--color-bg--white);
      color: var(--color-primary);
      border: 1px solid var(--color-primary);
      ${applyTypography('button')};
    }
  `;
}
