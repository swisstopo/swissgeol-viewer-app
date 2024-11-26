import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n';
import {css, html, PropertyValues} from 'lit';
import i18next from 'i18next';
import {BBox, Feature, GeoJsonProperties} from 'geojson';

import '@geoblocks/ga-search';
import {getLayersConfig, SwisstopoImageryLayersConfig} from '../../swisstopoImagery';
import {Cartographic, Entity as CesiumEntity, Math as CesiumMath, Rectangle, Viewer as CesiumViewer} from 'cesium';
import {lv95ToDegrees} from '../../projection';
import {escapeRegExp} from '../../utils';
import {extractEntitiesAttributes} from '../../query/objectInformation';
import auth from '../../store/auth';
import defaultLayerTree, {LayerTreeNode} from '../../layertree';
import NavToolsStore from '../../store/navTools';
import {SearchLayer, SearchLayerWithLayer, SideBar} from '../../elements/ngm-side-bar'; // <ga-search> component
import {createRef, ref} from 'lit/directives/ref.js';

@customElement('ngm-search-input')
export class SearchInput extends LitElementI18n {
  @property()
  private accessor viewer: CesiumViewer | null = null

  @property()
  private accessor sidebar: SideBar | null = null

  @state()
  private accessor isActive = false

  private accessor searchRef = createRef<HTMLElement>()
  private accessor inputRef = createRef<HTMLInputElement>()
  private accessor resultsRef = createRef<HTMLUListElement>()

  private layerConfigs: SwisstopoImageryLayersConfig | null = null;

  constructor() {
    super();
    this.initialize();

    // Bind `this` for callback methods.
    this.clear = this.clear.bind(this);
    this.handleItemSelected = this.handleItemSelected.bind(this);
    this.handleInputKeyPress = this.handleInputKeyPress.bind(this);
    this.handleResultsHovered = this.handleResultsHovered.bind(this);
    this.matchFeature = this.matchFeature.bind(this);
    this.renderItem = this.renderItem.bind(this);
    this.searchAdditionalItems = this.searchAdditionalItems.bind(this);
    this.toggleActive = this.toggleActive.bind(this);
  }

  private initialize(): void {
    getLayersConfig().then((layersConfig) => {
      this.layerConfigs = layersConfig;
    });
  }

  render = () => html`
    <ga-search
      ${ref(this.searchRef)}
      types="location,additionalSource,layer,feature"
      locationOrigins="zipcode,gg25,gazetteer"
      .filterResults="${this.matchFeature}"
      .renderResult="${this.renderItem}"
      .additionalSource="${{
        search: this.searchAdditionalItems,
        getResultValue: (item: AdditionalItem) => item.label,
      }}"
      @submit="${this.handleItemSelected}"
    >
      <!-- Freeze the event's target to this input, as otherwise, ga-input is unable to read the input's value. -->
      <input
        ${ref(this.inputRef)}
        type="search"
        placeholder="${i18next.t('header_search_placeholder')}"
        @input="${freezeEventTarget}"
        @click="${captureEvent}"
        @keydown="${this.handleInputKeyPress}"
      >
      <ul ${ref(this.resultsRef)} @mouseover="${this.handleResultsHovered}"></ul>
    </ga-search>

    <span class="icon is-close" @click="${this.clear}"></span>
    <span class="icon is-search" @click="${this.toggleActive}"></span>
  `;

