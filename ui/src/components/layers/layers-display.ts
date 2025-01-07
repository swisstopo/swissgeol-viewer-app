import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n.js';
import {css, html} from 'lit';
import i18next from 'i18next';
import {CustomDataSource, Viewer} from 'cesium';
import {PropertyValues} from '@lit/reactive-element';
import LayersActions from '../../layers/LayersActions';
import {DEFAULT_LAYER_OPACITY, LayerConfig, LayerTreeNode} from '../../layertree';
import '../../layers/ngm-layers';
import '../../layers/ngm-layers-sort';
import MainStore from '../../store/main';
import {Subscription} from 'rxjs';
import {classMap} from 'lit/directives/class-map.js';
import {query} from 'lit/decorators.js';
import {parseKml, renderWithDelay} from '../../cesiumutils';

@customElement('ngm-layers-display')
export class NgmLayersDisplay extends LitElementI18n {
  @property({type: Array})
  accessor layers: LayerTreeNode[] = []

  @state()
  private accessor isReordering = false

  @state()
  private accessor viewer: Viewer | null = null

  @state()
  private accessor actions: LayersActions | null = null;

  private readonly subscription = new Subscription();

  @query('.ngm-side-bar-panel > .ngm-toast-placeholder')
  accessor toastPlaceholder;

  @state()
  private accessor globeQueueLength = 0

