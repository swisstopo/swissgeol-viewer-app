import { consume } from '@lit/context';
import i18next from 'i18next';
import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { applyTypography } from 'src/styles/theme';
import { LexicApiService } from './lexic-api.service';
import { LexicFilterService } from './lexic-filter.service';
import {
  LexicLanguage,
  LexicLayer,
  LexicLayerAvailableFilter,
} from './lexic-api.model';

// FIXME: Remove this stub once the Lexic API is reachable without CORS issues.
// These mirror the real API response so the UI remains functional during local development.
function getStubLayers(lang: LexicLanguage): LexicLayer[] {
  const t = STUB_TRANSLATIONS[lang] ?? STUB_TRANSLATIONS.en;
  return [
    {
      id: 'tecto_units_augm',
      name: 'Tectonic Units',
      filterable: true,
      availableFilters: [
        {
          id: 'f-chronostrat-term',
          name: t.chronostrat,
          title: t.chronostrat,
          description: t.chronostratDesc,
        },
        {
          id: 'f-tectonic-term',
          name: t.tectonic,
          title: t.tectonic,
          description: t.tectonicDesc,
        },
        {
          id: 'f-byAttribute',
          name: t.attribute,
          title: t.attribute,
          description: t.attributeDesc,
        },
      ],
    },
    {
      id: 'gc_bedrock',
      name: 'GC_BEDROCK',
      filterable: true,
      availableFilters: [
        {
          id: 'f-chronostrat-term',
          name: t.chronostrat,
          title: t.chronostrat,
          description: t.chronostratDesc,
        },
        {
          id: 'f-tectonic-term',
          name: t.tectonic,
          title: t.tectonic,
          description: t.tectonicDesc,
        },
        {
          id: 'f-lithostrat-term',
          name: t.lithostrat,
          title: t.lithostrat,
          description: t.lithostratDesc,
        },
        {
          id: 'f-lithology-term',
          name: t.lithology,
          title: t.lithology,
          description: t.lithologyDesc,
        },
        {
          id: 'f-byAttribute',
          name: t.attribute,
          title: t.attribute,
          description: t.attributeDesc,
        },
      ],
    },
    {
      id: 'gc_unco_deposits',
      name: 'GC_UNCO_DEPOSITS',
      filterable: true,
      availableFilters: [
        {
          id: 'f-chronostrat-term',
          name: t.chronostrat,
          title: t.chronostrat,
          description: t.chronostratDesc,
        },
        {
          id: 'f-byAttribute',
          name: t.attribute,
          title: t.attribute,
          description: t.attributeDesc,
        },
      ],
    },
  ];
}

// FIXME: Remove, test for different languages in mocked API response
const STUB_TRANSLATIONS: Record<
  string,
  {
    chronostrat: string;
    chronostratDesc: string;
    tectonic: string;
    tectonicDesc: string;
    lithostrat: string;
    lithostratDesc: string;
    lithology: string;
    lithologyDesc: string;
    attribute: string;
    attributeDesc: string;
  }
> = {
  en: {
    chronostrat: 'Filter by Chronostratigraphy term',
    chronostratDesc: 'Filter by chronostratigraphic intervals',
    tectonic: 'Filter by Tectonic Units term',
    tectonicDesc: 'Filter by tectonic units',
    lithostrat: 'Filter by Lithostratigraphy term',
    lithostratDesc: 'Filter by lithostratigraphic units',
    lithology: 'Filter by Lithology term',
    lithologyDesc: 'Filter by lithology classes',
    attribute: 'Filter by Attribute',
    attributeDesc: 'Filter by attribute key/value',
  },
  de: {
    chronostrat: 'Nach Chronostratigraphie filtern',
    chronostratDesc: 'Nach chronostratigraphischen Intervallen filtern',
    tectonic: 'Nach tektonischen Einheiten filtern',
    tectonicDesc: 'Nach tektonischen Einheiten filtern',
    lithostrat: 'Nach Lithostratigraphie filtern',
    lithostratDesc: 'Nach lithostratigraphischen Einheiten filtern',
    lithology: 'Nach Lithologie filtern',
    lithologyDesc: 'Nach Lithologieklassen filtern',
    attribute: 'Nach Attribut filtern',
    attributeDesc: 'Nach Attribut-Schlüssel/Wert filtern',
  },
  fr: {
    chronostrat: 'Filtrer par terme chronostratigraphique',
    chronostratDesc: 'Filtrer par intervalles chronostratigraphiques',
    tectonic: 'Filtrer par unité tectonique',
    tectonicDesc: 'Filtrer par unités tectoniques',
    lithostrat: 'Filtrer par terme lithostratigraphique',
    lithostratDesc: 'Filtrer par unités lithostratigraphiques',
    lithology: 'Filtrer par terme lithologique',
    lithologyDesc: 'Filtrer par classes de lithologie',
    attribute: 'Filtrer par attribut',
    attributeDesc: "Filtrer par clé/valeur d'attribut",
  },
  it: {
    chronostrat: 'Filtrare per termine cronostratigrafico',
    chronostratDesc: 'Filtrare per intervalli cronostratigrafici',
    tectonic: 'Filtrare per unità tettonica',
    tectonicDesc: 'Filtrare per unità tettoniche',
    lithostrat: 'Filtrare per termine litostratigrafico',
    lithostratDesc: 'Filtrare per unità litostratigrafiche',
    lithology: 'Filtrare per termine litologico',
    lithologyDesc: 'Filtrare per classi di litologia',
    attribute: 'Filtrare per attributo',
    attributeDesc: "Filtrare per chiave/valore dell'attributo",
  },
};

