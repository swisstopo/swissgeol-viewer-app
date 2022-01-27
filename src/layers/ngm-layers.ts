import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import {LitElementI18n} from '../i18n.js';
import type {Config, LayerTreeItem as NgmLayersItem} from './ngm-layers-item';
// eslint-disable-next-line no-duplicate-imports
import './ngm-layers-item';
import {MultiDrag, Sortable} from 'sortablejs';

Sortable.mount(new MultiDrag());


@customElement('ngm-layers')
export default class LayerTree extends LitElementI18n {
  @property({type: Array}) layers: Config[] = [];
  @property({type: Object}) actions: any;
  @property({type: Boolean}) changeOrderActive = false;
  private sortable: Sortable;

  connectedCallback() {
    super.connectedCallback();
    this.sortable = new Sortable(this, {
      disabled: !this.changeOrderActive,
      handle: '.selected',
      sort: true,
      animation: 100,
      forceFallback: true,
      multiDrag: true,
      selectedClass: 'selected',
      fallbackTolerance: 3,
      onEnd: () => {
        // it is painful to correctly map the ordering
        // instead we read it from the DOM itself ;)
        const layerItems = this.querySelectorAll('ngm-layers-item') as NodeListOf<NgmLayersItem>;
        const layers = Array.from(layerItems).map(l => l.config).reverse();
        this.actions.reorderLayers(this.layers, layers);
        this.dispatchEvent(new CustomEvent('layerChanged'));
      }
    });
    // for some reason avoidImplicitDeselect doesn't work, hack instead
    const deselectMultiDrag = this.sortable.multiDrag._deselectMultiDrag;
    document.removeEventListener('pointerup', deselectMultiDrag, false);
    document.removeEventListener('mouseup', deselectMultiDrag, false);
    document.removeEventListener('touchend', deselectMultiDrag, false);
  }

  disconnectedCallback() {
    if (this.sortable) {
      this.sortable.destroy();
    }
    super.disconnectedCallback();
  }

  createLayerTemplate(config: Config, idx: number, len: number) {
    idx = len - 1 - idx; // we want to create in reverse order
    if (!config.promise) {
      config.promise = config.load();
    }

    const detail = {
      config,
      idx
    };

    return html`
      <ngm-layers-item
        .actions=${this.actions}
        .config=${config}
        .changeOrderActive=${this.changeOrderActive}
        @removeDisplayedLayer=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}))}
        @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
        @layerChanged=${() => this.dispatchEvent(new CustomEvent('layerChanged', {detail: config}))}
      >
      </ngm-layers-item>
    `;
  }

  // builds ui structure of layertree and makes render
  render() {
    this.sortable.option('disabled', !this.changeOrderActive);
    const len = this.layers ? this.layers.length : 0;
    const reverse = [...this.layers].reverse();
    return html`
      ${repeat(
        reverse,
        (config) => config.label,
        (config, idx) => this.createLayerTemplate(config, idx, len)
      )}
    `;
  }

  createRenderRoot() {
    return this;
  }
}
