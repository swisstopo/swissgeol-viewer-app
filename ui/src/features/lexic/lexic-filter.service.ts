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
import {
  Credit,
  ImageryLayer,
  ImageryProvider,
  SingleTileImageryProvider,
  WebMapServiceImageryProvider,
} from 'cesium';
import {
  LEXIC_API_BY_PAGE_HOST,
  LEXIC_USE_SINGLE_TILE,
  SWITZERLAND_BOUNDS_WGS84,
  SWITZERLAND_RECTANGLE,
  WEB_MERCATOR_TILING_SCHEME,
} from 'src/constants';
import { showSnackbarError } from 'src/notifications';
import i18next from 'i18next';

export type LexicResultState = 'idle' | 'loading' | 'ok' | 'load-error';

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

  private readonly _resultState$ = new BehaviorSubject<LexicResultState>(
    'idle',
  );
  readonly resultState$: Observable<LexicResultState> =
    this._resultState$.asObservable();

  private readonly _resultOpacity$ = new BehaviorSubject<number>(70);
  readonly resultOpacity$: Observable<number> =
    this._resultOpacity$.asObservable();

  constructor() {
    super();
    this.initializeServices();
  }

  get resultOpacity(): number {
    return this._resultOpacity$.value;
  }

  private nextLocalId = 0;

  private _selectedLayerId = '';
  private _webmapId = '';

  private currentImagery: ImageryLayer | null = null;
  private updateVersion = 0;
  private tileErrorShownForVersion = -1;
  private servicesSubscription: Subscription | null = null;
  private cesiumService: CesiumService | null = null;
  private lexicApiService: LexicApiService | null = null;
  private layerAddedListener: (() => void) | null = null;
  private imageryErrorListener: (() => void) | null = null;

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
    ++this.updateVersion;
    this.removeFilteredLayer();
    this._resultState$.next('idle');
    this._isOpen$.next(false);
  }

  /** Toggles the panel, optionally pre-selecting a dataset when opening. */
  toggle(datasetId?: FilterId): void {
    if (this._isOpen$.value) {
      this.close();
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

  /** Sets result layer opacity (0–100%). Updates the live imagery if present. */
  setResultOpacity(percent: number): void {
    const clamped = Math.min(100, Math.max(0, percent));
    this._resultOpacity$.next(clamped);
    if (this.currentImagery != null) {
      this.currentImagery.alpha = clamped / 100;
      this.cesiumService?.viewerOrNull?.scene.requestRender();
    }
  }

  /**
   * Re-resolves display labels for all active filters using the vocabulary service.
   * Call this when the language changes to update cached label strings.
   */
  async retranslateFilters(
    resolve: (termUrl: string) => Promise<string | null>,
  ): Promise<void> {
    const current = this._filterList$.value;
    if (current.length === 0) return;

    const updated = await Promise.all(
      current.map(async (entry) => {
        const termUrl = (entry.parameters as { term?: string }).term;
        if (termUrl == null) return entry;
        const label = await resolve(termUrl);
        return label != null ? { ...entry, displayLabel: label } : entry;
      }),
    );
    this._filterList$.next(updated);
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
      this._resultState$.next('idle');
      return;
    }

    if (this.lexicApiService == null) {
      console.warn(
        '[Lexic] API service not yet available, skipping map update',
      );
      return;
    }

    this._resultState$.next('loading');

    let wmsResponse;
    try {
      wmsResponse = await this.lexicApiService.generateWmsRequest({
        webmapId: this._webmapId,
        layerId: this._selectedLayerId,
        filters,
      });
    } catch (error) {
      console.error('[Lexic] Failed to generate WMS request:', error);
      if (version === this.updateVersion) {
        this.removeFilteredLayer();
        this._resultState$.next('load-error');
        showSnackbarError(
          i18next.t('layout:lexic.errors.generateWmsRequest', {
            count: filters.length,
          }),
        );
      }
      return;
    }

    // Discard if a newer update was triggered in the meantime
    if (version !== this.updateVersion) return;

    try {
      await this.applyWmsLayer(wmsResponse.body, version);
      if (version === this.updateVersion) {
        this._resultState$.next('ok');
      }
    } catch (error) {
      console.error('[Lexic] Failed to load WMS tiles:', error);
      if (version === this.updateVersion) {
        this.removeFilteredLayer();
        this._resultState$.next('load-error');
        this.showTileLoadError(version);
      }
    }
  }

  private static readonly SINGLE_TILE_WIDTH = 2048;
  private static readonly SINGLE_TILE_HEIGHT = Math.round(
    2048 *
      ((SWITZERLAND_BOUNDS_WGS84[3] - SWITZERLAND_BOUNDS_WGS84[1]) /
        (SWITZERLAND_BOUNDS_WGS84[2] - SWITZERLAND_BOUNDS_WGS84[0])),
  );

  private async applyWmsLayer(wmsBody: string, version: number): Promise<void> {
    const cesium = this.cesiumService;
    if (!cesium?.isReady) {
      await firstValueFrom(
        CesiumService.inject$<CesiumService>(CesiumService).pipe(
          filter(() => this.cesiumService?.isReady === true),
        ),
      );
    }

    if (version !== this.updateVersion) {
      return;
    }

    const viewer = this.cesiumService!.viewer;
    const imageryLayers = viewer.scene.imageryLayers;

    const provider = LEXIC_USE_SINGLE_TILE
      ? this.createSingleTileProvider(wmsBody)
      : this.createTiledWmsProvider(wmsBody);

    // Remove previous filtered layer if present
    this.removeFilteredLayer();

    this.attachImageryErrorHandler(provider, version);

    const imagery = new ImageryLayer(provider, {
      show: true,
      alpha: this._resultOpacity$.value / 100,
    });

    // Add on top of all existing layers
    imageryLayers.add(imagery);
    imageryLayers.raiseToTop(imagery);
    this.currentImagery = imagery;

    // Keep layer on top when other layers are added
    this.layerAddedListener = () => {
      if (this.currentImagery != null) {
        imageryLayers.raiseToTop(this.currentImagery);
      }
    };
    imageryLayers.layerAdded.addEventListener(this.layerAddedListener);

    viewer.scene.requestRender();
  }

  private attachImageryErrorHandler(
    provider: ImageryProvider,
    version: number,
  ): void {
    this.detachImageryErrorHandler();
    this.imageryErrorListener = () => {
      if (version !== this.updateVersion) return;
      this.showTileLoadError(version);
    };
    provider.errorEvent.addEventListener(this.imageryErrorListener);
  }

  private detachImageryErrorHandler(): void {
    if (
      this.imageryErrorListener != null &&
      this.currentImagery?.imageryProvider != null
    ) {
      this.currentImagery.imageryProvider.errorEvent.removeEventListener(
        this.imageryErrorListener,
      );
    }
    this.imageryErrorListener = null;
  }

  private showTileLoadError(version: number): void {
    if (this.tileErrorShownForVersion === version) return;
    this.tileErrorShownForVersion = version;
    showSnackbarError(i18next.t('layout:lexic.errors.loadTiles'));
  }

  private createSingleTileProvider(wmsBody: string): SingleTileImageryProvider {
    return new SingleTileImageryProvider({
      url: this.buildSingleTileUrl(wmsBody),
      tileWidth: LexicFilterService.SINGLE_TILE_WIDTH,
      tileHeight: LexicFilterService.SINGLE_TILE_HEIGHT,
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit('swisstopo Lexic Filter'),
    });
  }

  private createTiledWmsProvider(
    wmsBody: string,
  ): WebMapServiceImageryProvider {
    const customParams = this.parseWmsCustomParams(wmsBody);
    return new WebMapServiceImageryProvider({
      url: LexicFilterService.buildWmsUrl(),
      crs: 'EPSG:4326',
      parameters: customParams,
      tilingScheme: WEB_MERCATOR_TILING_SCHEME,
      layers: this._selectedLayerId,
      rectangle: SWITZERLAND_RECTANGLE,
      credit: new Credit('swisstopo Lexic Filter'),
    });
  }

  private removeFilteredLayer(): void {
    this.detachImageryErrorHandler();

    if (this.currentImagery == null) return;

    const viewer = this.cesiumService?.viewerOrNull;
    if (viewer != null) {
      if (this.layerAddedListener != null) {
        viewer.scene.imageryLayers.layerAdded.removeEventListener(
          this.layerAddedListener,
        );
        this.layerAddedListener = null;
      }
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
   * Standard WMS params that are overridden for the single-tile request.
   * These are set explicitly to match the Switzerland extent and tile dimensions.
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

  /** Build a complete WMS GetMap URL that returns a single image for the full extent. */
  private buildSingleTileUrl(body: string): string {
    const baseUrl = LexicFilterService.buildWmsUrl();
    const bodyParams = this.parseWmsBodyParams(body);

    // Collect custom params from the body (STYLES, SEMANTIC_FILTER, VERSION, FORMAT, etc.)
    const queryParts: string[] = [];
    for (const [key, value] of Object.entries(bodyParams)) {
      if (!LexicFilterService.WMS_MANAGED_PARAMS.has(key.toUpperCase())) {
        queryParts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        );
      }
    }

    // WMS 1.3.0 with CRS=EPSG:4326 uses axis order lat/lon (minY,minX,maxY,maxX)
    const [minX, minY, maxX, maxY] = SWITZERLAND_BOUNDS_WGS84;
    const bbox = `${minY},${minX},${maxY},${maxX}`;

    // Add standard WMS GetMap params for a single full-extent image
    queryParts.push(
      'SERVICE=WMS',
      'REQUEST=GetMap',
      `LAYERS=${encodeURIComponent(this._selectedLayerId)}`,
      'CRS=EPSG%3A4326',
      `BBOX=${bbox}`,
      `WIDTH=${LexicFilterService.SINGLE_TILE_WIDTH}`,
      `HEIGHT=${LexicFilterService.SINGLE_TILE_HEIGHT}`,
    );

    return `${baseUrl}?${queryParts.join('&')}`;
  }

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
   * Returns only custom params (STYLES, SEMANTIC_FILTER, VERSION, FORMAT, etc.),
   * stripping out standard WMS params that CesiumJS manages per-tile.
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
