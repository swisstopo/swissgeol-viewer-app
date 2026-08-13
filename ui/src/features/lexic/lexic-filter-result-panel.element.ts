import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { applyTypography } from 'src/styles/theme';
import { LexicFilterService, LexicResultState } from './lexic-filter.service';

@customElement('ngm-lexic-filter-result-panel')
export class LexicFilterResultPanel extends CoreElement {
  @consume({ context: LexicFilterService.context() })
  accessor filterService!: LexicFilterService;

  @state()
  accessor resultState: LexicResultState = 'idle';

  @state()
  accessor opacity = 70;

  @state()
  accessor hasActiveFilters = false;

  @state()
  accessor isLoadErrorDismissed = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.register(
      this.filterService.resultState$.subscribe((state) => {
        this.resultState = state;
        if (state === 'load-error') this.isLoadErrorDismissed = false;
      }),
    );
    this.register(
      this.filterService.resultOpacity$.subscribe((o) => {
        this.opacity = o;
      }),
    );
    this.register(
      this.filterService.filterList$.subscribe((list) => {
        this.hasActiveFilters = list.length > 0;
      }),
    );
  }

  private readonly handleOpacityInput = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    this.filterService.setResultOpacity(value);
  };

  private readonly handleReset = () => {
    this.filterService.removeAllFilters();
  };

  private readonly handleDismissLoadError = () => {
    this.isLoadErrorDismissed = true;
  };

  readonly render = () => {
    if (!this.hasActiveFilters && this.resultState === 'idle') {
      return html`<div class="divider"></div>`;
    }

    return html`
      <div class="divider"></div>

      ${
        this.resultState === 'load-error' && !this.isLoadErrorDismissed
          ? this.renderLoadErrorBanner()
          : nothing
      }

      <div class="opacity-section">
        <div class="opacity-row">
          <span class="opacity-swatch"></span>
          <span class="opacity-label"
            >${i18next.t('layout:lexic.filter.opacity')}</span
          >
          <span class="opacity-value">${this.opacity}%</span>
        </div>
        <div class="opacity-row">
          <input
            type="range"
            min="0"
            max="100"
            .value=${String(this.opacity)}
            style="--slider-progress: ${this.opacity}%"
            ?disabled=${this.resultState !== 'ok'}
            @input=${this.handleOpacityInput}
          />
        </div>

        <div class="button-row">
          <ngm-core-button variant="secondary" @click=${this.handleReset}>
            ${i18next.t('layout:lexic.filter.resetAll')}
            <ngm-core-icon icon="reset"></ngm-core-icon>
          </ngm-core-button>
        </div>

        <div class="divider"></div>
      </div>
    `;
  };

  private readonly renderLoadErrorBanner = () => html`
    <div class="banner banner--error">
      <ngm-core-icon icon="warning"></ngm-core-icon>
      <span class="banner-text"
        >${i18next.t('layout:lexic.filter.loadError')}</span
      >
      <button
        class="banner-dismiss"
        aria-label="${i18next.t('app_close_btn_label')}"
        @click=${this.handleDismissLoadError}
      >
        <ngm-core-icon icon="close"></ngm-core-icon>
      </button>
    </div>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .divider {
      border-top: 1px solid var(--color-border--default);
    }

    .banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
    }

    .banner--error {
      background-color: var(--color-bg--error-light);
      border: 1px solid var(--color-bg--error);
      border-radius: 4px;
      color: var(--color-bg--error);
    }

    .banner-text {
      ${applyTypography('body-2')};
      flex: 1;
    }

    .banner-dismiss {
      display: flex;
      align-items: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: inherit;
    }

    .banner-dismiss ngm-core-icon {
      width: 16px;
      height: 16px;
    }

    .opacity-section {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .opacity-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .opacity-swatch {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      background-color: #dcd61f;
      flex-shrink: 0;
    }

    .opacity-label {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-high);
      flex: 1;
    }

    .opacity-value {
      ${applyTypography('body-2')};
      color: var(--color-text--emphasis-medium);
      min-width: 36px;
      text-align: right;
    }

    input[type='range'] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      margin: 0;
      cursor: pointer;
      border-radius: 2px;
      outline: none;
      background: linear-gradient(
        to right,
        var(--color-primary--active) 0%,
        var(--color-primary--active) var(--slider-progress, 70%),
        var(--color-border--default) var(--slider-progress, 70%),
        var(--color-border--default) 100%
      );
    }

    input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid var(--color-primary);
      background: #fff;
      cursor: pointer;
    }

    input[type='range']::-moz-range-track {
      height: 4px;
      border-radius: 2px;
      background: var(--color-border--default);
    }

    input[type='range']::-moz-range-progress {
      height: 4px;
      border-radius: 2px;
      background: var(--color-primary);
    }

    input[type='range']::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid var(--color-primary);
      background: #fff;
      cursor: pointer;
    }

    input[type='range']:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    input[type='range']:disabled::-webkit-slider-thumb {
      cursor: not-allowed;
    }

    input[type='range']:disabled::-moz-range-thumb {
      cursor: not-allowed;
    }

    .button-row {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .button-row ngm-core-button {
      width: 100%;
      --button-border-radius: 6px;
      --button-bg: var(--color-bg--grey);
      --button-bg--hovered: var(--color-hovered);
      --button-bg--pressed: var(--color-pressed);
    }
  `;
}
