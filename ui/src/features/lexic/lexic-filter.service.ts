import {
  BehaviorSubject,
  Observable,
  Subscription,
  firstValueFrom,
  filter,
} from 'rxjs';
import { BaseService } from 'src/services/base.service';
import {
  LexicFilterId,
  LexicFilterParameter,
  LexicWmsRequestFilter,
} from './lexic-api.model';
import { LexicApiService } from './lexic-api.service';
import { CesiumService } from 'src/services/cesium.service';
import { FilterId } from 'src/features/lexic/generated/lexic-schemas';
import { Credit, ImageryLayer, WebMapServiceImageryProvider } from 'cesium';
import {
  LEXIC_API_BY_PAGE_HOST,
  SWITZERLAND_RECTANGLE,
  WEB_MERCATOR_TILING_SCHEME,
} from 'src/constants';

export interface LexicActiveFilter {
  localId: string;
  filterId: LexicFilterId;
  parameters: LexicFilterParameter;
  displayLabel: string;
}

export class LexicFilterService extends BaseService {
  private readonly _isOpen$ = new BehaviorSubject<boolean>(false);
  readonly isOpen$: Observable<boolean> = this._isOpen$.asObservable();

  private readonly _requestedDatasetId$ = new BehaviorSubject<string | null>(
    null,
  );
  readonly requestedDatasetId$: Observable<string | null> =
    this._requestedDatasetId$.asObservable();

  private readonly _selectedDatasetId$ = new BehaviorSubject<string | null>(
    null,
  );
  readonly selectedDatasetId$: Observable<string | null> =
    this._selectedDatasetId$.asObservable();

  private readonly _filterList$ = new BehaviorSubject<LexicActiveFilter[]>([]);
  readonly filterList$: Observable<LexicActiveFilter[]> =
    this._filterList$.asObservable();

  private nextLocalId = 0;

  private _selectedLayerId = '';
  private _webmapId = '';

  private currentImagery: ImageryLayer | null = null;
  private updateVersion = 0;
  private servicesSubscription: Subscription | null = null;
  private cesiumService: CesiumService | null = null;
  private lexicApiService: LexicApiService | null = null;

  constructor() {
    super();
    this.initializeServices();
  }

  private initializeServices(): void {
    const cesium$ = CesiumService.inject$<CesiumService>(CesiumService);
    const api$ = LexicApiService.inject$<LexicApiService>(LexicApiService);

    this.servicesSubscription = new Subscription();
    this.servicesSubscription.add(
      cesium$.subscribe((service) => {
        this.cesiumService = service;
      }),
    );
    this.servicesSubscription.add(
      api$.subscribe((service) => {
        this.lexicApiService = service;
      }),
    );
  }

  get isOpen(): boolean {
    return this._isOpen$.value;
  }

  get selectedDatasetId(): string | null {
    return this._selectedDatasetId$.value;
  }

  set selectedDatasetId(id: string | null) {
    this._selectedDatasetId$.next(id);
  }

  get filterList(): ReadonlyArray<LexicActiveFilter> {
    return this._filterList$.value;
  }

  /** Sets the currently selected lexic layer and webmap context. */
  setSelectedLayer(layerId: string, webmapId: string): void {
    const hasChanged =
      this._selectedLayerId !== layerId || this._webmapId !== webmapId;
    this._selectedLayerId = layerId;
    this._webmapId = webmapId;
    if (hasChanged) {
      this.updateMapLayer();
    }
  }

  /** Opens the panel, optionally pre-selecting a dataset. */
  open(datasetId?: FilterId): void {
    if (datasetId != null) {
      this._requestedDatasetId$.next(datasetId);
    }
    this._isOpen$.next(true);
  }

  close(): void {
    this._isOpen$.next(false);
  }

  /** Toggles the panel, optionally pre-selecting a dataset when opening. */
  toggle(datasetId?: FilterId): void {
    if (this._isOpen$.value) {
      this._isOpen$.next(false);
    } else {
      this.open(datasetId);
    }
  }

  /** Clears the requested dataset so it is only consumed once. */
  consumeRequestedDatasetId(): string | null {
    const id = this._requestedDatasetId$.value;
    this._requestedDatasetId$.next(null);
    return id;
  }

  /**
   * Adds a filter and triggers a map layer update.
   * Returns a generated local ID that uniquely identifies this filter entry.
   */
  addFilter(filter: LexicWmsRequestFilter, displayLabel: string): string {
    const localId = this.generateLocalId();
    const entry: LexicActiveFilter = {
      localId,
      filterId: filter.filterId! as LexicFilterId,
      parameters: filter.parameters! as LexicFilterParameter,
      displayLabel,
    };
    this._filterList$.next([...this._filterList$.value, entry]);
    this.updateMapLayer();
    return localId;
  }

  /** Removes the filter identified by its local ID and triggers a map layer update. */
  removeFilter(localId: string): void {
    const next = this._filterList$.value.filter((f) => f.localId !== localId);
    this._filterList$.next(next);
    this.updateMapLayer();
  }

  /** Removes all filters of a given category (filterId) and triggers a map layer update. */
  removeCategory(filterId: LexicFilterId): void {
    const next = this._filterList$.value.filter((f) => f.filterId !== filterId);
    this._filterList$.next(next);
    this.updateMapLayer();
  }

