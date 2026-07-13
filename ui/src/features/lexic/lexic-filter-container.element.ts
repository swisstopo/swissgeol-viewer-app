import { consume } from '@lit/context';
import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { applyTypography } from 'src/styles/theme';

import { LexicActiveFilter, LexicFilterService } from './lexic-filter.service';
import {
  LexicFilter,
  LexicFilterId,
  LexicLayerAvailableFilter,
} from 'src/features/lexic/lexic-api.model';
import {
  LexicFilterDialog,
  LexicFilterDialogConfig,
} from 'src/features/lexic/lexic-filter-dialog.element';

/** Maps filter IDs to the vocabulary used for term selection. */
const FILTER_VOCABULARY_MAP: Partial<Record<LexicFilterId, string>> = {
  'f-lithology-term': 'lithology',
  'f-chronostrat-term': 'chronostratigraphy',
  'f-tectonic-term': 'tectonic-units',
  'f-lithostrat-term': 'lithostratigraphy',
  // 'f-byAttribute' has no vocabulary — it uses a different mechanism
};

/**
 * The set of filter IDs currently supported by the application.
 * Only filters listed here will be shown to the user.
 *
 * TODO: Expand this set as new filter types are implemented.
 */
export const SUPPORTED_FILTER_IDS: ReadonlySet<LexicFilterId> =
  new Set<LexicFilterId>([
    'f-lithology-term',
    'f-tectonic-term',
    'f-lithostrat-term',
  ]);

@customElement('ngm-lexic-filter-container')
export class LexicFilterContainer extends CoreElement {
  @consume({ context: LexicFilterService.context() })
  accessor filterService!: LexicFilterService;

  @property({ attribute: false })
  accessor layerFilters: LexicLayerAvailableFilter[] | null = null;

  @property({ attribute: false })
  accessor layerId = '';

  @state()
  accessor expandedFilterIds: Set<string> = new Set();

  @state()
  accessor allActiveFilters: LexicActiveFilter[] = [];

  private previousLayerId: string | undefined;
  private hasInitialized = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.register(
      this.filterService.filterList$.subscribe((filters) => {
        this.allActiveFilters = filters;
      }),
    );
  }

  willUpdate(): void {
    const currentLayerId = this.layerId;
    if (!this.hasInitialized || currentLayerId !== this.previousLayerId) {
      this.hasInitialized = true;
      const firstId = this.filters[0]?.id;
      this.expandedFilterIds = new Set(firstId != null ? [firstId] : []);
      this.previousLayerId = currentLayerId;
    }
  }

  private get filters(): LexicLayerAvailableFilter[] {
    // Only show filters that are currently supported by the application.
    // TODO: Remove this filtering once all filter types are implemented.
    return (this.layerFilters ?? []).filter((f) =>
      SUPPORTED_FILTER_IDS.has((f.id ?? '') as LexicFilterId),
    );
  }

  private activeFiltersForCategory(
    filterId: LexicFilterId,
  ): LexicActiveFilter[] {
    return this.allActiveFilters.filter((f) => f.filterId === filterId);
  }

  private readonly toggleFilter = (filterId: string) => {
    const next = new Set(this.expandedFilterIds);
    if (next.has(filterId)) {
      next.delete(filterId);
    } else {
      next.add(filterId);
    }
    this.expandedFilterIds = next;
  };

  private readonly handleOpenFilterDialog = (filter: LexicFilter) => {
    const filterId = filter.id as LexicFilterId;
    const vocabularyId = FILTER_VOCABULARY_MAP[filterId];
    if (vocabularyId == null) return;

    const title = filter.title ?? filter.name ?? filterId;

    const config: LexicFilterDialogConfig = {
      filterId,
      vocabularyId,
      title,
      description: filter.description ?? '',
    };

    LexicFilterDialog.openDialog(config);
  };

  readonly render = () => {
    if (this.filters.length === 0) {
      return nothing;
    }

    return html`
      <div class="filter-list">
        ${this.filters.map((filter, index) => this.renderFilter(filter, index))}
      </div>
    `;
  };

  private readonly renderFilterContent = (
    filterId: LexicFilterId,
    filter: LexicLayerAvailableFilter,
    activeFilters: LexicActiveFilter[],
  ) => {
    const hasVocabulary = FILTER_VOCABULARY_MAP[filterId] != null;

    return html` <div class="filter-content">
      ${hasVocabulary
        ? html`
            <ngm-lexic-filter-overview
              .filterId=${filterId}
              .activeFilters=${activeFilters}
              @open-filter-dialog=${() =>
                this.handleOpenFilterDialog(filter as LexicFilter)}
            ></ngm-lexic-filter-overview>
          `
        : html`
            <span class="filter-placeholder"
              >${filter.description ?? 'Filter options will appear here'}</span
            >
          `}
    </div>`;
  };

  private readonly renderFilter = (
    filter: LexicLayerAvailableFilter,
    index: number,
  ) => {
    const filterId = (filter.id ?? '') as LexicFilterId;
    const isExpanded = this.expandedFilterIds.has(filterId);
    const activeFilters = this.activeFiltersForCategory(filterId);

    return html`
      ${index > 0 ? this.renderAndSeparator() : nothing}
      <div class="filter-section">
        <button
          class="filter-header"
          @click=${() => this.toggleFilter(filterId)}
          aria-expanded=${isExpanded}
        >
          <span class="filter-title"
            >${filter.name ?? filter.title ?? filterId}</span
          >
          ${activeFilters.length > 0
            ? html`<ngm-core-chip>${activeFilters.length}</ngm-core-chip>`
            : nothing}
          <ngm-core-icon
            class="filter-chevron ${isExpanded ? 'expanded' : ''}"
            icon="dropdown"
          ></ngm-core-icon>
        </button>
        ${isExpanded
          ? this.renderFilterContent(filterId, filter, activeFilters)
          : nothing}
      </div>
    `;
  };

  private readonly renderAndSeparator = () => html`
    <div class="and-separator">
      <span class="and-label">AND</span>
    </div>
  `;

  static readonly styles = css`
    :host {
      display: block;
    }

    .filter-list {
      display: flex;
      flex-direction: column;
    }

    .filter-section {
      border-radius: 4px;
      overflow: hidden;
    }

    .filter-header {
      ${applyTypography('body-1')};
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 44px;
      padding: 12px 0;
      margin: 0;
      border: 0;
      background: transparent;
      color: var(--color-primary);
      cursor: pointer;
      text-align: left;
      gap: 8px;
    }

    .filter-header:hover {
      opacity: 0.8;
    }

    .filter-title {
      flex: 1;
    }

    .filter-header ngm-core-chip {
      padding: 0 8px;
      min-width: 28px;
      height: 28px;
    }

    .filter-chevron {
      transition: transform 150ms ease;
      color: var(--color-primary);
    }

    .filter-chevron.expanded {
      transform: rotate(180deg);
    }

    .filter-content {
      margin-top: 4px;
      padding: 12px;
      background-color: var(--color-bg--grey);
      border: 1px solid var(--color-border--default);
      border-radius: 4px;
    }

    .filter-placeholder {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-medium);
    }

    .and-separator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 0;
      gap: 8px;
    }

    .and-separator::before,
    .and-separator::after {
      content: '';
      flex: 1;
      height: 1px;
      background: repeating-linear-gradient(
        to right,
        var(--color-primary) 0,
        var(--color-primary) 6px,
        transparent 6px,
        transparent 11px
      );
    }

    .and-label {
      ${applyTypography('body-2')};
      font-weight: 700;
      color: var(--color-primary);
      flex-shrink: 0;
      padding: 0 6px;
    }
  `;
}
