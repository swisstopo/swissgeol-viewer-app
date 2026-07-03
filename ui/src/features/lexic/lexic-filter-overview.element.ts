import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { applyTypography } from 'src/styles/theme';
import { LexicFilterId } from './lexic-api.model';
import { LexicActiveFilter, LexicFilterService } from './lexic-filter.service';

/**
 * Generic filter overview for a single filter category.
 *
 * Displays the list of active filters (ORed), a reset button,
 * and an "Add filter" button that dispatches an event for the
 * parent to open the filter dialog.
 */
@customElement('ngm-lexic-filter-overview')
export class LexicFilterOverview extends CoreElement {
  @consume({ context: LexicFilterService.context() })
  accessor filterService!: LexicFilterService;

  @property({ attribute: false })
  accessor filterId!: LexicFilterId;

  @property({ attribute: false })
  accessor activeFilters: LexicActiveFilter[] = [];

  private readonly handleReset = () => {
    this.filterService.removeCategory(this.filterId);
  };

  private readonly handleRemove = (localId: string) => {
    this.filterService.removeFilter(localId);
  };

  private readonly handleAddFilter = () => {
    this.dispatchEvent(
      new CustomEvent('open-filter-dialog', {
        bubbles: true,
        composed: true,
        detail: { filterId: this.filterId },
      }),
    );
  };

  readonly render = () => {
    const hasFilters = this.activeFilters.length > 0;

    return html`
      ${hasFilters
        ? html`
            <button class="reset-button" @click=${this.handleReset}>
              ${i18next.t('layout:lexic.filter.reset')}
            </button>
          `
        : nothing}

      <div class="filter-entries">
        ${this.activeFilters.map((filter, index) =>
          this.renderFilterEntry(filter, index),
        )}
      </div>

      <ngm-core-button variant="secondary" @click=${this.handleAddFilter}>
        ${i18next.t('layout:lexic.filter.addFilter')}
        <ngm-core-icon icon="plus"></ngm-core-icon>
      </ngm-core-button>
    `;
  };

  private readonly renderFilterEntry = (
    filter: LexicActiveFilter,
    index: number,
  ) => html`
    <div class="filter-entry">
      <span class="filter-label">${filter.displayLabel}</span>
      <button
        class="remove-button"
        @click=${() => this.handleRemove(filter.localId)}
        aria-label="Remove filter"
      >
        <ngm-core-icon icon="close"></ngm-core-icon>
      </button>
      ${index < this.activeFilters.length - 1
        ? html`<span class="or-badge"
            >${i18next.t('layout:lexic.filter.or')}</span
          >`
        : nothing}
    </div>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .reset-button {
      ${applyTypography('body-2')};
      background: none;
      border: none;
      color: var(--color-primary);
      cursor: pointer;
      padding: 0;
      align-self: flex-start;
    }

    .reset-button:hover {
      opacity: 0.8;
    }

    .filter-entries {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .filter-entry {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .filter-label {
      ${applyTypography('body-2')};
      display: flex;
      align-items: center;
      padding: 4px 8px;
      border: 1px solid var(--color-border--default);
      border-radius: 4px;
      background-color: var(--color-bg--white);
      color: var(--color-text--emphasis-high);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .remove-button {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: var(--color-text--emphasis-medium);
    }

    .remove-button ngm-core-icon {
      width: 16px;
      height: 16px;
    }

    .remove-button:hover {
      color: var(--color-primary);
    }

    .or-badge {
      ${applyTypography('overline')};
      font-weight: 700;
      color: var(--color-primary);
      padding: 2px 6px;
      border: 1px solid var(--color-primary);
      border-radius: 4px;
      white-space: nowrap;
    }

    ngm-core-button {
      width: 100%;
      margin-top: 4px;
    }
  `;
}
