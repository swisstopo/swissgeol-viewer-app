import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { CoreModal } from 'src/features/core/core-modal.element';
import { applyTypography } from 'src/styles/theme';
import { LexicFilterId, LexicLanguage } from './lexic-api.model';
import { LexicFilterService } from './lexic-filter.service';
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
  accessor shouldIncludeNarrowers = true;

  @state()
  accessor focusedIndex = -1;

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
    this.addEventListener('keydown', this.handleDialogKeyDown, true);
  }

  disconnectedCallback(): void {
    this.removeEventListener('keydown', this.handleDialogKeyDown, true);
    super.disconnectedCallback();
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
    } catch {
      this.terms = [];
    } finally {
      this.isLoading = false;
      this.focusedIndex = -1;
      this.selectedTerm = null;
    }
  }

  private get filteredTerms(): VocabularyTerm[] {
    const appliedTerms = new Set(
      this.filterService.filterList
        .filter((f) => f.filterId === this.config.filterId)
        .map((f) => (f.parameters as { term?: string }).term),
    );
    const available = this.terms.filter((term) => !appliedTerms.has(term.term));
    const query = this.searchQuery.trim().toLowerCase();
    if (query === '') {
      return available;
    }
    return available.filter(
      (term) =>
        (term.label ?? '').toLowerCase().includes(query) ||
        (term.term ?? '').toLowerCase().includes(query),
    );
  }

  private readonly handleSearchInput = (event: Event) => {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.syncSelectionWithSearch();
  };

  private readonly handleDialogKeyDown = (event: KeyboardEvent) => {
    if (!event.composedPath().includes(this)) {
      return;
    }

    if (event.key === 'Enter') {
      this.handleEnterKey(event);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    if (this.isLoading || this.filteredTerms.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const isFromSearch =
      (event.target as HTMLElement).closest('.search-input') != null;
    this.navigateList(event.key === 'ArrowDown' ? 1 : -1, isFromSearch);
  };

  private handleEnterKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;

    if (
      target.closest('ngm-core-button[variant="secondary"]') != null ||
      target.closest('ngm-core-button[variant="primary"]') != null
    ) {
      return;
    }

    if (
      this.selectedTerm == null &&
      this.focusedIndex >= 0 &&
      !this.isLoading
    ) {
      this.selectItemAtIndex(this.focusedIndex);
    }

    if (this.selectedTerm == null) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.handleApply();
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();

    if (event.key === ' ') {
      const termButton = (event.target as HTMLElement).closest('.term-item');
      if (termButton != null) {
        return;
      }

      event.preventDefault();
      this.selectFocusedItem();
    }
  };

  updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);

    const filtered = this.filteredTerms;
    if (filtered.length === 0) {
      this.focusedIndex = -1;
      this.selectedTerm = null;
      return;
    }

    if (this.focusedIndex >= filtered.length) {
      this.focusedIndex = filtered.length - 1;
    }

    if (
      this.selectedTerm != null &&
      !filtered.some((term) => term.term === this.selectedTerm?.term)
    ) {
      this.selectedTerm = null;
    }

    if (changedProperties.has('isLoading') && !this.isLoading) {
      this.focusedIndex = -1;
      this.selectedTerm = null;
      this.focusSearchInput(true);
    }
  }

  private syncSelectionWithSearch(): void {
    const filtered = this.filteredTerms;
    const hasQuery = this.searchQuery.trim() !== '';

    if (!hasQuery) {
      this.focusedIndex = -1;
      this.selectedTerm = null;
      this.focusSearchInput();
      return;
    }

    if (filtered.length === 0) {
      this.focusedIndex = -1;
      return;
    }

    this.focusedIndex = 0;
    this.scrollToIndex(0);
  }

  private navigateList(direction: 1 | -1, blurSearch = false): void {
    const filtered = this.filteredTerms;
    if (filtered.length === 0) {
      return;
    }

    if (this.focusedIndex === -1) {
      this.focusedIndex = direction === 1 ? 0 : filtered.length - 1;
    } else {
      this.focusedIndex = Math.max(
        0,
        Math.min(this.focusedIndex + direction, filtered.length - 1),
      );
    }

    this.focusTermAtIndex(this.focusedIndex, blurSearch);
  }

  private selectFocusedItem(): void {
    this.selectItemAtIndex(this.focusedIndex);
  }

  private selectItemAtIndex(index: number): void {
    const filtered = this.filteredTerms;
    if (index < 0 || index >= filtered.length) {
      return;
    }

    this.focusedIndex = index;
    this.selectedTerm = filtered[index];
  }

  private readonly handleTermFocus = (index: number) => {
    this.focusedIndex = index;
  };

  private readonly handleTermKeyDown = (
    event: KeyboardEvent,
    index: number,
  ) => {
    if (event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.selectItemAtIndex(index);
  };

  private focusTermAtIndex(index: number, blurSearch = false): void {
    if (index < 0) {
      return;
    }

    this.focusedIndex = index;

    requestAnimationFrame(() => {
      if (blurSearch) {
        this.shadowRoot
          ?.querySelector<HTMLInputElement>('.search-input')
          ?.blur();
      }

      const item = this.shadowRoot?.querySelector<HTMLElement>(
        `.term-item[data-index="${index}"]`,
      );
      item?.scrollIntoView({ block: 'nearest' });
      item?.focus();
    });
  }

  private scrollToIndex(index: number): void {
    if (index < 0) {
      return;
    }

    requestAnimationFrame(() => {
      this.shadowRoot
        ?.querySelector(`.term-item[data-index="${index}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  private focusSearchInput(selectAll = false): void {
    requestAnimationFrame(() => {
      const input =
        this.shadowRoot?.querySelector<HTMLInputElement>('.search-input');
      input?.focus();
      if (selectAll) {
        input?.select();
      }
    });
  }

  private readonly stopPropagation = (event: Event) => {
    event.stopPropagation();
  };

  private readonly handleSelectTerm = (term: VocabularyTerm, index: number) => {
    this.selectedTerm = term;
    this.focusedIndex = index;
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
        tabindex="-1"
        @keydown=${this.handleKeyDown}
        @keyup=${this.stopPropagation}
        @keypress=${this.stopPropagation}
      >
        <header class="dialog-header">
          <h2 class="dialog-title">
            ${i18next.t('layout:lexic.filter.dialogTitle', { title })}
          </h2>

          <p class="dialog-description">${this.config.description}</p>

          <div class="search-wrapper">
            <ngm-core-icon icon="search"></ngm-core-icon>
            <input
              type="search"
              class="search-input"
              autofocus
              .value=${this.searchQuery}
              placeholder=${i18next.t('layout:lexic.filter.searchPlaceholder', {
                title,
              })}
              @input=${this.handleSearchInput}
            />
          </div>

          <div class="narrowers-row">
            <ngm-core-checkbox
              .isActive=${this.shouldIncludeNarrowers}
              @update=${this.handleToggleNarrowers}
            >
              ${i18next.t('layout:lexic.filter.includeNarrowers')}
            </ngm-core-checkbox>
          </div>
        </header>

        <div class="term-list">${this.renderTermList(filtered)}</div>

        <footer class="dialog-actions">
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
        </footer>
      </div>
    `;
  };

  private readonly renderTermList = (filtered: VocabularyTerm[]) => {
    if (this.isLoading) {
      return html`<ngm-core-loader></ngm-core-loader>`;
    }
    if (filtered.length === 0) {
      return html`<span class="no-results"
        >${i18next.t('layout:lexic.filter.noResults')}</span
      >`;
    }
    return filtered.map((term, index) => this.renderTermItem(term, index));
  };

  private readonly renderTermItem = (term: VocabularyTerm, index: number) => {
    const isSelected = this.selectedTerm?.term === term.term;
    const breadcrumbs = this.formatBreadcrumbs(term);

    return html`
      <button
        class="term-item ${isSelected ? 'selected' : ''}"
        data-index=${index}
        @click=${() => this.handleSelectTerm(term, index)}
        @focus=${() => this.handleTermFocus(index)}
        @keydown=${(event: KeyboardEvent) =>
          this.handleTermKeyDown(event, index)}
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
      width: 480px;
      max-width: 80vw;
      min-height: 520px;
    }

    .dialog-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--color-border--default);
    }

    .dialog-title {
      ${applyTypography('subtitle-1')};
      margin: 0;
      font-weight: 700;
      color: var(--color-text--emphasis-high);
    }

    .dialog-description {
      ${applyTypography('body-2')};
      margin: 0;
      padding: 10px 12px;
      background-color: var(--color-bg--white--hovered);
      border: 1px solid var(--color-border--default);
      border-radius: 6px;
      color: var(--color-text--emphasis-medium);
    }

    .search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      background-color: var(--color-textfield-grey);
      border-radius: 6px;
      border-bottom: 2px solid var(--color-primary);
      overflow: hidden;
    }

    .search-wrapper ngm-core-icon {
      position: absolute;
      left: 12px;
      width: 20px;
      height: 20px;
      color: var(--color-text--emphasis-medium);
      pointer-events: none;
    }

    .search-input {
      ${applyTypography('body-2')};
      box-sizing: border-box;
      width: 100%;
      height: 44px;
      padding: 0 12px 0 40px;
      border: none;
      border-radius: 6px;
      background-color: transparent;
      color: var(--color-text--emphasis-high);
      outline: none;
    }

    .search-input::placeholder {
      color: var(--color-text--disabled);
    }

    .search-wrapper:focus-within {
      border-bottom-color: var(--color-primary--light);
    }

    .narrowers-row {
      display: flex;
      align-items: center;
      padding: 4px 0 4px 12px;
    }

    .narrowers-row ngm-core-checkbox {
      --core-checkbox-size: 18px;
      --core-checkbox-gap: 8px;
      --core-checkbox-label-size: 12px;
      --core-checkbox-label-line-height: 16px;
    }

    .term-list {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 200px;
      max-height: 360px;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      padding: 0;
    }

    .term-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      width: 100%;
    }

    .term-item:hover {
      background-color: var(--color-bg--grey);
    }

    .term-item:focus-visible {
      background-color: var(--color-bg--grey);
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    .term-item.selected {
      background-color: var(--color-hovered);
    }

    .term-item.selected:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    .term-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .term-label {
      ${applyTypography('body-1')};
      color: var(--color-text--emphasis-high);
    }

    .term-breadcrumbs {
      ${applyTypography('caption')};
      color: var(--color-text--disabled);
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
      padding: 24px 8px;
      text-align: center;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border--default);
    }

    .dialog-actions ngm-core-button {
      min-width: 120px;
    }
  `;
}