  /** Removes all filters and hides the map layer. */
  removeAllFilters(): void {
    this._filterList$.next([]);
    this.updateMapLayer();
  }

  /** Converts the current filter list into the API request format. */
  toWmsRequestFilters(): LexicWmsRequestFilter[] {
    return this._filterList$.value.map((f) => ({
      filterId: f.filterId,
      parameters: f.parameters,
    }));
  }

  private generateLocalId(): string {
    return `lexic-filter-${++this.nextLocalId}`;
  }

  /**
   * Triggers a map layer update based on the current filter list.
   * Calls the Lexic API to generate a WMS request, then displays
   * the resulting layer on top of all existing imagery layers.
   */
  private updateMapLayer(): void {
    const version = ++this.updateVersion;
    void this.applyMapLayer(version);
  }

  private async applyMapLayer(version: number): Promise<void> {
    const filters = this.toWmsRequestFilters();

    // No filters → remove the filtered layer
    if (filters.length === 0 || this._selectedLayerId === '') {
      this.removeFilteredLayer();
      return;
    }

    if (this.lexicApiService == null) {
      console.warn(
        '[Lexic] API service not yet available, skipping map update',
      );
      return;
    }

    try {
      const wmsResponse = await this.lexicApiService.generateWmsRequest({
        webmapId: this._webmapId,
        layerId: this._selectedLayerId,
        filters,
      });

      // Discard if a newer update was triggered in the meantime
      if (version !== this.updateVersion) return;

      await this.applyWmsLayer(wmsResponse.url, wmsResponse.body);
    } catch (error) {
      console.error('[Lexic] Failed to generate WMS request:', error);
      if (version === this.updateVersion) {
        this.removeFilteredLayer();
      }
    }
  }

  private async applyWmsLayer(_wmsUrl: string, wmsBody: string): Promise<void> {
    const cesium = this.cesiumService;
    if (cesium == null || !cesium.isReady) {
      await firstValueFrom(
        CesiumService.inject$<CesiumService>(CesiumService).pipe(
          filter(() => this.cesiumService?.isReady === true),
        ),
      );
    }

    const viewer = this.cesiumService!.viewer;
    const imageryLayers = viewer.scene.imageryLayers;

    // Parse body and strip params that CesiumJS manages per-tile.
    const customParams = this.parseWmsCustomParams(wmsBody);

    const wmsUrl = LexicFilterService.buildWmsUrl();

    const provider = new WebMapServiceImageryProvider({
      url: wmsUrl,
      crs: 'EPSG:4326',
      parameters: customParams,
      tilingScheme: WEB_MERCATOR_TILING_SCHEME,
      layers: this._selectedLayerId,
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit('swisstopo Lexic Filter'),
    });

    const imagery = new ImageryLayer(provider, {
      show: true,
      alpha: 1.0,
    });

    // Remove previous filtered layer if present
    this.removeFilteredLayer();

    // Add on top of all existing layers
    imageryLayers.add(imagery);
    imageryLayers.raiseToTop(imagery);
    this.currentImagery = imagery;

    viewer.scene.requestRender();
  }

  private removeFilteredLayer(): void {
    if (this.currentImagery == null) return;

    const viewer = this.cesiumService?.viewerOrNull;
    if (viewer != null) {
      try {
        viewer.scene.imageryLayers.remove(this.currentImagery, true);
        viewer.scene.requestRender();
      } catch {
        // Layer may already have been destroyed
      }
    }
    this.currentImagery = null;
  }

  /**
   * Standard WMS params that CesiumJS computes per-tile or always sets correctly.
   * VERSION and FORMAT are intentionally NOT included — they must be passed through
   * to override CesiumJS defaults (1.1.1 → 1.3.0, image/jpeg → image/png).
   */
  private static readonly WMS_MANAGED_PARAMS = new Set([
    'REQUEST',
    'SERVICE',
    'LAYERS',
    'CRS',
    'SRS',
    'BBOX',
    'WIDTH',
    'HEIGHT',
  ]);

  /** Build the WMS proxy URL from the Lexic API base. */
  private static buildWmsUrl(): string {
    const host =
      typeof globalThis.location !== 'undefined'
        ? globalThis.location.host
        : 'localhost:8000';
    const baseUrl =
      LEXIC_API_BY_PAGE_HOST[host] ?? 'https://dev-webmap-api.swissgeol.ch/v1';
    return `${baseUrl}/wms`;
  }

  /**
   * Parses the body string and returns only custom params (STYLES, SEMANTIC_FILTER, TILED, etc.),
   * stripping out standard WMS params that CesiumJS manages.
   */
  private parseWmsCustomParams(body: string): Record<string, string> {
    const all = this.parseWmsBodyParams(body);
    const custom: Record<string, string> = {};
    for (const [key, value] of Object.entries(all)) {
      if (!LexicFilterService.WMS_MANAGED_PARAMS.has(key.toUpperCase())) {
        custom[key] = value;
      }
    }
    return custom;
  }

  private parseWmsBodyParams(body: string): Record<string, string> {
    const params: Record<string, string> = {};
    if (!body) return params;
    const parts = body.split('&');
    for (const part of parts) {
      const eqIndex = part.indexOf('=');
      if (eqIndex >= 0) {
        const key = decodeURIComponent(part.substring(0, eqIndex));
        const value = decodeURIComponent(part.substring(eqIndex + 1));
        params[key] = value;
      }
    }
    return params;
  }
}
