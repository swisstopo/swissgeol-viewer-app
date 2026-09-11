import { customElement, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import i18next from 'i18next';
import draggable from './draggable';
import { showSnackbarConfirmation } from '../notifications';
import { getAssetIds } from '../permalink';
import { applyTypography } from 'src/styles/theme';
import { InputChangeEvent } from 'src/features/core/core-text-input.element';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { consume } from '@lit/context';
import { clientConfigContext } from 'src/context';
import { ClientConfig } from 'src/api/client-config';
import { live } from 'lit/directives/live.js';
import { CoreElement } from 'src/features/core';
import {
  KmlLayer,
  Layer,
  LayerService,
  LayerSourceType,
  LayerType,
  Tiles3dLayer,
  GeoJsonLayer,
} from 'src/features/layer';
import { makeId } from 'src/models/id.model';
import { IonAsset, IonService } from 'src/services/ion.service';

const CESIUM_ION_DOCUMENTATION_URL =
  'https://cesium.com/learn/ion/cesium-ion-access-tokens/';

@customElement('ngm-ion-modal')
export class NgmIonModal extends CoreElement {
  @consume({ context: clientConfigContext })
  accessor clientConfig!: ClientConfig;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: IonService.context() })
  accessor ionService!: IonService;

  @state()
  accessor assets: IonAsset[] = [];

  @state()
  accessor assetsToDisplay: IonAsset[] = [];

  @state()
  accessor assetsToAdd: Set<IonAsset> = new Set<IonAsset>();

  @state()
  accessor errorMessage: string | undefined;

  @state()
  accessor preloader = false;
  @state()
  accessor confirmationToast: HTMLElement | undefined;

  accessor tokenInput: string | null = null;

  accessor token: string | null = null;

  connectedCallback() {
    super.connectedCallback();

    draggable(this, {
      allowFrom: '.drag-handle',
    });
    this.tokenInput = this.ionService.accessToken;
  }

  get unselectedAssets(): IonAsset[] {
    return this.assets.filter((asset) => !this.isLayerIdActivated(asset.id));
  }

  async onLoadAssets() {
    if (this.token === null) {
      return;
    }
    this.confirmationToast = undefined;
    this.errorMessage = undefined;
    this.assets = [];
    this.assetsToDisplay = [];
    this.preloader = true;
    const res = await this.ionService.fetchIonAssets({
      accessToken: this.token,
      status: 'COMPLETE',
      type: ['3DTILES', 'GEOJSON', 'KML'],
    });
    if (res.items) {
      this.assets = res.items;
      this.assetsToDisplay = this.assets;
    } else {
      this.errorMessage = res.message;
    }
    this.preloader = false;
  }

  loadAssets(token: string) {
    if (this.confirmationToast || this.preloader) {
      return;
    }
    const assets = getAssetIds();
    if (token !== this.token && assets.length) {
      this.confirmationToast = showSnackbarConfirmation(
        i18next.t('dtd_remove_assets_confirmation'),
        {
          onApprove: () => {
            this.token = token;
            this.onLoadAssets().then();
          },
          onDeny: () => (this.confirmationToast = undefined),
        },
      );
    } else {
      this.token = token;
      this.onLoadAssets().then();
    }
    this.ionService.accessToken = token;
  }

  toggleSingleAsset(ionAsset: IonAsset) {
    const newSet = new Set(this.assetsToAdd);
    if (newSet.has(ionAsset)) {
      newSet.delete(ionAsset);
    } else {
      newSet.add(ionAsset);
    }
    this.assetsToAdd = newSet;
  }

  toggleAllAssets() {
    if (this.assetsToAdd.size === this.unselectedAssets.length) {
      this.assetsToAdd = new Set<IonAsset>();
    } else {
      this.assetsToAdd = new Set<IonAsset>(this.unselectedAssets);
    }
  }

  addAsset(ionAsset: IonAsset) {
    if (!ionAsset?.id || this.preloader) return;
    let customLayer: Layer;
    switch (ionAsset.type) {
      case 'GEOJSON':
        customLayer = {
          type: LayerType.GeoJson,
          id: makeId(ionAsset.id),
          opacity: 1,
          source: {
            type: LayerSourceType.CesiumIon,
            assetId: ionAsset.id,
            accessToken: this.token ?? undefined,
          },
          canUpdateOpacity: true,
          shouldClampToGround: true,
          isVisible: true,
          label: ionAsset.name,
          geocatId: null,
          downloadUrl: null,
          infoBox: null,
          customProperties: {},
          orderOfProperties: [],
          terrain: null,
          layerStyle: null,
        } satisfies GeoJsonLayer;
        break;
      case 'KML':
        customLayer = {
          type: LayerType.Kml,
          id: makeId(ionAsset.id),
          opacity: 1,
          source: {
            type: LayerSourceType.CesiumIon,
            assetId: ionAsset.id,
            accessToken: this.token ?? undefined,
          },
          canUpdateOpacity: false,
          shouldClampToGround: true,
          isVisible: true,
          label: ionAsset.name,
          geocatId: null,
          downloadUrl: null,
          infoBox: null,
          customProperties: {},
        } satisfies KmlLayer;
        break;
      case '3DTILES':
        customLayer = {
          type: LayerType.Tiles3d,
          id: makeId(ionAsset.id),
          source: {
            type: LayerSourceType.CesiumIon,
            assetId: ionAsset.id,
            accessToken: this.token ?? undefined,
          },
          label: ionAsset.name,
          opacity: 1,
          canUpdateOpacity: true,
          isVisible: true,
          geocatId: null,
          downloadUrl: null,
          infoBox: null,
          orderOfProperties: [],
          isPartiallyTransparent: false,
          sliceSelection: null,
          customProperties: {},
        } satisfies Tiles3dLayer;
        break;
      default:
        throw new Error(`Unsupported asset type: ${ionAsset.type}`);
    }

    this.layerService.activateCustomLayer(customLayer);

    this.requestUpdate();
  }

  addAllSelectedAssets() {
    this.assetsToAdd.forEach((asset) => {
      this.addAsset(asset);
    });
    this.assetsToAdd.clear();
  }

  onClose() {
    if (this.confirmationToast) {
      this.confirmationToast.querySelector<HTMLElement>('.deny')?.click();
      this.confirmationToast = undefined;
    }
    this.dispatchEvent(new CustomEvent('close'));
  }

  isLayerIdActivated(id: number): boolean {
    return this.layerService.hasLayer(makeId<Layer>(id));
  }

  updateTokenInput(event: InputChangeEvent) {
    this.tokenInput = event.detail.value;
  }

  searchForIonAssets(event: InputChangeEvent) {
    this.assetsToDisplay = this.assets.filter((asset) =>
      asset.name.toLowerCase().includes(event.detail.value.toLowerCase()),
    );
  }

  openCesiumDocs() {
    window.open(CESIUM_ION_DOCUMENTATION_URL, '_blank', 'noopener,noreferrer');
  }

  render() {
    return html`
      <h2 class="header">
        ${i18next.t('catalog:add_content_from_cesium_ion')}
      </h2>
      <div
        class="content ${classMap({
          'has-table': this.assetsToDisplay.length !== 0,
        })}"
      >
        <div .hidden=${this.assets.length}>
          <ngm-core-info-panel
            .icon=${'info'}
            .text=${i18next.t('dtd_ion_token_info')}
          ></ngm-core-info-panel>
        </div>
        <div class="token-input">
          <ngm-core-text-input
            .value=${live(this.tokenInput ?? '')}
            .label=${i18next.t('dtd_ion_token_label')}
            @inputChange="${this.updateTokenInput}"
          ></ngm-core-text-input>
          <sgc-button
            @buttonClick=${() =>
              this.tokenInput && this.loadAssets(this.tokenInput)}
            >${i18next.t('dtd_load_ion_assets_btn')}</sgc-button
          >
        </div>
        <div .hidden=${!this.assets.length}>
          <hr />
        </div>
        <div .hidden=${!this.assets.length}>
          <div class="search-container">
            <sgc-button
              color="secondary"
              ?disabled=${this.assetsToAdd.size === 0}
              @buttonClick=${() => this.addAllSelectedAssets()}
            >
              <sgc-icon name="plus"></sgc-icon>
              ${i18next.t('dtd_add_ion_asset_btn')}
            </sgc-button>
            <ngm-core-text-input
              icon="search"
              .placeholder=${i18next.t('search_placeholder')}
              @inputChange="${this.searchForIonAssets}"
            ></ngm-core-text-input>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th class="table-column-checkbox">
                    <sgc-checkbox
                      .value="${this.assetsToAdd.size > 0}"
                      ?indeterminate="${
                        this.assetsToAdd.size > 0 &&
                        this.assetsToAdd.size < this.unselectedAssets.length
                      }"
                      @checkboxChange="${() => this.toggleAllAssets()}"
                    ></sgc-checkbox>
                  </th>
                  <th class="table-column-id">ID</th>
                  <th class="table-column-value">
                    ${i18next.t('tbx_name_label')}
                  </th>
                  <th class="table-column-action"></th>
                </tr>
              </thead>
              <tbody>
                ${repeat(
                  this.assetsToDisplay,
                  (row) => row.id,
                  (row) => html`
                    <tr
                      class="${classMap({
                        'is-active': this.assetsToAdd.has(row),
                        'is-disabled': this.isLayerIdActivated(row.id),
                      })}"
                    >
                      <td class="table-column-checkbox">
                        <sgc-checkbox
                          value="${
                            this.assetsToAdd.has(row) ||
                            this.isLayerIdActivated(row.id)
                          }"
                          ?disabled="${this.isLayerIdActivated(row.id)}"
                          @checkboxChange="${() => this.toggleSingleAsset(row)}"
                        ></sgc-checkbox>
                      </td>
                      <td class="table-column-id">${row.id}</td>
                      <td class="table-column-value">${row.name}</td>
                      <td class="table-column-action">
                        ${
                          this.isLayerIdActivated(row.id)
                            ? html`<sgc-icon name="checkmark"></sgc-icon>`
                            : // Replace button with sgc-button when new size has been added
                              html` <ngm-core-button
                                variant="secondary"
                                shape="small"
                                @click=${() => this.addAsset(row)}
                              >
                                <sgc-icon name="plus"></sgc-icon>
                                ${i18next.t('dtd_add_ion_asset_btn')}
                              </ngm-core-button>`
                        }
                      </td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="actions">
        <sgc-button
          color="tertiary"
          role="link"
          @buttonClick=${this.openCesiumDocs}
        >
          ${i18next.t('dtd_documentation')}
          <ngm-core-icon icon="documentation"></ngm-core-icon
        ></sgc-button>
        <sgc-button color="secondary" @buttonClick=${() => this.onClose()}
          >${i18next.t('app_close_btn_label')}</sgc-button
        >
      </div>
    `;
  }

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }

    :host,
    :host * {
      box-sizing: border-box;
    }

    .header {
      border-bottom: 1px solid var(--sgc-color-border--default);
    }

    .header,
    .content,
    .actions {
      padding: 24px;
    }

    hr {
      margin: 0;
      height: 1px;
      border-width: 0;
      color: var(--sgc-color-border--default);
      background-color: var(--sgc-color-border--default);
    }

    h2 {
      ${applyTypography('modal-title-1')}
      color: var(--sgc-color-text--emphasis-high);
      margin: 0;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 24px;
      margin-bottom: 84px;
    }

    .content.has-table {
      padding-bottom: 0;
    }

    .token-input {
      display: flex;
      gap: 12px;

      sgc-button {
        padding-top: 30px;
      }

      ngm-core-text-input {
        flex: 1;
      }
    }

    .search-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;

      ngm-core-text-input {
        width: 300px;
      }
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      position: absolute;
      bottom: 0;
      background-color: white;
      width: 100%;
      border-top: 1px solid var(--sgc-color-border--default);
    }

    .table-container {
      max-height: calc(80vh - calc(24px * 16));
      padding-bottom: 24px;
      overflow-y: scroll;
    }

    table {
      border-collapse: collapse;
    }

    tr:first-child th:first-child {
      border-top-left-radius: 4px;
    }

    tr:first-child th:last-child {
      border-top-right-radius: 4px;
    }

    table thead,
    tr.is-active {
      background-color: var(--sgc-color-border--default);
    }
    tr.is-disabled {
      background-color: var(--color-bg--grey);
    }

    tbody tr {
      border: 1px solid var(--sgc-color-border--emphasis-high);
    }

    table th,
    table td {
      text-align: left;
    }

    table thead {
      border-bottom: 2px solid var(--sgc-color-border--emphasis-high);
    }

    tr td,
    tr th {
      height: 44px;
      text-align: left;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .table-column-checkbox {
      width: 44px;

      sgc-checkbox {
        position: relative;
      }
    }

    .table-column-id {
      width: 150px;
    }

    .table-column-value {
      max-width: 557px;
      width: 557px;
    }

    .table-column-action {
      width: 137px;
      text-align: right;
    }

    .table-column-id,
    .table-column-value {
      padding: 0 16px;
    }

    .table-column-checkbox,
    .table-column-action {
      padding: 0 11px;
    }
  `;
}
