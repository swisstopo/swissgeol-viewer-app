import { css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { applyTypography } from '../../styles/theme';

type Level = 1 | 2 | 3 | 4 | 5;

const convertLevel = (value: string | null): Level => {
  const level = value == null ? null : parseInt(value);
  if (level == null || isNaN(level) || level < 1 || level > 5) {
    throw new Error(`invalid level: '${value}'`);
  }
  return level as Level;
};

@customElement('ngm-core-heading')
export class CoreHeading extends LitElement {
  @property({ type: Number, converter: convertLevel })
  accessor level: Level = 1;

  render() {
    const tag = unsafeStatic(`h${this.level}`);
    return html`<${tag}><slot></slot></${tag}>`;
  }

  static readonly styles = css`
    h1,
    h2,
    h3,
    h4,
    h5 {
      margin: 0;
    }

    h1 {
      ${applyTypography('h1')}
    }

    h2 {
      ${applyTypography('h2')}
    }

    h3 {
      ${applyTypography('h3')}
    }

    h4 {
      ${applyTypography('h4')}
    }

    h5 {
      ${applyTypography('h4')}
    }
  `;
}
