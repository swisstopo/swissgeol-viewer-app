import {html} from 'lit';
import {LitElementI18n} from '../i18n.js';
import '../toolbox/ngm-toolbox';
import '../layers/ngm-layers';
import '../layers/ngm-layers-sort';
import '../layers/ngm-catalog';
import './dashboard/ngm-dashboard';
import LayersActions from '../layers/LayersActions';
import {DEFAULT_LAYER_OPACITY, LayerType, SUPPORTED_LANGUAGES} from '../constants';
import defaultLayerTree, {LayerConfig} from '../layertree';
import {
  addAssetId,
  getAssetIds,
  getAttribute, getCesiumToolbarParam,
  getLayerParams,
  getSliceParam,
  getZoomToPosition, LayerFromParam, setCesiumToolbarParam,
  syncLayersParam
} from '../permalink';
import {createCesiumObject} from '../layers/helpers';
import i18next from 'i18next';
import 'fomantic-ui-css/components/accordion.js';
import './ngm-map-configuration';
import {
  Cartesian3,
  HeadingPitchRange,
  BoundingSphere,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Math as CMath,
  CustomDataSource,
  GeoJsonDataSource,
} from 'cesium';
import {showSnackbarError, showSnackbarInfo} from '../notifications';
import auth from '../store/auth';
import './ngm-share-link';
import '../layers/ngm-layers-upload';
import MainStore from '../store/main';
import {classMap} from 'lit/directives/class-map.js';
import {zoomTo} from '../utils';
import $ from '../jquery';
import {customElement, property, query, state} from 'lit/decorators.js';
import type {Cartesian2, Viewer} from 'cesium';
import type QueryManager from '../query/QueryManager';
import NavToolsStore from '../store/navTools';
import {getLayerLabel} from '../swisstopoImagery';

import DashboardStore from '../store/dashboard';
import {getAssets} from '../api-ion';
import {parseKml} from '../cesiumutils';

type SearchLayer = {
  label: string
  layer: string
  type?: LayerType
  title?: string
}

