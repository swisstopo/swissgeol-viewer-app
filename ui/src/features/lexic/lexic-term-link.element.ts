import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { css, html } from 'lit';
import { consume } from '@lit/context';
import { LexicVocabularyService } from 'src/features/lexic';
import i18next from 'i18next';
import { getLexicHref, parseLexicTermUrl } from 'src/features/lexic/lexic-url';

@customElement('ngm-lexic-term-link')
export class LexicTermLink extends CoreElement {
  @property({ type: String })
  accessor termUrl: string = '';

  @state()
  private accessor label: string | null = null;

  @state()
  private accessor isLoading = false;

  @consume({ context: LexicVocabularyService.context() })
  accessor lexicVocabularyService!: LexicVocabularyService;

  private currentRequestId = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadLabel();
  }

  willChangeLanguage(): void {
    this.loadLabel();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('termUrl') && this.hasUpdated) {
      this.loadLabel();
    }
  }

  private loadLabel(): void {
    if (this.termUrl.length === 0) {
      this.label = null;
      this.isLoading = false;
      return;
    }

    const requestId = ++this.currentRequestId;
    const language = i18next.language;
    this.isLoading = true;

    this.lexicVocabularyService
      .getLabelForTermUrl({ termUrl: this.termUrl, language })
      .then((result) => {
        if (requestId !== this.currentRequestId) {
          return;
        }
        this.label = result;
        this.isLoading = false;
      })
      .catch(() => {
        if (requestId !== this.currentRequestId) {
          return;
        }
        this.label = null;
        this.isLoading = false;
      });
  }

  private get displayText(): string {
    if (this.label != null) {
      return this.label;
    }
    const parsed = parseLexicTermUrl(this.termUrl);
    if (parsed != null) {
      const segments = new URL(parsed.normalizedTermUrl).pathname
        .split('/')
        .filter((s) => s.length > 0);
      if (segments.length >= 2) {
        return segments[segments.length - 1];
      }
    }
    return this.termUrl;
  }

  private get href(): string {
    if (this.termUrl.length === 0) {
      return '';
    }
    try {
      return getLexicHref(this.termUrl, i18next.language);
    } catch {
      return this.termUrl;
    }
  }

  readonly render = () => html`
    <a
      class="${this.isLoading ? 'loading' : ''}"
      href="${this.href}"
      title="${this.displayText}"
      rel="external noopener nofollow"
      target="_blank"
      >${this.displayText}</a
    >
  `;

  static readonly styles = css`
    :host {
      display: inline;
    }

    a {
      color: inherit;
      text-decoration: underline;
    }

    .loading {
      opacity: 0.6;
    }
  `;
}
