import { html } from 'lit';
import { LitElementI18n } from '../i18n.js';
import '../toolbox/ngm-toolbox';
import '../layers/ngm-layers';
import '../layers/ngm-layers-sort';
import './dashboard/ngm-dashboard';
import './sidebar/ngm-menu-item';
import '../components/core';
import '../components/navigation/navigation-layer-panel';
import LayersActions from '../layers/LayersActions';
import { DEFAULT_LAYER_OPACITY, LayerType } from '../constants';
import defaultLayerTree, { LayerConfig } from '../layertree';
import {
  addAssetId,
  getAssetIds,
  getAttribute,
  getCesiumToolbarParam,
  getLayerParams,
  getSliceParam,
  getZoomToPosition,
  setCesiumToolbarParam,
  syncLayersParam,
} from '../permalink';
import { createCesiumObject } from '../layers/helpers';
import i18next from 'i18next';
import 'fomantic-ui-css/components/accordion.js';
import './ngm-map-configuration';
import type { Cartesian2, Viewer } from 'cesium';
import {
  BoundingSphere,
  Cartesian3,
  CustomDataSource,
  GeoJsonDataSource,
  HeadingPitchRange,
  Math as CMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium';
import { showSnackbarError, showSnackbarInfo } from '../notifications';
import auth from '../store/auth';
import './ngm-share-link';
import '../layers/ngm-layers-upload';
import MainStore from '../store/main';
import { classMap } from 'lit/directives/class-map.js';
import $ from 'jquery';
import { customElement, property, query, state } from 'lit/decorators.js';
import type QueryManager from '../query/QueryManager';

import DashboardStore from '../store/dashboard';
import { getAssets } from '../api-ion';
import {
  LayerEvent,
  LayersUpdateEvent,
} from '../components/layer/layer-display';

export type SearchLayer = SearchLayerWithLayer | SearchLayerWithSource;

interface BaseSearchLayer {
  label: string;
  title?: string;
}

export interface SearchLayerWithLayer extends BaseSearchLayer {
  layer: string;
}

export interface SearchLayerWithSource extends BaseSearchLayer {
  type?: LayerType;
  dataSourceName: string;
}

interface LayerClickEvent {
  detail: {
    layer: string;
  };
}

@customElement('ngm-side-bar')
export class SideBar extends LitElementI18n {
  @property({ type: Object })
  accessor queryManager: QueryManager | null = null;
  @property({ type: Boolean })
  accessor mobileView = false;
  @property({ type: Boolean })
  accessor displayUndergroundHint = true;
  @state()
  accessor catalogLayers: LayerConfig[] | undefined;
  @state()
  accessor activeLayers: LayerConfig[] = [];

  // TODO change this back to `null`
  @state()
  accessor activePanel: string | null = 'data';
  @state()
  accessor showHeader = false;
  @state()
  accessor mobileShowAll = false;
  @state()
  accessor hideDataDisplayed = false;
  @state()
  accessor debugToolsActive = getCesiumToolbarParam();
  @query('.ngm-side-bar-panel > .ngm-toast-placeholder')
  accessor toastPlaceholder;
  private layerActions: LayersActions | undefined;
  private zoomedToPosition = false;
  private accordionInited = false;
  private shareListenerAdded = false;
  private readonly shareDownListener = (evt) => {
    if (!evt.composedPath().includes(this)) this.activePanel = null;
  };
  private viewer: Viewer | null = null;

  constructor() {
    super();

    this.handleDisplayLayersUpdate = this.handleDisplayLayersUpdate.bind(this);
    this.handleDisplayLayerUpdate = this.handleDisplayLayerUpdate.bind(this);
    this.handleDisplayLayerRemoval = this.handleDisplayLayerRemoval.bind(this);

    MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
    });

    auth.user.subscribe((user) => {
      if (!user && this.activeLayers) {
        // user logged out, remove restricted layers.
        const restricted = this.activeLayers.filter(
          (config) => config.restricted?.length,
        );
        restricted.forEach((config) => {
          const idx = this.activeLayers.indexOf(config);
          this.activeLayers.splice(idx, 1);
          this.removeLayer(config);
        });
      }
    });
    MainStore.setUrlLayersSubject.subscribe(async () => {
      if (this.activeLayers) {
        this.activeLayers.forEach((layer) =>
          this.removeLayerWithoutSync(layer),
        );
      }
      await this.syncActiveLayers();
      this.requestUpdate();
      MainStore.nextLayersRemove();
    });

    MainStore.syncLayerParams.subscribe(() => {
      syncLayersParam(this.activeLayers);
    });

    MainStore.onIonAssetAdd.subscribe((asset) => {
      const assetIds = getAssetIds();
      if (!asset.id || assetIds.includes(asset.id.toString())) {
        showSnackbarInfo(i18next.t('dtd_asset_exists_info'));
        return;
      }
      const token = MainStore.ionToken.value;
      if (!token) return;
      const layer: LayerConfig = {
        type: LayerType.tiles3d,
        assetId: asset.id,
        ionToken: token,
        label: asset.name,
        layer: asset.id.toString(),
        visible: true,
        displayed: true,
        opacityDisabled: true,
        pickable: true,
        customAsset: true,
      };
      layer.load = () => this.addLayer(layer);
      this.activeLayers.push(layer);

      addAssetId(asset.id);
      this.activeLayers = [...this.activeLayers];
      syncLayersParam(this.activeLayers);
    });

    MainStore.onRemoveIonAssets.subscribe(async () => {
      const assets = this.activeLayers.filter((l) => !!l.assetId);
      for (const asset of assets) {
        await this.removeLayerWithoutSync(asset);
      }
      this.viewer!.scene.requestRender();
      this.requestUpdate();
      syncLayersParam(this.activeLayers);
    });

    const sliceOptions = getSliceParam();
    if (sliceOptions?.type && sliceOptions.slicePoints)
      this.activePanel = 'tools';
  }

  private readonly renderMenuItem = (
    icon: string,
    title: string,
    panel: string,
  ) => html`
    <ngm-menu-item
      .icon=${icon}
      .title=${title}
      ?isActive=${this.activePanel === panel}
      ?isMobile=${this.mobileView}
      @click=${() => this.togglePanel(panel)}
    ></ngm-menu-item>
  `;

  render() {
    if (!this.queryManager) {
      return '';
    }

    this.queryManager.activeLayers = this.activeLayers.filter(
      (config) => config.visible && !config.noQuery,
    );

    const layerBtn = this.renderMenuItem('layer', 'menu_layers', 'data');
    const toolsBtn = this.renderMenuItem('tools', 'menu_tools', 'tools');
    const projectsBtn = this.renderMenuItem(
      'projects',
      'menu_projects',
      'dashboard',
    );
    const shareBtn = this.renderMenuItem('share', 'menu_share', 'share');
    const settingsBtn = this.renderMenuItem(
      'config',
      'menu_settings',
      'settings',
    );
    const mobileExpandBtn = html` <ngm-menu-item
      icon="${this.mobileShowAll ? 'viewLess' : 'viewAll'}"
      @click=${() => (this.mobileShowAll = !this.mobileShowAll)}
    ></ngm-menu-item>`;

    return html`
      <div
        .hidden=${!this.mobileView || !this.mobileShowAll}
        class="ngm-menu-mobile"
      >
        ${shareBtn} ${settingsBtn}
        <!-- required for correct positioning -->
        <div></div>
        <div></div>
      </div>
      <div class="ngm-menu">
        <div class="ngm-menu-top">
          ${layerBtn} ${toolsBtn} ${!this.mobileView ? shareBtn : ''}
          ${projectsBtn} ${this.mobileView ? mobileExpandBtn : ''}
        </div>
        <div ?hidden="${this.mobileView}" class="ngm-menu-top">
          ${settingsBtn}
        </div>
      </div>
      <ngm-dashboard
        class="ngm-side-bar-panel ngm-large-panel"
        ?hidden=${this.activePanel !== 'dashboard'}
        @close=${() => (this.activePanel = null)}
        @layerclick=${(e: LayerClickEvent) =>
          this.onCatalogLayerClicked(e.detail.layer)}
      ></ngm-dashboard>
      <ngm-navigation-layer-panel
        ?hidden="${this.activePanel !== 'data'}"
        .layers="${this.catalogLayers}"
        .displayLayers="${this.activeLayers}"
        @close="${() => (this.activePanel = null)}"
        @layer-click=${(e: LayerClickEvent) =>
          this.onCatalogLayerClicked(e.detail.layer)}
        @display-layers-update="${this.handleDisplayLayersUpdate}"
        @display-layer-update="${this.handleDisplayLayerUpdate}"
        @display-layer-removal="${this.handleDisplayLayerRemoval}"
      ></ngm-navigation-layer-panel>
      <div .hidden=${this.activePanel !== 'tools'} class="ngm-side-bar-panel">
        <ngm-tools
          .toolsHidden=${this.activePanel !== 'tools'}
          @open=${() => (this.activePanel = 'tools')}
          @close=${() => (this.activePanel = null)}
        ></ngm-tools>
      </div>
      <div
        .hidden=${this.activePanel !== 'share'}
        class="ngm-side-bar-panel ngm-share-panel"
      >
        <div class="ngm-panel-header">
          ${i18next.t('lsb_share')}
          <div
            class="ngm-close-icon"
            @click=${() => (this.activePanel = null)}
          ></div>
        </div>
        ${this.activePanel !== 'share'
          ? ''
          : html` <ngm-share-link></ngm-share-link>`}
      </div>
      <div
        .hidden=${this.activePanel !== 'settings'}
        class="ngm-side-bar-panel"
      >
        <div class="ngm-panel-header">
          ${i18next.t('lsb_settings')}
          <div
            class="ngm-close-icon"
            @click=${() => (this.activePanel = null)}
          ></div>
        </div>
        <div class="toolbar-settings">
          <div class="inner-toolbar-settings">
            <label>${i18next.t('lsb_debug_tools')}</label>
            <div
              class="ngm-checkbox ngm-debug-tools-toggle ${classMap({
                active: this.debugToolsActive,
              })}"
              @click=${() =>
                (<HTMLInputElement>(
                  this.querySelector('.ngm-debug-tools-toggle > input')
                )).click()}
            >
              <input
                type="checkbox"
                ?checked=${this.debugToolsActive}
                @change="${this.toggleDebugTools}"
              />
              <span class="ngm-checkbox-icon"></span>
              <label>${i18next.t('lsb_cesium_toolbar_label')}</label>
            </div>
            <a
              class="contact-mailto-link"
              target="_blank"
              href="mailto:swissgeol@swisstopo.ch"
              >${i18next.t('contact_mailto_text')}</a
            >
            <a
              class="disclaimer-link"
              target="_blank"
              href="${i18next.t('disclaimer_href')}"
              >${i18next.t('disclaimer_text')}</a
            >
          </div>
        </div>
      </div>
    `;
  }

  togglePanel(panelName, showHeader = true) {
    if (DashboardStore.projectMode.value === 'edit') {
      DashboardStore.showSaveOrCancelWarning(true);
      return;
    }
    this.showHeader = showHeader;
    if (this.activePanel === panelName) {
      this.activePanel = null;
      return;
    }
    this.activePanel = panelName;
  }

  async syncActiveLayers() {
    const attributeParams = getAttribute();
    const callback = attributeParams
      ? this.getTileLoadCallback(
          attributeParams.attributeKey,
          attributeParams.attributeValue,
        )
      : undefined;
    const flatLayers = this.getFlatLayers(this.catalogLayers, callback);
    const urlLayers = getLayerParams();
    const assetIds = getAssetIds();
    const ionToken = MainStore.ionToken.value;

    if (!urlLayers.length && !assetIds.length) {
      this.activeLayers = flatLayers.filter((l) => l.displayed);
      syncLayersParam(this.activeLayers);
      return;
    }

    // First - make everything hidden
    flatLayers.forEach((l) => {
      l.visible = false;
      l.displayed = false;
    });

    const activeLayers: LayerConfig[] = [];
    for (const urlLayer of urlLayers) {
      let layer = flatLayers.find((fl) => fl.layer === urlLayer.layer);
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = this.createSearchLayer({
          layer: urlLayer.layer,
          label: urlLayer.layer,
        }); // the proper label will be taken from getCapabilities
      } else {
        await (layer.promise || this.addLayer(layer));
        layer.add && layer.add();
      }
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.wmtsCurrentTime = urlLayer.timestamp ?? layer.wmtsCurrentTime;
      layer.setOpacity && layer.setOpacity(layer.opacity);
      layer.displayed = true;
      layer.setVisibility && layer.setVisibility(layer.visible);
      activeLayers.push(layer);
    }

    if (ionToken) {
      const ionAssetsRes = await getAssets(ionToken);
      const ionAssets = ionAssetsRes?.items || [];

      assetIds.forEach((assetId) => {
        const ionAsset = ionAssets.find(
          (asset) => asset.id === Number(assetId),
        );
        const layer: LayerConfig = {
          type: LayerType.tiles3d,
          assetId: Number(assetId),
          ionToken: ionToken,
          label: ionAsset?.name ?? assetId,
          layer: assetId,
          visible: true,
          displayed: true,
          opacityDisabled: true,
          pickable: true,
          customAsset: true,
        };
        layer.load = () => this.addLayer(layer);
        activeLayers.push(layer);
      });
    }

    this.activeLayers = activeLayers;
    syncLayersParam(this.activeLayers);
  }

  getTileLoadCallback(attributeKey, attributeValue) {
    return (tile, removeTileLoadListener) => {
      const content = tile.content;
      const featuresLength = content.featuresLength;
      for (let i = 0; i < featuresLength; i++) {
        const feature = content.getFeature(i);
        if (feature.getProperty(attributeKey) === attributeValue) {
          removeTileLoadListener();
          this.queryManager!.selectTile(feature);
          return;
        }
      }
    };
  }

  async update(changedProperties) {
    if (this.viewer && !this.layerActions) {
      this.layerActions = new LayersActions(this.viewer);
      if (!this.catalogLayers) {
        this.catalogLayers = [...defaultLayerTree];
        await this.syncActiveLayers();
      }
    }
    // hide share panel on any action outside side bar
    if (!this.shareListenerAdded && this.activePanel === 'share') {
      document.addEventListener('pointerdown', this.shareDownListener);
      document.addEventListener('keydown', this.shareDownListener);
      this.shareListenerAdded = true;
    } else if (this.shareListenerAdded) {
      this.shareListenerAdded = false;
      document.removeEventListener('pointerdown', this.shareDownListener);
      document.removeEventListener('keydown', this.shareDownListener);
    }
    super.update(changedProperties);
  }

  updated(changedProperties) {
    if (this.queryManager) {
      !this.zoomedToPosition && this.zoomToPermalinkObject();

      if (!this.accordionInited && this.activePanel === 'data') {
        const panelElement = this.querySelector('.ngm-layer-catalog');

        if (panelElement) {
          for (let i = 0; i < panelElement.childElementCount; i++) {
            const element = panelElement.children.item(i);
            if (element?.classList.contains('accordion')) {
              $(element).accordion({ duration: 150 });
            }
          }
          this.accordionInited = true;
        }
      }
      if (changedProperties.has('activeLayers')) {
        this.layerActions!.reorderLayers(this.activeLayers);
      }
    }

    super.updated(changedProperties);
  }

  async onCatalogLayerClicked(layer) {
    // toggle whether the layer is displayed or not (=listed in the side bar)
    if (layer.displayed) {
      if (layer.visible) {
        layer.displayed = false;
        layer.visible = false;
        layer.remove && layer.remove();
        const idx = this.activeLayers.findIndex((l) => l.label === layer.label);
        this.activeLayers.splice(idx, 1);
      } else {
        layer.visible = true;
      }
    } else {
      await (layer.promise || this.addLayer(layer));
      layer.add && layer.add();
      layer.visible = true;
      layer.displayed = true;
      this.activeLayers.push(layer);
      this.maybeShowVisibilityHint(layer);
    }
    layer.setVisibility && layer.setVisibility(layer.visible);

    syncLayersParam(this.activeLayers);
    const catalogLayers = this.catalogLayers ? this.catalogLayers : [];
    this.catalogLayers = [...catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.viewer!.scene.requestRender();
  }

  maybeShowVisibilityHint(config: LayerConfig) {
    if (
      this.displayUndergroundHint &&
      config.visible &&
      [LayerType.tiles3d, LayerType.earthquakes].includes(config.type!) &&
      !this.viewer?.scene.cameraUnderground
    ) {
      showSnackbarInfo(i18next.t('lyr_subsurface_hint'), {
        displayTime: 20000,
      });
      this.displayUndergroundHint = false;
    }
  }

  async removeLayer(config: LayerConfig) {
    await this.removeLayerWithoutSync(config);
    this.viewer!.scene.requestRender();
    syncLayersParam(this.activeLayers);
    const catalogLayers = this.catalogLayers ? this.catalogLayers : [];
    this.catalogLayers = [...catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.requestUpdate();
  }

  getFlatLayers(tree, tileLoadCallback): any[] {
    const flat: any[] = [];
    for (const layer of tree) {
      if (layer.children) {
        flat.push(...this.getFlatLayers(layer.children, tileLoadCallback));
      } else {
        layer.load = () => this.addLayer(layer);
        flat.push(layer);
      }
    }
    return flat;
  }

  // adds layer from search to 'Displayed Layers'
  async addLayerFromSearch(searchLayer: SearchLayer) {
    let layer;
    if ('dataSourceName' in searchLayer) {
      layer = this.activeLayers.find(
        (l) => l.type === searchLayer.dataSourceName,
      ); // check for layers like earthquakes
    } else {
      layer = this.activeLayers.find((l) => l.layer === searchLayer.layer); // check for swisstopoWMTS layers
    }

    if (layer) {
      // for layers added before
      if (layer.type === LayerType.swisstopoWMTS) {
        const index = this.activeLayers.indexOf(layer);
        this.activeLayers.splice(index, 1);
        layer.remove();
        layer.add(0);
        this.activeLayers.push(layer);
      }
      layer.setVisibility(true);
      layer.visible = true;
      layer.displayed = true;
      this.viewer!.scene.requestRender();
    } else {
      // for new layers
      this.activeLayers.push(this.createSearchLayer(searchLayer));
    }
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    this.requestUpdate();
  }

  createSearchLayer(searchLayer: SearchLayer) {
    let config: LayerConfig;
    if ('dataSourceName' in searchLayer) {
      config = searchLayer;
      config.visible = true;
      config.origin = 'layer';
      config.label = searchLayer.title ?? searchLayer.label;
      config.legend =
        config.type === LayerType.swisstopoWMTS ? config.layer : undefined;
    } else {
      config = {
        type: LayerType.swisstopoWMTS,
        label: searchLayer.title ?? searchLayer.label,
        layer: searchLayer.layer,
        visible: true,
        displayed: true,
        opacity: DEFAULT_LAYER_OPACITY,
        queryType: 'geoadmin',
        legend: searchLayer.layer,
      };
    }
    config.load = async () => {
      const layer = await this.addLayer(config);
      this.activeLayers = [...this.activeLayers];
      syncLayersParam(this.activeLayers);
      return layer;
    };

    return config;
  }

  zoomToPermalinkObject() {
    this.zoomedToPosition = true;
    const zoomToPosition = getZoomToPosition();
    if (zoomToPosition) {
      let altitude = 0,
        cartesianPosition: Cartesian3 | undefined,
        windowPosition: Cartesian2 | undefined;
      const updateValues = () => {
        altitude =
          this.viewer!.scene.globe.getHeight(
            this.viewer!.scene.camera.positionCartographic,
          ) ?? 0;
        cartesianPosition = Cartesian3.fromDegrees(
          zoomToPosition.longitude,
          zoomToPosition.latitude,
          zoomToPosition.height + altitude,
        );
        windowPosition =
          this.viewer!.scene.cartesianToCanvasCoordinates(cartesianPosition);
      };
      updateValues();
      const completeCallback = () => {
        if (windowPosition) {
          let maxTries = 25;
          let triesCounter = 0;
          const eventHandler = new ScreenSpaceEventHandler(this.viewer!.canvas);
          eventHandler.setInputAction(
            () => (maxTries = 0),
            ScreenSpaceEventType.LEFT_DOWN,
          );
          // Waits while will be possible to select an object
          const tryToSelect = () =>
            setTimeout(() => {
              updateValues();
              this.zoomToObjectCoordinates(cartesianPosition);
              windowPosition && this.queryManager!.pickObject(windowPosition);
              triesCounter += 1;
              if (
                !this.queryManager!.objectSelector.selectedObj &&
                triesCounter <= maxTries
              ) {
                tryToSelect();
              } else {
                eventHandler.destroy();
                if (triesCounter > maxTries) {
                  showSnackbarError(
                    i18next.t('dtd_object_on_coordinates_not_found_warning'),
                  );
                }
              }
            }, 500);
          tryToSelect();
        }
      };
      this.zoomToObjectCoordinates(cartesianPosition, completeCallback);
    }
  }

  zoomToObjectCoordinates(center, complete?) {
    const boundingSphere = new BoundingSphere(center, 1000);
    const zoomHeadingPitchRange = new HeadingPitchRange(
      0,
      -CMath.toRadians(45),
      boundingSphere.radius,
    );
    this.viewer!.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
      complete: complete,
    });
  }

  addLayer(layer: LayerConfig) {
    layer.promise = createCesiumObject(this.viewer!, layer);
    this.dispatchEvent(
      new CustomEvent('layeradded', {
        detail: {
          layer,
        },
      }),
    );
    return layer.promise;
  }

  private handleDisplayLayersUpdate(e: LayersUpdateEvent): void {
    this.activeLayers = e.detail.layers;
  }

  private handleDisplayLayerUpdate(e: LayerEvent): void {
    this.queryManager!.hideObjectInformation();
    const catalogLayers = this.catalogLayers ? this.catalogLayers : [];
    this.catalogLayers = [...catalogLayers];
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    if (e.detail) {
      this.maybeShowVisibilityHint(e.detail.layer);
    }
    this.requestUpdate();
  }

  private async handleDisplayLayerRemoval(e: LayerEvent): Promise<void> {
    await this.removeLayer(e.detail.layer);
  }

  private async removeLayerWithoutSync(layer: LayerConfig): Promise<void> {
    if (layer.setVisibility) {
      layer.setVisibility(false);
    } else {
      const c = await layer.promise;
      if (c instanceof CustomDataSource || c instanceof GeoJsonDataSource) {
        this.viewer!.dataSources.getByName(c.name)[0].show = false;
      }
    }
    layer.visible = false;
    layer.displayed = false;
    if (layer.remove) {
      layer.remove();
    }
  }

  toggleDebugTools(event) {
    const active = event.target.checked;
    this.debugToolsActive = active;
    setCesiumToolbarParam(active);
    this.dispatchEvent(
      new CustomEvent('toggleDebugTools', { detail: { active } }),
    );
  }

  createRenderRoot() {
    return this;
  }
}
