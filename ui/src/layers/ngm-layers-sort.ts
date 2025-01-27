import { html, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LitElementI18n } from '../i18n.js';
import './ngm-layers-item';
import { MultiDrag, Sortable } from 'sortablejs';
import DashboardStore from '../store/dashboard';
import { LayerConfig } from '../layertree';
import { NgmLayersItem } from './ngm-layers-item';

Sortable.mount(new MultiDrag());

@customElement('ngm-layers-sort')
export default class NgmLayersSort extends LitElementI18n {
  @property({ type: Array })
  accessor layers: LayerConfig[] = [];
  @property({ type: Object })
  accessor actions: any;
  private sortable: Sortable;
  private sortedList: LayerConfig[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.sortable = new Sortable(this, {
      handle: '.selected',
      sort: true,
      animation: 100,
      forceFallback: true,
      multiDrag: true,
      selectedClass: 'selected',
      fallbackTolerance: 3,
      onEnd: (evt) => {
        const layerCodes = evt.items.map(
          (it: NgmLayersItem) => it.config.layer,
        );
        const reverse = this.sortedList.reverse();
        const movedLayers = reverse.filter((l) => layerCodes.includes(l.layer));
        const newLayers = reverse.filter((l) => !layerCodes.includes(l.layer));
        newLayers.splice(evt.newIndicies[0].index, 0, ...movedLayers);
        this.sortedList = newLayers.reverse();
        this.dispatchEvent(
          new CustomEvent('orderChanged', { detail: this.sortedList }),
        );
      },
    });
    // for some reason avoidImplicitDeselect doesn't work, hack instead
    const deselectMultiDrag = this.sortable.multiDrag._deselectMultiDrag;
    document.removeEventListener('pointerup', deselectMultiDrag, false);
    document.removeEventListener('mouseup', deselectMultiDrag, false);
    document.removeEventListener('touchend', deselectMultiDrag, false);
  }

  disconnectedCallback() {
    this.dispatchEvent(
      new CustomEvent('orderChanged', { detail: this.sortedList }),
    );
    if (this.sortable) {
      this.sortable.destroy();
    }
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('layers')) {
      // Don't show KML assets in project view mode
      const hasKmlAssets = this.layers.some((layer) => layer.topicKml);
      if (hasKmlAssets && DashboardStore.projectMode.value) {
        this.layers = this.layers.filter((layer) => !layer.topicKml);
      }
      this.sortedList = [...this.layers];
    }
  }

  createLayerTemplate(config: LayerConfig) {
    if (!config.promise && config.load) {
      config.promise = config.load();
    }

    return html`
      <ngm-layers-item
        .config=${config}
        .changeOrderActive=${true}
        .actions=${this.actions}
      >
      </ngm-layers-item>
    `;
  }

  render() {
    const reverse = [...this.layers].reverse();
    return html`
      ${repeat(
        reverse,
        (c) => c.layer,
        (c) => this.createLayerTemplate(c),
      )}
    `;
  }

  createRenderRoot() {
    return this;
  }
}