@customElement('ngm-lexic-filter-panel')
export class LexicFilterPanel extends CoreElement {
  @consume({ context: LexicApiService.context() })
  accessor lexicApiService!: LexicApiService;

  @consume({ context: LexicFilterService.context() })
  accessor filterService!: LexicFilterService;

  @state()
  accessor isOpen = false;

  /** All layers returned by the Lexic API (or stub fallback). */
  @state()
  accessor layers: LexicLayer[] = [];

  @state()
  accessor selectedLayerId = '';

  @state()
  accessor isLoadingLayers = false;

  /**
   * Filters for the selected layer. Sourced from `Layer.availableFilters`
   * when available; falls back to a per-layer API call otherwise.
   */
  @state()
  accessor selectedLayerFilters: LexicLayerAvailableFilter[] | null = null;

  @state()
  accessor isLoadingFilters = false;

  private filtersRequestVersion = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.filterService.isOpen$.subscribe((isOpen) => {
        this.isOpen = isOpen;
      }),
    );

    void this.loadLayerOptions();
  }

  willChangeLanguage(_language: void): void {
    void this.loadLayerOptions();
  }

  private readonly handleClose = () => {
    this.filterService.close();
  };

  private readonly handleLayerSelection = (event: Event) => {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedLayerId = selectElement.value;
    this.applyFiltersForSelectedLayer();
  };

  private getLexicLanguage(): LexicLanguage {
    const language = i18next.resolvedLanguage ?? i18next.language;

    if (language.startsWith('de')) {
      return 'de';
    }

    if (language.startsWith('fr')) {
      return 'fr';
    }

    if (language.startsWith('it')) {
      return 'it';
    }

    return 'en';
  }

  /**
   * Applies filters for the currently selected layer.
   * Uses `availableFilters` from the layer response if present;
   * falls back to a per-layer API call otherwise.
   */
  private applyFiltersForSelectedLayer(): void {
    if (this.selectedLayerId === '') {
      this.selectedLayerFilters = null;
      return;
    }

    const layer = this.layers.find((l) => l.id === this.selectedLayerId);
    const available = layer?.availableFilters;
    if (available != null && available.length > 0) {
      this.selectedLayerFilters = available;
    } else {
      void this.loadSupportedFiltersForSelectedLayer();
    }
  }

  /** Fallback: fetches filters per-layer when `availableFilters` is missing. */
  private async loadSupportedFiltersForSelectedLayer(): Promise<void> {
    const layerId = this.selectedLayerId;
    const requestVersion = ++this.filtersRequestVersion;

    if (layerId === '') {
      this.selectedLayerFilters = null;
      this.isLoadingFilters = false;
      return;
    }

    this.isLoadingFilters = true;
    try {
      const response = await this.lexicApiService.getLayerFilters(
        layerId,
        this.getLexicLanguage(),
      );

      if (
        this.filtersRequestVersion === requestVersion &&
        this.selectedLayerId === layerId
      ) {
        this.selectedLayerFilters = response.filters ?? null;
      }
    } catch (error) {
      console.error(
        `[Lexic] Failed to load filters for layer "${layerId}":`,
        error,
      );
      if (
        this.filtersRequestVersion === requestVersion &&
        this.selectedLayerId === layerId
      ) {
        this.selectedLayerFilters = null;
      }
    } finally {
      if (this.filtersRequestVersion === requestVersion) {
        this.isLoadingFilters = false;
      }
    }
  }

  private async loadLayerOptions(): Promise<void> {
    this.isLoadingLayers = true;

    try {
      const response = await this.lexicApiService.getLayers(
        this.getLexicLanguage(),
      );
      this.layers = response.layers ?? [];
    } catch (error) {
      // FIXME: Remove this stub fallback once the Lexic API is reachable
      // without CORS issues (e.g. when a proxy or proper CORS headers are in place).
      console.warn(
        '[Lexic] getLayers API call failed, falling back to stub layers:',
        error,
      );
      this.layers = getStubLayers(this.getLexicLanguage());
    } finally {
      this.isLoadingLayers = false;
    }

    const requestedId = this.filterService.consumeRequestedDatasetId();
    const firstId = this.layers[0]?.id ?? '';
    const preferredId =
      requestedId != null && this.layers.some((l) => l.id === requestedId)
        ? requestedId
        : firstId;
    if (
      this.selectedLayerId === '' ||
      !this.layers.some((l) => l.id === this.selectedLayerId)
    ) {
      this.selectedLayerId = preferredId;
    }
    this.applyFiltersForSelectedLayer();
  }

  readonly render = () => {
    if (!this.isOpen) {
      return nothing;
    }

    return html`
      <div class="floating-panel">
        <header class="panel-header">
          <span class="panel-title"
            >${i18next.t('layout:items.Lexic')} Filter</span
          >
          <ngm-core-icon
            icon="close"
            interactive
            @click=${this.handleClose}
          ></ngm-core-icon>
        </header>

        <div class="panel-body">
          <section class="dataset-section">
            <span class="section-header-label"
              >${i18next.t('layout:lexic.datasetLabel')}</span
            >
            ${this.isLoadingLayers
              ? html`<ngm-core-loader></ngm-core-loader>`
              : html`
                  <div class="select-wrapper">
                    <select
                      .value=${this.selectedLayerId}
                      @change=${this.handleLayerSelection}
                    >
                      ${this.layers.map(
                        (layer) =>
                          html`<option value="${layer.id}">
                            ${layer.name ?? layer.id}
                          </option>`,
                      )}
                    </select>
                    <ngm-core-icon icon="dropdown"></ngm-core-icon>
                  </div>
                `}
          </section>

          <div class="horizontal-divider"></div>

          ${this.isLoadingFilters
            ? html`<ngm-core-loader></ngm-core-loader>`
            : html`<ngm-lexic-filter-container
                .layerFilters=${this.selectedLayerFilters}
                .layerId=${this.selectedLayerId}
              ></ngm-lexic-filter-container>`}
        </div>
      </div>
    `;
  };

  static readonly styles = css`
    :host {
      position: fixed;
      top: var(--ngm-header-height, 88px);
      right: 72px;
      z-index: 4;
      pointer-events: none;
    }

    .floating-panel {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      width: 320px;
      max-height: calc(100vh - var(--ngm-header-height, 88px) - 20px);
      margin-top: 10px;
      background-color: var(--color-bg--white, #fff);
      box-shadow: 4px 4px 2px #00000029;
      border-radius: 8px;
      overflow: hidden;
      color: var(--color-text--emphasis-high);
    }

    .panel-header {
      ${applyTypography('subtitle-1')};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background-color: var(--color-bg--dark);
      border-bottom: 1px solid #e0e2e6;
      flex-shrink: 0;
    }

    .panel-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: bold;
    }

    .panel-body {
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .dataset-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .section-header {
      ${applyTypography('body-2')};
      display: flex;
      align-items: center;
      color: var(--color-text--emphasis-high);
    }

    .section-header-label {
      display: block;
      margin: 0;
      padding: 0;
    }

    .select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 40px;
      border: 1px solid var(--color-border--emphasis-high);
      border-radius: 4px;
      background-color: var(--color-bg--white);
    }

    select {
      width: 100%;
      margin: 0;
      padding: 8px 36px 8px 12px;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--color-text--emphasis-medium);
      font: inherit;
      appearance: none;
      cursor: pointer;
    }

    option {
      color: var(--color-text--emphasis-medium);
    }

    .select-wrapper > ngm-core-icon {
      position: absolute;
      right: 10px;
      pointer-events: none;
      color: var(--color-primary);
    }

    .horizontal-divider {
      flex: 1;
      border-top: 1px var(--color-border--default) solid;
      margin: 8px -16px;
    }
  `;
}
