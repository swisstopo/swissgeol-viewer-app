import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { CoreModal } from 'src/features/core/core-modal.element';
import { applyTypography } from 'src/styles/theme';
import { LexicFilterId } from './lexic-api.model';
import { LexicFilterService } from './lexic-filter.service';
import { getStubVocabularyTerms } from './lexic-stubs';
import type { VocabularyTerm } from './generated/lexic-schemas';
import { LexicVocabularyService } from 'src/features/lexic/lexic-vocabulary.service';

/**
 * Configuration for opening a filter dialog.
 */
export interface LexicFilterDialogConfig {
  filterId: LexicFilterId;
  vocabularyId: string;
  title: string;
  description: string;
}

/**
 * Generic modal dialog for selecting a vocabulary term to add as a filter.
 *
 * Provides search, "include narrowers" checkbox, and a single-select list.
 * Designed to be reused for lithology, tectonic units, lithostratigraphy, etc.
 */
@customElement('ngm-lexic-filter-dialog')
export class LexicFilterDialog extends CoreElement {
  @consume({ context: LexicVocabularyService.context() })
  accessor vocabularyService!: LexicVocabularyService;

  @consume({ context: LexicFilterService.context() })
  accessor filterService!: LexicFilterService;

  @property({ attribute: false })
  accessor config!: LexicFilterDialogConfig;

  @state()
  accessor terms: VocabularyTerm[] = [];

  @state()
  accessor isLoading = true;

  @state()
  accessor searchQuery = '';

  @state()
  accessor selectedTerm: VocabularyTerm | null = null;

  @state()
  accessor shouldIncludeNarrowers = false;

  private modal: CoreModal | null = null;