  constructor() {
    super();

    this.subscription.add(MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
      this.initializeViewer();
    }));

    this.handleLayerRemoval = this.handleLayerRemoval.bind(this);
    this.handleReordering = this.handleReordering.bind(this);
    this.toggleReordering = this.toggleReordering.bind(this);
    this.handleLayerUpdate = this.handleLayerUpdate.bind(this);
    this.handleKmlUpload = this.handleKmlUpload.bind(this);
  }

  private initializeViewer(): void {
    if (this.viewer == null) {
      return;
    }
    this.subscription.add(this.viewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength) => {
      this.globeQueueLength = queueLength;
    }));
  }

  readonly render = () => html`
    <div class="ngm-data-panel">
      <style>
        ${NgmLayersDisplay.styles.cssText}
      </style>
      <div class="ngm-panel-content">
        <div
          class="ngm-label-btn ${classMap({active: this.isReordering})}"
          @click=${this.toggleReordering}
        >
          ${this.isReordering ? i18next.t('dtd_finish_ordering_label') : i18next.t('dtd_change_order_label')}
        </div>
        ${this.isReordering
          ? this.renderSortableLayers()
          : this.renderLayers()}
        <h5 class="ui header">${i18next.t('dtd_user_content_label')}</h5>
        <ngm-layers-upload
          .toastPlaceholder=${this.toastPlaceholder}
          .onKmlUpload=${this.handleKmlUpload}>
        </ngm-layers-upload>
        <button
          class="ui button ngm-ion-add-content-btn ngm-action-btn"
          @click=${this.openIonModal}
        >
          ${i18next.t('dtd_add_ion_token')}
        </button>
        <h5 class="ui header ngm-background-label">
          ${i18next.t('dtd_background_map_label')}
          <div class="ui ${this.globeQueueLength > 0 ? 'active' : ''} inline mini loader">
            <span class="ngm-load-counter">${this.globeQueueLength}</span>
          </div>
        </h5>
        <ngm-map-configuration></ngm-map-configuration>
        <div class="ui divider"></div>
      </div>
    </div>
  `;

  private readonly renderLayers = () => html`
    <ngm-layers
      .layers=${this.layers}
      .actions=${this.actions}
      @removeDisplayedLayer=${this.handleLayerRemoval}
      @layerChanged=${this.handleLayerUpdate}>
    </ngm-layers>
  `;

  private readonly renderSortableLayers = () => html`
    <ngm-layers-sort
      .layers=${this.layers}
      .actions=${this.actions}
      @orderChanged=${this.handleReordering}>
    </ngm-layers-sort>
  `;

  updated(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has('viewer' as keyof NgmLayersDisplay)) {
      this.actions = this.viewer == null ? null : new LayersActions(this.viewer);
    }
  }

  disconnectedCallback(): void {
    this.subscription.unsubscribe();
  }

  private toggleReordering(): void {
    this.isReordering = !this.isReordering;
  }

  private async handleReordering(e: LayersReorderEvent): Promise<void> {
    const {actions} = this;
    if (actions == null) {
      return;
    }
    await actions.reorderLayers(e.detail);
    if (!this.isReordering) {
      this.updateLayers(e.detail);
    }
  }

  private async handleLayerRemoval(e: LayerRemovalEvent): Promise<void> {
    const newLayers = [...this.layers];
    newLayers.splice(e.detail.idx, 1);
    this.updateLayers(newLayers);
    this.removeLayer(e.detail.config);
  }

  private async handleLayerUpdate(e: LayerChangeEvent): Promise<void> {
    this.updateLayer(e.detail);
  }

  // TODO Cleanup/Refactor this function.
  // As of now, this function remains unchanged to before the navigation-catalog refactoring.
  private async handleKmlUpload(file: File, clampToGround: boolean): Promise<void> {
    if (this.viewer == null) {
      return;
    }

    const dataSource = new CustomDataSource();
    const name = await parseKml(this.viewer, file, dataSource, clampToGround);
    const layer = `${name.replace(' ', '_')}_${Date.now()}`;

    // name used as id for datasource
    dataSource.name = layer;
    MainStore.addUploadedKmlName(dataSource.name);
    await this.viewer.dataSources.add(dataSource);
    await renderWithDelay(this.viewer);

    // done like this to have correct rerender of component
    const dataSourcePromise = Promise.resolve(dataSource);
    const config: LayerConfig = {
      load() { return dataSourcePromise; },
      label: name,
      layer,
      promise: dataSourcePromise,
      opacity: DEFAULT_LAYER_OPACITY,
      notSaveToPermalink: true,
      ownKml: true,
      opacityDisabled: true
    };
    this.clickLayer(config);
    await this.viewer.zoomTo(dataSource);
    this.requestUpdate();
  }

  private updateLayers(layers: LayerTreeNode[]): void {
    this.dispatchEvent(new CustomEvent('layers-update', {
      detail: {
        layers,
      },
    }) satisfies LayersUpdateEvent);
  }

  private updateLayer(layer: LayerConfig): void {
    this.dispatchEvent(new CustomEvent('layer-update', {
      detail: {
        layer,
      },
    }) satisfies LayerEvent);
  }

  private removeLayer(layer: LayerConfig): void {
    this.dispatchEvent(new CustomEvent('layer-removal', {
      detail: {
        layer,
      },
    }) satisfies LayerEvent);
  }

  private clickLayer(layer: LayerConfig): void {
    this.dispatchEvent(new CustomEvent('layer-click', {
      bubbles: true,
      composed: true,
      detail: {
        layer,
      },
    }) satisfies LayerEvent);
  }

  private openIonModal(): void {
    this.dispatchEvent(new CustomEvent('openIonModal', {
      bubbles: true,
      composed: true,
    }));
  }

  // TODO Make all children of this component use the Shadow DOM so we can remove this.
  createRenderRoot() {
    return this;
  }

  static readonly styles = css`
    ngm-layers-display .actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 9px;
    }

    ngm-layers-display * {
      box-sizing: border-box;
    }
  `;
}

export type LayersUpdateEvent = CustomEvent<{
  layers: LayerTreeNode[]
}>

export type LayerEvent = CustomEvent<{
  layer: LayerConfig | LayerTreeNode
}>

type LayerRemovalEvent = CustomEvent<{
  idx: number
  config: LayerConfig
}>

type LayersReorderEvent = CustomEvent<LayerTreeNode[]>
type LayerChangeEvent = CustomEvent<LayerConfig>
