import { consume } from '@lit/context';
import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { applyTypography } from 'src/styles/theme';
import { LexicLayerAvailableFilter } from './lexic-api.model';
import { LexicFilterService } from './lexic-filter.service';

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

  private previousLayerId: string | undefined;
  private hasInitialized = false;

  willUpdate(): void {
    const currentLayerId = this.layerId;
    if (!this.hasInitialized || currentLayerId !== this.previousLayerId) {
      this.hasInitialized = true;
      const firstId = this.filters[0]?.id;
      this.expandedFilterIds = new Set(firstId ?? undefined);
      this.previousLayerId = currentLayerId;
    }
  }

  private get filters(): LexicLayerAvailableFilter[] {
    return this.layerFilters ?? [];
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

  private readonly renderFilter = (
    filter: LexicLayerAvailableFilter,
    index: number,
  ) => {
    const filterId = filter.id ?? '';
    const isExpanded = this.expandedFilterIds.has(filterId);

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
          <ngm-core-icon
            class="filter-chevron ${isExpanded ? 'expanded' : ''}"
            icon="dropdown"
          ></ngm-core-icon>
        </button>
        ${isExpanded
          ? html`
              <div class="filter-content">
                <!-- TODO: Implement filter-specific UI (term selector, attribute filter, etc.) -->
                <span class="filter-placeholder"
                  >${filter.description ??
                  'Filter options will appear here'}</span
                >
              </div>
            `
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
    }

    .filter-header:hover {
      opacity: 0.8;
    }

    .filter-title {
      flex: 1;
    }

    .filter-chevron {
      transition: transform 150ms ease;
      color: var(--color-primary);
    }

    .filter-chevron.expanded {
      transform: rotate(180deg);
    }

    .filter-content {
      padding: 8px 0 12px;
    }

    .filter-placeholder {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-medium);
    }

    .and-separator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
      gap: 8px;
    }

    .and-separator::before,
    .and-separator::after {
      content: '';
      flex: 1;
      border-top: 2px dashed var(--color-primary);
    }

    .and-label {
      ${applyTypography('body-2')};
      color: var(--color-primary);
      flex-shrink: 0;
      padding: 0 4px;
    }
  `;
}