@customElement('ngm-side-bar')
export class SideBar extends LitElementI18n {
  @property({type: Object})
  accessor queryManager: QueryManager | null = null;
  @property({type: Boolean})
  accessor mobileView = false;
  @property({type: Boolean})
  accessor displayUndergroundHint = true;
  @state()
  accessor catalogLayers: LayerConfig[] | undefined;
  @state()
  accessor activeLayers: LayerConfig[] = [];
  @state()
  accessor activePanel: string | null = null;
  @state()
  accessor showHeader = false;
  @state()
  accessor globeQueueLength_ = 0;
  @state()
  accessor mobileShowAll = false;
  @state()
  accessor hideDataDisplayed = false;
  @state()
  accessor layerOrderChangeActive = false;
  @state()
  accessor debugToolsActive = getCesiumToolbarParam();
  @query('.ngm-side-bar-panel > .ngm-toast-placeholder')
  accessor toastPlaceholder;
  @query('ngm-catalog')
  accessor catalogElement;
  private viewer: Viewer | null = null;
  private layerActions: LayersActions | undefined;
  private zoomedToPosition = false;
  private accordionInited = false;
  private shareListenerAdded = false;
  private shareDownListener = evt => {
    if (!evt.composedPath().includes(this)) this.activePanel = null;
  };

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);

    auth.user.subscribe((user) => {
      if (!user && this.activeLayers) {
        // user logged out, remove restricted layers.
        const restricted = this.activeLayers.filter(config => config.restricted);
        restricted.forEach(config => {
          const idx = this.activeLayers.indexOf(config);
          this.activeLayers.splice(idx, 1);
          this.removeLayer(config);
        });
      }
    });
    MainStore.setUrlLayersSubject.subscribe(async () => {
      if (this.activeLayers) {
        this.activeLayers.forEach(layer => this.removeLayerWithoutSync(layer));
      }
      await this.syncActiveLayers();
      this.catalogElement.requestUpdate();
      MainStore.nextLayersRemove();
    });

    MainStore.syncLayerParams.subscribe(() => {
      syncLayersParam(this.activeLayers);
    });

    MainStore.onIonAssetAdd.subscribe(asset => {
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
      const assets = this.activeLayers.filter(l => !!l.assetId);
      for (const asset of assets) {
        await this.removeLayerWithoutSync(asset);
      }
      this.viewer!.scene.requestRender();
      this.requestUpdate();
      syncLayersParam(this.activeLayers);
    });

    const sliceOptions = getSliceParam();
    if (sliceOptions && sliceOptions.type && sliceOptions.slicePoints)
      this.activePanel = 'tools';
  }

  render() {
    if (!this.queryManager) {
      return '';
    }

    this.queryManager.activeLayers = this.activeLayers
      .filter(config => config.visible && !config.noQuery);

    const shareBtn = html`
      <div class="ngm-share ${classMap({'ngm-active-section': this.activePanel === 'share'})}"
           @click=${() => this.togglePanel('share')}>
        <div class="ngm-share-icon"></div>
        ${i18next.t('lsb_share')}
      </div>`;
    const helpBtn = html`
      <div class="ngm-help" @click=${() => (<HTMLInputElement> this.querySelector('.ngm-help-link')).click()}>
        <div class="ngm-help-icon"></div>
        ${i18next.t('lsb_help')}
        <a href="/manuals/manual_en.html" target="_blank" .hidden=${true} class="ngm-help-link"></a>
      </div>`;
    const settingsBtn = html`
      <div class="ngm-settings ${classMap({'ngm-active-section': this.activePanel === 'settings'})}"
           @click=${() => this.togglePanel('settings')}>
        <div class="ngm-settings-icon"></div>
        ${i18next.t('lsb_settings')}
      </div>`;
    const authBtn = html`
      <ngm-auth class="ngm-user"
                endpoint='https://ngm-prod.auth.eu-west-1.amazoncognito.com/oauth2/authorize'
                clientId='6brvjsufv7fdubr12r9u0gajnj'
      ></ngm-auth>`;
    const dataMobileHeader = html`
      <div @click=${() => this.hideDataDisplayed = true}
           class="ngm-data-catalog-label ${classMap({active: this.hideDataDisplayed})}">
        ${i18next.t('lyr_geocatalog_label')}
      </div>
      <div @click=${() => this.hideDataDisplayed = false}
           class="ngm-data-catalog-label ${classMap({active: !this.hideDataDisplayed})}">
        ${i18next.t('dtd_displayed_data_label')}
      </div>`;

    return html`
      <div .hidden=${!this.mobileView || !this.mobileShowAll} class="ngm-menu-mobile">
        ${shareBtn}
        ${helpBtn}
        ${settingsBtn}
        <!-- required for correct positioning -->
        <div></div>
        <div></div>
      </div>
      <div class="ngm-menu">
        <div class="ngm-menu-1">
          <div class="ngm-dashboard ${classMap({'ngm-active-section': this.activePanel === 'dashboard'})}"
               @click=${() => this.togglePanel('dashboard')}>
            <div class="ngm-dashboard-icon"></div>
            ${i18next.t('lsb_dashboard')}
          </div>
          <div class="ngm-data ${classMap({'ngm-active-section': this.activePanel === 'data'})}"
               @click=${() => this.togglePanel('data')}>
            <div class="ngm-data-icon"></div>
            ${i18next.t('lsb_data')}
          </div>
          <div class="ngm-tools ${classMap({'ngm-active-section': this.activePanel === 'tools'})}"
               @click=${() => this.togglePanel('tools', false)}>
            <div class="ngm-tools-icon"></div>
            ${i18next.t('lsb_tools')}
          </div>
          ${this.mobileView ? authBtn : ''}
          ${!this.mobileView ? shareBtn : ''}
          <div .hidden=${!this.mobileView}
               class="ngm-mob-menu-toggle"
               @click=${() => this.mobileShowAll = !this.mobileShowAll}>
            <div class="${classMap({
              'ngm-view-all-icon': !this.mobileShowAll,
              'ngm-view-less-icon': this.mobileShowAll
            })}"></div>
            ${this.mobileShowAll ? i18next.t('lsb_close') : i18next.t('lsb_view_all')}
          </div>
        </div>
        <div .hidden=${this.mobileView} class="ngm-menu-2">
          ${authBtn}
          ${helpBtn}
          ${settingsBtn}
          <div class="ngm-nav-close ${classMap({'ngm-disabled': !this.activePanel})}"
               @click=${() => this.togglePanel('')}>
            <div class="ngm-nav-close-icon"></div>
            ${i18next.t('lsb_close')}
          </div>
        </div>
      </div>
      <ngm-dashboard class="ngm-side-bar-panel ngm-large-panel"
        ?hidden=${this.activePanel !== 'dashboard'}
        @close=${() => this.activePanel = ''}
        @layerclick=${evt => this.onCatalogLayerClicked(evt.detail.layer)}
      ></ngm-dashboard>
      <div .hidden=${this.activePanel !== 'data' || (this.mobileView && !this.hideDataDisplayed)}
           class="ngm-side-bar-panel ngm-layer-catalog">
        <div class="ngm-panel-header">
          ${this.mobileView ? dataMobileHeader : i18next.t('lyr_geocatalog_label')}
          <div class="ngm-close-icon" @click=${() => this.activePanel = ''}></div>
        </div>
        <div ?hidden=${this.mobileView} class="ngm-label-btn ngm-configure-data ${classMap({active: !this.hideDataDisplayed})}"
             @click=${() => this.hideDataDisplayed = !this.hideDataDisplayed}>
          ${i18next.t('dtd_configure_data_btn')}
        </div>
        <ngm-catalog class="ui accordion ngm-panel-content" .layers=${this.catalogLayers}
                     @layerclick=${evt => this.onCatalogLayerClicked(evt.detail.layer)}>
        </ngm-catalog>
      </div>
      <div .hidden=${this.activePanel !== 'tools'} class="ngm-side-bar-panel">
        <ngm-tools .toolsHidden=${this.activePanel !== 'tools'}
                   @open=${() => this.activePanel = 'tools'}
                   @close=${() => this.activePanel = ''}></ngm-tools>
      </div>
      <div .hidden=${this.activePanel !== 'share'} class="ngm-side-bar-panel ngm-large-panel">
        <div class="ngm-panel-header">${i18next.t('lsb_share')}
          <div class="ngm-close-icon" @click=${() => this.activePanel = ''}></div>
        </div>
        ${this.activePanel !== 'share' ? '' : html`
          <ngm-share-link></ngm-share-link>`}
      </div>
      <div .hidden=${this.activePanel !== 'settings'} class="ngm-side-bar-panel">
        <div class="ngm-panel-header">${i18next.t('lsb_settings')}
          <div class="ngm-close-icon" @click=${() => this.activePanel = ''}></div>
        </div>
        <div class="language-settings">
          <label>${i18next.t('lsb_langs')}</label>
          <div id="langs" class="ui horizontal selection list">
            ${SUPPORTED_LANGUAGES.map(lang => html`
              <div class="item lang-${lang}" @click="${() => i18next.changeLanguage(lang)}">${lang.toUpperCase()}</div>
            `)}
          </div>
        </div>
        <div class="toolbar-settings">
          <label>${i18next.t('lsb_debug_tools')}</label>
          <div class="ngm-checkbox ngm-debug-tools-toggle ${classMap({active: this.debugToolsActive})}"
               @click=${() => (<HTMLInputElement> this.querySelector('.ngm-debug-tools-toggle > input')).click()}>
            <input type="checkbox" ?checked=${this.debugToolsActive} @change="${this.toggleDebugTools}">
            <span class="ngm-checkbox-icon">
              </span>
            <label>${i18next.t('lsb_cesium_toolbar_label')}</label>
          </div>
        </div>
      </div>
      <div .hidden=${this.activePanel !== 'data' || this.hideDataDisplayed}
           class="ngm-side-bar-panel ngm-extension-panel ngm-data-panel">
        <div class="ngm-panel-header">
          ${this.mobileView ? dataMobileHeader : i18next.t('dtd_displayed_data_label')}
          <div class="ngm-close-icon"
               @click=${() => this.mobileView ? this.activePanel = '' : this.hideDataDisplayed = true}></div>
        </div>
        <div class="ngm-toast-placeholder"></div>
        <div class="ngm-panel-content">
          <div class="ngm-label-btn ${classMap({active: this.layerOrderChangeActive})}"
               @click=${this.toggleLayerOrderChange}>
            ${this.layerOrderChangeActive ? i18next.t('dtd_finish_ordering_label') : i18next.t('dtd_change_order_label')}
          </div>
          ${this.layerOrderChangeActive ?
              html`
                <ngm-layers-sort
                    .layers=${this.activeLayers}
                    @orderChanged=${(evt) => this.onLayersOrderChange(evt.detail)}
                    @zoomTo=${evt => {
                      NavToolsStore.hideTargetPoint();
                      zoomTo(this.viewer!, evt.detail);
                    }}>
                </ngm-layers-sort>` :
              html`
                <ngm-layers
                    .layers=${this.activeLayers}
                    .actions=${this.layerActions}
                    @zoomTo=${evt => {
                      NavToolsStore.hideTargetPoint();
                      zoomTo(this.viewer!, evt.detail);
                    }}
                    @removeDisplayedLayer=${evt => this.onRemoveDisplayedLayer(evt)}
                    @layerChanged=${evt => this.onLayerChanged(evt)}>
                </ngm-layers>`
          }
          <h5 class="ui header">${i18next.t('dtd_user_content_label')}</h5>
          <ngm-layers-upload 
              .toastPlaceholder=${this.toastPlaceholder} 
              .onKmlUpload=${(file: File, clampToGround: boolean) => this.onKmlUpload(file, clampToGround)}>
          </ngm-layers-upload>
          <button class="ui button ngm-ion-add-content-btn ngm-action-btn" 
                  @click=${() => this.dispatchEvent(new CustomEvent('openIonModal'))}>
            ${i18next.t('dtd_add_ion_token')}
          </button>
          <h5 class="ui header ngm-background-label">
            ${i18next.t('dtd_background_map_label')}
            <div class="ui ${this.globeQueueLength_ > 0 ? 'active' : ''} inline mini loader">
              <span class="ngm-load-counter">${this.globeQueueLength_}</span>
            </div>
          </h5>
          <ngm-map-configuration></ngm-map-configuration>
          <div class="ui divider"></div>
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
    if (this.activePanel === 'data' && !this.mobileView) this.hideDataDisplayed = false;
  }

  async syncActiveLayers() {
    const attributeParams = getAttribute();
    const callback = attributeParams ?
      this.getTileLoadCallback(attributeParams.attributeKey, attributeParams.attributeValue) :
      undefined;
      const flatLayers = this.getFlatLayers(this.catalogLayers, callback);
    const urlLayers = getLayerParams();
    const assetIds = getAssetIds();
    const ionToken = MainStore.ionToken.value;

    if (!urlLayers.length && !assetIds.length) {
      this.activeLayers = flatLayers.filter(l => l.displayed);
      syncLayersParam(this.activeLayers);
      return;
    }

    // First - make everything hidden
    flatLayers.forEach(l => {
      l.visible = false;
      l.displayed = false;
    });

    const activeLayers: LayerConfig[] = [];
    for (const urlLayer of urlLayers) {
      let layer = flatLayers.find(fl => fl.layer === urlLayer.layer);
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = await this.getLayerFromUrl(urlLayer);
      } else {
        await (layer.promise || this.addLayer(layer));
        layer.add && layer.add();
      }
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.wmtsCurrentTime = urlLayer.timestamp;
      layer.setOpacity && layer.setOpacity(layer.opacity);
      layer.displayed = true;
      layer.setVisibility && layer.setVisibility(layer.visible);
      activeLayers.push(layer);
    }

    if (ionToken) {
      const ionAssetsRes = await getAssets(ionToken);
      const ionAssets = ionAssetsRes?.items || [];

      assetIds.forEach(assetId => {
        const ionAsset = ionAssets.find(asset => asset.id === Number(assetId));
        const layer: LayerConfig = {
          type: LayerType.tiles3d,
          assetId: Number(assetId),
          ionToken: ionToken,
          label: ionAsset?.name || assetId,
          layer: assetId,
          visible: true,
          displayed: true,
          opacityDisabled: true,
          pickable: true,
          customAsset: true
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
      this.viewer.scene.globe.tileLoadProgressEvent.addEventListener(queueLength => {
        this.globeQueueLength_ = queueLength;
      });
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
            if (element && element.classList.contains('accordion')) {
              $(element).accordion({duration: 150});
            }
          }
          this.accordionInited = true;
        }
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
        const idx = this.activeLayers.findIndex(l => l.label === layer.label);
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

  onLayerChanged(evt) {
    this.queryManager!.hideObjectInformation();
    const catalogLayers = this.catalogLayers ? this.catalogLayers : [];
    this.catalogLayers = [...catalogLayers];
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    if (evt.detail) {
      this.maybeShowVisibilityHint(evt.detail);
    }
    this.requestUpdate();
  }

  maybeShowVisibilityHint(config: LayerConfig) {
    if (this.displayUndergroundHint
      && config.visible
      && [LayerType.tiles3d, LayerType.earthquakes].includes(config.type!)
      && !this.viewer?.scene.cameraUnderground) {
      showSnackbarInfo(i18next.t('lyr_subsurface_hint'), {displayTime: 20000});
      this.displayUndergroundHint = false;
    }
  }

  async onRemoveDisplayedLayer(evt) {
    const {config, idx} = evt.detail;
    this.activeLayers.splice(idx, 1);
    await this.removeLayer(config);
  }

  async removeLayerWithoutSync(config: LayerConfig) {
    if (config.setVisibility) {
      config.setVisibility(false);
    } else {
      const c = await config.promise;
      if (c instanceof CustomDataSource || c instanceof GeoJsonDataSource) {
        this.viewer!.dataSources.getByName(c.name)[0].show = false;
      }
    }
    config.visible = false;
    config.displayed = false;
    if (config.remove) {
      config.remove();
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
  async addLayerFromSearch(searchLayer) {
    let layer;
    if (searchLayer.dataSourceName) {
      layer = this.activeLayers.find(l => l.type === searchLayer.dataSourceName); // check for layers like earthquakes
    } else {
      layer = this.activeLayers.find(l => l.layer === searchLayer.layer); // check for swisstopoWMTS layers
    }

    if (layer) { // for layers added before
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
    } else { // for new layers
      this.activeLayers.push(this.createSearchLayer(searchLayer));
    }
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    this.requestUpdate();
  }

  createSearchLayer(searchLayer: SearchLayer) {
    let config: LayerConfig;
    if (searchLayer.type) {
      config = searchLayer;
      config.visible = true;
      config.origin = 'layer';
      config.label = searchLayer.title || searchLayer.label;
    } else {
      config = {
        type: LayerType.swisstopoWMTS,
        label: searchLayer.title || searchLayer.label,
        layer: searchLayer.layer,
        visible: true,
        displayed: true,
        opacity: DEFAULT_LAYER_OPACITY,
        queryType: 'geoadmin'
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

  async getLayerFromUrl(urlLayer: LayerFromParam) {
    const searchLayerLabel = await getLayerLabel(urlLayer.layer);
    const searchLayer: SearchLayer = {label: searchLayerLabel, layer: urlLayer.layer};
    return this.createSearchLayer(searchLayer);
  }

  zoomToPermalinkObject() {
    this.zoomedToPosition = true;
    const zoomToPosition = getZoomToPosition();
    if (zoomToPosition) {
      let altitude = 0, cartesianPosition: Cartesian3 | undefined, windowPosition: Cartesian2 | undefined;
      const updateValues = () => {
        altitude = this.viewer!.scene.globe.getHeight(this.viewer!.scene.camera.positionCartographic) || 0;
        cartesianPosition = Cartesian3.fromDegrees(zoomToPosition.longitude, zoomToPosition.latitude, zoomToPosition.height + altitude);
        windowPosition = this.viewer!.scene.cartesianToCanvasCoordinates(cartesianPosition);
      };
      updateValues();
      const completeCallback = () => {
        if (windowPosition) {
          let maxTries = 25;
          let triesCounter = 0;
          const eventHandler = new ScreenSpaceEventHandler(this.viewer!.canvas);
          eventHandler.setInputAction(() => maxTries = 0, ScreenSpaceEventType.LEFT_DOWN);
          // Waits while will be possible to select an object
          const tryToSelect = () => setTimeout(() => {
            updateValues();
            this.zoomToObjectCoordinates(cartesianPosition);
            windowPosition && this.queryManager!.pickObject(windowPosition);
            triesCounter += 1;
            if (!this.queryManager!.objectSelector.selectedObj && triesCounter <= maxTries) {
              tryToSelect();
            } else {
              eventHandler.destroy();
              if (triesCounter > maxTries) {
                showSnackbarError(i18next.t('dtd_object_on_coordinates_not_found_warning'));
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
      boundingSphere.radius);
    this.viewer!.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
      complete: complete
    });
  }

  addLayer(layer: LayerConfig) {
    layer.promise = createCesiumObject(this.viewer!, layer);
    this.dispatchEvent(new CustomEvent('layeradded', {
      detail: {
        layer
      }
    }));
    return layer.promise;
  }

  toggleLayerOrderChange() {
    this.layerOrderChangeActive = !this.layerOrderChangeActive;
  }

  async onLayersOrderChange(layers: LayerConfig[]) {
    await this.layerActions!.reorderLayers(layers);
    // update activeLayers only when ordering finished
    if (!this.layerOrderChangeActive) {
      this.activeLayers = [...layers];
    }
    this.dispatchEvent(new CustomEvent('layerChanged'));
  }

  async onKmlUpload(file: File, clampToGround: boolean) {
    if (!this.viewer) return;
    const dataSource = new CustomDataSource();
    const name = await parseKml(this.viewer, file, dataSource, clampToGround);
    // name used as id for datasource
    dataSource.name = `${name}_${Date.now()}`;
    await this.viewer.dataSources.add(dataSource);
    this.viewer.scene.requestRender();
    // done like this to have correct rerender of component
    const promise = Promise.resolve(dataSource);
    const config: LayerConfig = {
      load() {return promise;},
      label: name,
      promise: promise,
      zoomToBbox: true,
      opacity: DEFAULT_LAYER_OPACITY,
      notSaveToPermalink: true,
      ownKml: true,
      opacityDisabled: true
    };
    await this.onCatalogLayerClicked(config);
    this.viewer.zoomTo(dataSource);
    this.requestUpdate();
  }

  toggleDebugTools(event) {
    const active = event.target.checked;
    this.debugToolsActive = active;
    setCesiumToolbarParam(active);
    this.dispatchEvent(new CustomEvent('toggleDebugTools', {detail: {active}}));
  }

  createRenderRoot() {
    return this;
  }
}