  /**
   * Opens the filter dialog as a modal.
   * Consumers should call this static method instead of manually adding the element.
   */
  static openDialog(config: LexicFilterDialogConfig): void {
    const modal = CoreModal.open(
      { isPersistent: false, size: 'auto' },
      html`<ngm-lexic-filter-dialog
        .config=${config}
      ></ngm-lexic-filter-dialog>`,
    );
    const dialog = modal.querySelector(
      'ngm-lexic-filter-dialog',
    ) as LexicFilterDialog | null;
    if (dialog) {
      dialog.modal = modal;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  willFirstUpdate(): void {
    void this.loadTerms();
  }

  willChangeLanguage(): void {
    void this.loadTerms();
  }

  private getLexicLanguage(): LexicLanguage {
    const language = i18next.resolvedLanguage ?? i18next.language;
    if (language.startsWith('de')) return 'de';
    if (language.startsWith('fr')) return 'fr';
    if (language.startsWith('it')) return 'it';
    return 'en';
  }

  private async loadTerms(): Promise<void> {
    this.isLoading = true;
    try {
      const response = await this.vocabularyService.fetchVocabulary(
        this.config.vocabularyId,
        this.getLexicLanguage(),
      );
      this.terms = response.terms ?? [];
    } catch (error) {
      console.error(
        `[Lexic] Failed to load vocabulary terms for "${this.config.vocabularyId}":`,
        error,
      );
      this.terms = getStubVocabularyTerms(this.config.vocabularyId) ?? [];
    } finally {
      this.isLoading = false;
    }
  }

  private get filteredTerms(): VocabularyTerm[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (query === '') {
      return this.terms;
    }
    return this.terms.filter(
      (term) =>
        (term.label ?? '').toLowerCase().includes(query) ||
        (term.term ?? '').toLowerCase().includes(query),
    );
  }

  private readonly handleSearchInput = (event: Event) => {
    const customEvent = event as CustomEvent<{ value: string }>;
    this.searchQuery = customEvent.detail.value;
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      const filtered = this.filteredTerms;
      if (filtered.length > 0) {
        this.selectedTerm = filtered[0];
      }
    }
  };

  private readonly stopPropagation = (event: Event) => {
    event.stopPropagation();
  };

  private readonly handleSelectTerm = (term: VocabularyTerm) => {
    this.selectedTerm = term;
  };

  private readonly handleToggleNarrowers = () => {
    this.shouldIncludeNarrowers = !this.shouldIncludeNarrowers;
  };

  private readonly handleApply = () => {
    if (this.selectedTerm == null) return;

    this.filterService.addFilter(
      {
        filterId: this.config.filterId,
        parameters: {
          term: this.selectedTerm.term!,
          includeNarrowers: this.shouldIncludeNarrowers,
        },
      },
      this.selectedTerm.label ?? this.selectedTerm.term ?? '',
    );

    this.closeDialog();
  };

  private readonly handleCancel = () => {
    this.closeDialog();
  };

  private closeDialog(): void {
    this.modal?.close();
  }

  private formatBreadcrumbs(term: VocabularyTerm): string {
    if (term.breadcrumbs == null) return '';
    const keys = Object.keys(term.breadcrumbs).sort(
      (a, b) => Number(a) - Number(b),
    );
    return keys.map((k) => term.breadcrumbs![k]).join(' > ');
  }

  readonly render = () => {
    const title = this.config.title;
    const isApplyDisabled = this.selectedTerm == null;
    const filtered = this.filteredTerms;

    return html`
      <div
        class="dialog-container"
        @keydown=${this.handleKeyDown}
        @keyup=${this.stopPropagation}
        @keypress=${this.stopPropagation}
      >
        <h2 class="dialog-title">
          ${i18next.t('layout:lexic.filter.dialogTitle', { title })}
        </h2>

        <p class="dialog-description">${this.config.description}</p>

        <ngm-core-text-input
          icon="search"
          .placeholder=${i18next.t('layout:lexic.filter.searchPlaceholder', {
            title,
          })}
          @inputChange=${this.handleSearchInput}
        ></ngm-core-text-input>

        <div class="narrowers-row">
          <ngm-core-checkbox
            .isActive=${this.shouldIncludeNarrowers}
            @update=${this.handleToggleNarrowers}
          >
            ${i18next.t('layout:lexic.filter.includeNarrowers')}
          </ngm-core-checkbox>
        </div>

        <div class="term-list">
          ${this.isLoading
            ? html`<ngm-core-loader></ngm-core-loader>`
            : filtered.length === 0
              ? html`<span class="no-results"
                  >${i18next.t('layout:lexic.filter.noResults')}</span
                >`
              : filtered.map((term) => this.renderTermItem(term))}
        </div>

        <div class="dialog-actions">
          <ngm-core-button variant="secondary" @click=${this.handleCancel}>
            ${i18next.t('layout:lexic.filter.cancel')}
          </ngm-core-button>
          <ngm-core-button
            variant="primary"
            .isDisabled=${isApplyDisabled}
            @click=${this.handleApply}
          >
            ${i18next.t('layout:lexic.filter.applyFilter')}
          </ngm-core-button>
        </div>
      </div>
    `;
  };

  private readonly renderTermItem = (term: VocabularyTerm) => {
    const isSelected = this.selectedTerm?.term === term.term;
    const breadcrumbs = this.formatBreadcrumbs(term);

    return html`
      <button
        class="term-item ${isSelected ? 'selected' : ''}"
        @click=${() => this.handleSelectTerm(term)}
      >
        <div class="term-header">
          <span class="term-label">${term.label ?? term.term}</span>
        </div>
        ${breadcrumbs
          ? html`<span class="term-breadcrumbs">${breadcrumbs}</span>`
          : nothing}
        ${term.description
          ? html`<span class="term-description">${term.description}</span>`
          : nothing}
      </button>
    `;
  };

  static readonly styles = css`
    :host {
      display: block;
    }

    .dialog-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 460px;
      min-height: 520px;
    }

    .dialog-title {
      ${applyTypography('subtitle-1')};
      margin: 0;
      color: var(--color-text--emphasis-high);
    }

    .dialog-description {
      ${applyTypography('body-2')};
      margin: 0;
      padding: 8px 12px;
      background-color: var(--color-bg--dark, #f5f5f5);
      border-radius: 4px;
      color: var(--color-text--emphasis-medium);
    }

    .narrowers-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .term-list {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 200px;
      max-height: 400px;
      overflow-y: auto;
      border-top: 1px solid var(--color-border--default);
    }

    .term-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 4px;
      border: none;
      border-bottom: 1px solid var(--color-border--default);
      background: transparent;
      cursor: pointer;
      text-align: left;
    }

    .term-item:hover {
      background-color: var(--color-bg--dark, #f5f5f5);
    }

    .term-item.selected {
      background-color: var(--color-secondary--active, #e8f0fe);
    }

    .term-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .term-label {
      ${applyTypography('body-1-bold')};
      color: var(--color-text--emphasis-high);
    }

    .term-breadcrumbs {
      ${applyTypography('caption')};
      color: var(--color-text--emphasis-medium);
    }

    .term-description {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-medium);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .no-results {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-medium);
      padding: 16px 4px;
      text-align: center;
    }

    .dialog-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding-top: 8px;
    }
  `;
}
