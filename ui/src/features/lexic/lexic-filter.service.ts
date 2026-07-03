import { BehaviorSubject, Observable } from 'rxjs';
import { BaseService } from 'src/services/base.service';
import {
  LexicFilterId,
  LexicFilterParameter,
  LexicWmsRequestFilter,
} from './lexic-api.model';

export interface LexicActiveFilter {
  localId: string;
  filterId: LexicFilterId;
  parameters: LexicFilterParameter;
}

export class LexicFilterService extends BaseService {
  private readonly _isOpen$ = new BehaviorSubject<boolean>(false);
  readonly isOpen$: Observable<boolean> = this._isOpen$.asObservable();

  private readonly _requestedDatasetId$ = new BehaviorSubject<string | null>(
    null,
  );
  readonly requestedDatasetId$: Observable<string | null> =
    this._requestedDatasetId$.asObservable();

  private readonly _filterList$ = new BehaviorSubject<LexicActiveFilter[]>([]);
  readonly filterList$: Observable<LexicActiveFilter[]> =
    this._filterList$.asObservable();

  private nextLocalId = 0;

  constructor() {
    super();
  }

  get isOpen(): boolean {
    return this._isOpen$.value;
  }

  get filterList(): ReadonlyArray<LexicActiveFilter> {
    return this._filterList$.value;
  }

  /** Opens the panel, optionally pre-selecting a dataset. */
  open(datasetId?: string): void {
    if (datasetId != null) {
      this._requestedDatasetId$.next(datasetId);
    }
    this._isOpen$.next(true);
  }

  close(): void {
    this._isOpen$.next(false);
  }

  /** Toggles the panel, optionally pre-selecting a dataset when opening. */
  toggle(datasetId?: string): void {
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
  addFilter(filter: LexicWmsRequestFilter): string {
    const localId = this.generateLocalId();
    const entry: LexicActiveFilter = {
      localId,
      filterId: filter.filterId! as LexicFilterId,
      parameters: filter.parameters! as LexicFilterParameter,
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
   * TODO: Implement actual map layer update logic
   */
  private updateMapLayer(): void {
    // Stub: will be wired to WMS request generation and layer refresh.
  }
}
