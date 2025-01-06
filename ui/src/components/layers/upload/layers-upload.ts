import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../../../i18n';
import {html} from 'lit';
import i18next from 'i18next';
import './layers-upload-kml';
import {CustomDataSource, Viewer} from 'cesium';
import {parseKml, renderWithDelay} from '../../../cesiumutils';
import MainStore from '../../../store/main';
import {DEFAULT_LAYER_OPACITY, LayerConfig} from '../../../layertree';
import {LayerEventDetails} from '../layers-display';
import {Subscription} from 'rxjs';
import {KmlUploadEvent} from './layers-upload-kml';


@customElement('ngm-layers-upload')
export class NgmLayersUpload extends LitElementI18n {
  @property({type: Object})
  accessor toastPlaceholder!: HTMLElement

  @state()
  private accessor viewer: Viewer | null = null

  private readonly subscription = new Subscription();

  connectedCallback() {
    super.connectedCallback();
    this.subscription.add(MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
    }));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subscription.unsubscribe();
  }

  // TODO Cleanup/Refactor this function.
  // As of now, this function remains unchanged to before the navigation-catalog refactoring.
  private async handleKmlUpload(e: KmlUploadEvent): Promise<void> {
    if (this.viewer == null) {
      return;
    }

    const dataSource = new CustomDataSource();
    const name = await parseKml(this.viewer, e.detail.file, dataSource, e.detail.isClampingToGround);
    const layer = `${name.replace(' ', '_')}_${Date.now()}`;

    // name used as id for datasource
    dataSource.name = layer;
    MainStore.addUploadedKmlName(dataSource.name);
    await this.viewer.dataSources.add(dataSource);
    await renderWithDelay(this.viewer);

    // done like this to have correct rerender of component
    const dataSourcePromise = Promise.resolve(dataSource);
    const config: LayerConfig = {
      load() {
        return dataSourcePromise;
      },
      label: name,
      layer,
      promise: dataSourcePromise,
      opacity: DEFAULT_LAYER_OPACITY,
      notSaveToPermalink: true,
      ownKml: true,
      opacityDisabled: true,
    };
    this.emitLayerClick(config);
    await this.viewer.zoomTo(dataSource);
    this.requestUpdate();
  }

  private emitLayerClick(layer: LayerConfig): void {
    this.dispatchEvent(new CustomEvent<LayerEventDetails>('layer-click', {
      bubbles: true,
      composed: true,
      detail: {
        layer,
      },
    }));
  }

  private emitIonModalOpening(): void {
    this.dispatchEvent(new CustomEvent('openIonModal', {
      bubbles: true,
      composed: true,
    }));
  }

  readonly render = () => html`
    <ngm-layers-upload-kml
      .toastPlaceholder=${this.toastPlaceholder}
      @upload=${this.handleKmlUpload}>
    </ngm-layers-upload-kml>
    <button
      class="ui button ngm-ion-add-content-btn ngm-action-btn"
      @click=${this.emitIonModalOpening}
    >
      ${i18next.t('dtd_add_ion_token')}
    </button>
  `;
}