  protected updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    if (changedProperties.has('isActive' as keyof SearchInput)) {
      if (this.isActive) {
        this.classList.add('is-active');
      } else {
        this.classList.remove('is-active');
      }
    }
  }

  private clear(): void {
    const {value: input} = this.inputRef;
    if (input == null) {
      return;
    }
    input.value = '';
  }

  private toggleActive(): void {
    this.isActive = !this.isActive;
    setTimeout(() => {
      const {value: input} = this.inputRef;
      if (input == null) {
        return;
      }
      if (this.isActive) {
        input.focus();
      } else {
        input.blur();
      }
    });
  }

  /**
   * Determines if a feature is listed in the search results.
   * @param feature The feature to match.
   * @private
   */
  private matchFeature(feature: Feature): boolean {
    if (this.layerConfigs == null || feature.properties == null || feature.properties.origin !== 'layer') {
      return true;
    }
    const layerName: string = feature.properties.layer;
    const layerConfig = layerName != null && this.layerConfigs[layerName];
    return layerConfig && (layerConfig.type === 'wmts' || layerConfig.type === 'wms');
  }

  /**
   * Render a {@link SearchItem} as a search result.
   * @param item The item to render.
   * @param label The item's display text.
   * @private
   */
  private renderItem(item: SearchItem, label: string): string {
    const categorizedItem = categorizeSearchItem(item);
    const icon = getIconForCategory(categorizedItem.category);
    return `<img src='./images/${icon}.svg' alt=""/><b>${label}</b>`;
  }

  private searchAdditionalItems(query: string): Promise<AdditionalItem[]> {
    const regexQuery = new RegExp(escapeRegExp(query), 'i');
    return Promise.resolve([
      ...this.searchAdditionalItemsByCoordinates(query),
      ...this.searchAdditionalItemsByRegex(regexQuery),
      ...this.searchAdditionalItemsByCatalog(regexQuery),
    ]);
  }

  private searchAdditionalItemsByCoordinates(query: string): AdditionalItem[] {
    const COORDINATE_PATTERN = /(\d[\d.']*)[\s,/]+(\d[\d.']*)/;
    const coordinateMatches = COORDINATE_PATTERN.exec(query);
    if (coordinateMatches === null) {
      return [];
    }

    const left = parseFloat(coordinateMatches[1].replace(/'/g, ''));
    const right = parseFloat(coordinateMatches[2].replace(/'/g, ''));
    if (!isFinite(left) || !isFinite(right)) {
      return [];
    }

    const coordinates = [left, right];
    coordinates.sort((a, b) => a - b);
    coordinates.reverse();
    const bbox = [...lv95ToDegrees(coordinates), ...lv95ToDegrees(coordinates)];
    return [{
      label: `Recenter to ${coordinates.map((coord) => coordinateFormat.format(coord)).join(' ')}`,
      bbox: bbox as BBox,
      origin: 'coordinates',
    }];
  }

  private searchAdditionalItemsByRegex(query: RegExp): AdditionalItem[] {
    if (this.viewer == null) {
      return [];
    }
    const results: AdditionalItem[] = [];
    const dataSources = this.viewer.dataSources;
    for (let i = 0, ii = dataSources.length; i < ii; i++) {
      const dataSource = dataSources.get(i);
      dataSource.entities.values.forEach(entity => {
        const attributes = extractEntitiesAttributes(entity);
        if (attributes && query.test(attributes.EventLocationName)) {
          results.push({
            entity: entity,
            label: `${attributes.EventLocationName} (${attributes.Magnitude})`,
            dataSourceName: dataSource.name,
          });
        }
      });
    }
    return results;
  }

  private searchAdditionalItemsByCatalog(query: RegExp): AdditionalItem[] {
    return this.searchAdditionalItemsByLayerTree(query, defaultLayerTree);
  }

  private searchAdditionalItemsByLayerTree(query: RegExp, layerTree: LayerTreeNode[]): AdditionalItem[] {
    const results: AdditionalItem[] = [];
    const user = auth.user.getValue();
    for (const layer of layerTree) {
      if (layer.children) {
        results.push(...this.searchAdditionalItemsByLayerTree(query, layer.children));
      } else if (query.test(layer.label)) {
        layer.label = `${i18next.t(layer.label)}`;
        if (!layer.restricted?.length || layer.restricted.some(g => user?.['cognito:groups'].includes(g))) {
          results.push(layer);
        }
      }
    }
    return results;
  }

  private handleResultsHovered(event: MouseEvent): void {
    const i = (event.target as HTMLElement).dataset['resultIndex'];
    if (i == null) {
      return;
    }
    const item = this.resultItems[i];
    if (item != null) {
      this.selectItem(item, {keepFocus: true});
    }
  }

  private handleItemSelected(event: SearchEvent): void {
    this.selectItem(event.detail.result, {allowLayerChanges: true});
  }

  private selectItem(item: SearchItem, options: { keepFocus?: boolean, allowLayerChanges?: boolean } = {}): void {
    const categorized = categorizeSearchItem(item);
    switch (categorized.category) {
      case SearchItemCategory.Location:
        this.selectLocation(categorized.item);
        break;
      case SearchItemCategory.GeoAdminLayer:
        if (options.allowLayerChanges) {
          this.selectGeoadminLayer(categorized.item);
        }
        break;
      case SearchItemCategory.NgmLayer:
        this.selectNgmLayer(categorized.item);
        break;
    }
    if (!options.keepFocus) {
      this.inputRef.value?.blur();
    }
  }

  private selectLocation(item: FeatureWithLocation | CoordinateItem): void {
    this.flyToBBox(item.bbox);
  }

  private selectGeoadminLayer(feature: Feature): void {
    if (this.sidebar == null) {
      return;
    }
    this.sidebar.addLayerFromSearch(feature.properties as SearchLayer).then();
  }

  private selectNgmLayer(item: EntityItem | LayerTreeNode): void {
    if (this.sidebar == null) {
      return;
    }
    NavToolsStore.hideTargetPoint();
    const layer = isEntityItem(item) ? item : item as SearchLayerWithLayer;
    this.sidebar.addLayerFromSearch(layer).then();
    if (this.viewer != null && isEntityItem(item)) {
      this.viewer.zoomTo(item.entity).then();
    }
  }

  private flyToBBox(bbox: BBox): void {
    if (this.viewer == null) {
      return;
    }
    NavToolsStore.hideTargetPoint();
    const rectangle = Rectangle.fromDegrees(...bbox);
    if (rectangle.width < CesiumMath.EPSILON3 || rectangle.height < CesiumMath.EPSILON3) {
      // rectangle is too small
      const center = Rectangle.center(rectangle);
      center.height = 5000;
      this.viewer.camera.cancelFlight();
      this.viewer.camera.flyTo({
        destination: Cartographic.toCartesian(center),
      });
    } else {
      this.viewer.camera.cancelFlight();
      this.viewer.camera.flyTo({
        destination: rectangle,
      });
    }
  }

  /**
   * Callback that is invoked when a key is pressed while the input element is focussed.
   *
   * @param event The event that caused the function to be called.
   * @private
   */
  private handleInputKeyPress(event: KeyboardEvent): void {
    event.stopPropagation();
    switch (event.key) {
      case 'Enter': {
        const target = this.findEnterTarget();
        if (target != null) {
          const [_item, element] = target;
          element.click();
        }
        break;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        // Wait for a short interval before attempting to detect the currently selected item
        // so the search has time to update the DOM.
        setTimeout(() => {
          const target = this.findActiveResult();
          if (target != null) {
            const [item, _element] = target;
            this.selectItem(item, {keepFocus: true});
          }
        });
        break;
      }
      default:
        break;
    }
  }

  private findEnterTarget(): [SearchItem, HTMLLIElement] | null {
    const {value: search} = this.searchRef;
    const {value: results} = this.resultsRef;
    if (search == null || results == null) {
      return null;
    }

    // Check if there is an element that has been selected via the arrow keys.
    const activeResult = this.findActiveResult();
    if (activeResult != null) {
      return activeResult;
    }

    // If there is no selected element, we attempt to select the overall first element.
    const firstItemElement = results.children.item(0) as HTMLLIElement | null;
    if (firstItemElement != null) {
      return [this.resultItems[0], firstItemElement];
    }
    return null;
  }

  private findActiveResult(): [SearchItem, HTMLLIElement] | null {
    const {value: results} = this.resultsRef;
    if (results == null) {
      return null;
    }

    for (let i = 0; i < results.children.length; i++) {
      const child = results.children[i];
      if (child.ariaSelected === 'true') {
        const item = this.resultItems[i];
        return [item, child as HTMLLIElement];
      }
    }
    return null;
  }

  private get resultItems(): SearchItem[] {
    const {value: search} = this.searchRef;
    if (search == null) {
      return [];
    }
    const items = (search as any).autocomplete.core.results as Array<Feature | {
      type: 'additionalSource',
      result: SearchItem
    }>;
    return items.map((item) => {
      if ('type' in item && item.type === 'additionalSource') {
        return item.result;
      }
      return item;
    });
  }

  static readonly styles = css`
    :host {
      display: flex;
      height: 100%;
      align-self: center;
      flex: 2;

      --padding-h: 1rem;
      --padding-v: 1rem;
      --icon-size: 24px;
    }

    :host {
      position: absolute;
      left: 0;
      top: 0;
      height: var(--ngm-header-height-mobile);
      width: calc(var(--content-width) - var(--suffix-width) + var(--header-padding-l));
    }

    @media (width >= 700px) {
      :host {
        position: relative;
        height: calc(var(--ngm-header-height) - var(--header-padding-v) * 2);
        min-width: 260px;
        max-width: 496px;
      }
    }

    /* ga-search container */

    ga-search {
      flex: 2;
      height: 100%;
      max-width: calc(100% - 54px);
      z-index: 2;
    }

    :host(:not(.is-active)) ga-search {
      display: none;
    }

    @media (min-width: 700px) {
      ga-search, :host(:not(.is-active)) ga-search {
        display: flex;
        min-width: 260px;
        max-width: 496px;
        z-index: auto;
        margin-left: 100px;
      }
    }

    /* input */

    input {
      background: var(--color-bg--dark);
      color: var(--color-bg-contrast);
      outline: none;

      font-family: var(--font);
      font-size: 1rem;

      flex: 1;
      width: 100%;
      height: 100%;
      padding: var(--padding-v) calc(var(--padding-v) * 2 + var(--icon-size)) var(--padding-v) var(--padding-h);

      border: 2px solid transparent;
      border-radius: 4px;
    }

    input:hover {
      background-color: var(--color-bg);
    }

    input:focus {
      background-color: var(--color-highlight);
    }

    input:focus, input:hover {
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
      border-color: transparent;
      border-bottom-color: var(--color-highlight--dark);
    }

    input::placeholder {
      color: var(--color-bg-contrast);
    }

    input:focus::placeholder {
      color: var(--color-bg-contrast--lighter);
      opacity: 1;
    }

    input::-webkit-search-decoration,
    input::-webkit-search-cancel-button,
    input::-webkit-search-results-button,
    input::-webkit-search-results-decoration {
      display: none;
    }

    /* search results */

    ul {
      z-index: 2 !important;
      background-color: var(--color-bg);
      color: var(--color-bg-contrast--light);
      box-shadow: 0 3px 4px #00000029;
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 300px;
      overflow-y: auto;
      text-align: left;
      font-family: var(--font);
      font-size: 1rem;
      line-height: 1.5rem;
      letter-spacing: 0.16px;
    }

    ul > li {
      padding: 4px 8px 4px 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    ul > li[aria-selected=true],
    ul > li:hover {
      cursor: pointer;
      background-color: var(--color-highlight);
    }

    ul > li .highlight {
      background-color: #ffec99;
    }

    ul > li img {
      width: 20px;
      vertical-align: middle;
      color: #868E96;
    }

    ul > li i {
      font-size: 1rem;
      line-height: 1.5rem;
      font-style: italic;
      font-weight: 200;
      letter-spacing: 0.15px;
    }

    ul > li b {
      font-size: 1rem;
      line-height: 1.5rem;
    }

    /* icon */

    .icon {
      width: var(--icon-size);
      height: var(--icon-size);
      mask: var(--icon, none) no-repeat center;
      -webkit-mask: var(--icon, none) no-repeat center;

      background-color: var(--color-highlight--darker);
      position: absolute;
      right: var(--padding-h);
      top: 0;
      bottom: 0;
      margin: auto;
      cursor: pointer;
    }

    .icon.is-close {
      --icon: url('./images/i_close.svg');
      right: calc(var(--padding-h) + 54px)
    }

    .icon.is-search {
      --icon: url('./images/icon_search.svg');
    }

    :host(.is-active) .icon.is-search {
      color: var(--color-highlight);
    }

    ga-search:has(input:placeholder-shown) ~ .icon.is-close {
      display: none;
    }

    @media (min-width: 700px) {
      .icon.is-close {
        right: var(--padding-h);
      }

      ga-search:has(input:not(:placeholder-shown)) ~ .icon.is-search {
        display: none;
      }
    }
  `;
}

/**
 * Fully stops propagation of an event.
 * @param event
 */
const captureEvent = (event: Event) => {
  event.stopPropagation();
  event.stopImmediatePropagation();
  event.preventDefault();
};

/**
 * Overwrites the `target` property of an event,
 * causing it to always return the value that it had at the time this function was called.
 * This behaviour is mostly used to prevent [Event Retargeting](https://lit.dev/docs/components/events/#shadowdom-retargeting)
 * from obscuring an event's original target.
 *
 * Note that, normally, there are better ways to access the original target.
 * However, if you're not in full control of the eventual event receiver, this might do the job,
 * where other alternatives fail.
 *
 * @param event
 */
const freezeEventTarget = (event: Event): void => {
  const target = event.target;
  Object.defineProperty(event, 'target', {
    get: function () {
      return target;
    },
  });
};


type SearchItem =
  | Feature
  | AdditionalItem

interface FeatureWithLocation extends Feature {
  bbox: BBox
  properties: GeoJsonProperties & {
    origin: 'layer'
  }
}

/**
 * `AdditionalItem` represents custom objects
 * that are added to the default search results.
 */
type AdditionalItem =
  | LayerTreeNode
  | CoordinateItem
  | EntityItem

interface CoordinateItem {
  label: string
  bbox: BBox
  origin: 'coordinates'
}

interface EntityItem {
  label: string
  entity: CesiumEntity
  dataSourceName: string
}

interface SearchEvent extends SubmitEvent {
  detail: {
    result: SearchItem
  }
}


enum SearchItemCategory {
  Location,
  GeoAdminLayer,
  NgmLayer,
}


type CategorizedSearchItem =
  | {
  category: SearchItemCategory.Location
  item: FeatureWithLocation | CoordinateItem
}
  | {
  category: SearchItemCategory.GeoAdminLayer,
  item: Feature,
}
  | {
  category: SearchItemCategory.NgmLayer,
  item: EntityItem | LayerTreeNode
}


const isFeature = (item: SearchItem): item is Feature => (
  'type' in item && item.type === 'Feature'
);

const isFeatureWithLocation = (item: Feature): item is FeatureWithLocation => (
  item.bbox != null && (item.properties != null && item.properties.origin !== 'layer')
);

const isCoordinateItem = (item: SearchItem): item is CoordinateItem => (
  'origin' in item && item.origin === 'coordinates'
);

const isEntityItem = (item: SearchItem): item is EntityItem => (
  'entity' in item && item.entity instanceof CesiumEntity
);

/**
 * The format used for individual coordinate values.
 */
const coordinateFormat = new Intl.NumberFormat('de-CH', {
  maximumFractionDigits: 1,
});

const categorizeSearchItem = (item: SearchItem): CategorizedSearchItem => {
  if (isFeature(item)) {
    if (isFeatureWithLocation(item)) {
      return {category: SearchItemCategory.Location, item};
    }
    return {category: SearchItemCategory.GeoAdminLayer, item};
  }
  if (isCoordinateItem(item)) {
    return {category: SearchItemCategory.Location, item};
  }
  return {category: SearchItemCategory.NgmLayer, item};
};

const getIconForCategory = (category: SearchItemCategory): string => {
  switch (category) {
    case SearchItemCategory.Location:
      return 'i_place';
    case SearchItemCategory.GeoAdminLayer:
      return 'i_layer';
    case SearchItemCategory.NgmLayer:
      return 'i_extrusion';
  }
};
