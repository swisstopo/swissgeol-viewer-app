import {html} from 'lit';
import {LitElementI18n} from '../i18n.js';
import '../toolbox/ngm-toolbox';
import '../layers/ngm-layers';
import '../layers/ngm-catalog';
import './ngm-dashboard';
import LayersActions from '../layers/LayersActions';
import {DEFAULT_LAYER_OPACITY, LayerType, SUPPORTED_LANGUAGES} from '../constants';
import defaultLayerTree from '../layertree';
import {
  getAssetIds,
  getAttribute,
  getLayerParams,
  getSliceParam,
  getZoomToPosition,
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
  Math as CMath
} from 'cesium';
import {showSnackbarError, showSnackbarInfo} from '../notifications';
import auth from '../store/auth';
import './ngm-share-link.ts';
import '../layers/ngm-layers-upload';
import MainStore from '../store/main';
import {classMap} from 'lit/directives/class-map.js';
import {zoomTo} from '../utils';
import $ from '../jquery';
import {customElement, property, query, state} from 'lit/decorators.js';
import type {Cartesian2, Viewer} from 'cesium';
import type QueryManager from '../query/QueryManager';
import NavToolsStore from '../store/navTools';

import type {Config} from '../layers/ngm-layers-item.js';

@customElement('ngm-side-bar')
export class SideBar extends LitElementI18n {
  @property({type: Object}) queryManager: QueryManager | null = null;
  @property({type: Boolean}) mobileView = false;
  @property({type: Boolean}) displayUndergroundHint = true;
  @state() catalogLayers: any;
  @state() activeLayers: any;
  @state() activePanel: string | null = null;
  @state() showHeader = false;
  @state() globeQueueLength_ = 0;
  @state() mobileShowAll = false;
  @state() hideDataDisplayed = false;
  @state() layerOrderChangeActive = false;
  @query('.ngm-side-bar-panel > .ngm-toast-placeholder') toastPlaceholder;
  @query('ngm-catalog') catalogElement;
  private viewer: Viewer | null = null;
  private layerActions: any;
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
    MainStore.syncLayers.subscribe(async () => {
      if (this.activeLayers) {
        this.activeLayers.forEach(layer => this.removeLayerWithoutSync(layer));
      }
      await this.syncActiveLayers();
      this.catalogElement.requestUpdate();
      MainStore.nextLayersRemove();
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
        @layerclick=${evt => this.onCatalogLayerClicked(evt)}
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
                     @layerclick=${evt => this.onCatalogLayerClicked(evt)}>
        </ngm-catalog>
      </div>
      <div .hidden=${this.activePanel !== 'tools'} class="ngm-side-bar-panel">
        <ngm-tools .toolsHidden=${this.activePanel !== 'tools'}
                   @open=${() => this.activePanel = 'tools'}
                   @close=${() => this.activePanel = ''}></ngm-tools>
      </div>
      <div .hidden=${this.activePanel !== 'share'} class="ngm-side-bar-panel">
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
      </div>
      <div .hidden=${this.activePanel !== 'data' || this.hideDataDisplayed}
           class="ngm-side-bar-panel ngm-extension-panel">
        <div class="ngm-panel-header">
          ${this.mobileView ? dataMobileHeader : i18next.t('dtd_displayed_data_label')}
          <div class="ngm-close-icon"
               @click=${() => this.mobileView ? this.activePanel = '' : this.hideDataDisplayed = true}></div>
        </div>
        <div class="ngm-toast-placeholder"></div>
        <div class="ngm-panel-content">
          <div class="ngm-label-btn ${classMap({active: this.layerOrderChangeActive})}"
               @click=${this.toggleLayerOrderChange}>
            ${i18next.t('dtd_change_order_label')}
          </div>
          <ngm-layers
            .layers=${this.activeLayers}
            .actions=${this.layerActions}
            .changeOrderActive=${this.layerOrderChangeActive}
            @zoomTo=${evt => {
              NavToolsStore.hideTargetPoint();
              zoomTo(this.viewer!, evt.detail);
            }}
            @removeDisplayedLayer=${evt => this.onRemoveDisplayedLayer(evt)}
            @layerChanged=${evt => this.onLayerChanged(evt)}>
          </ngm-layers>
          <h5 class="ui header">${i18next.t('dtd_user_content_label')}</h5>
          <ngm-layers-upload .viewer="${this.viewer}" .toastPlaceholder=${this.toastPlaceholder}
            @layerclick=${evt => this.onCatalogLayerClicked(evt)}>
          </ngm-layers-upload>
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

    const activeLayers: any[] = [];
    await Promise.all(urlLayers.map(async (urlLayer) => {
      let layer = flatLayers.find(fl => fl.layer === urlLayer.name);
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = this.createSearchLayer(urlLayer.name, urlLayer.name);
      } else {
        await (layer.promise || this.addLayer(layer));
        layer.add && layer.add();
      }
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.setOpacity && layer.setOpacity(layer.opacity);
      layer.displayed = true;
      layer.setVisibility && layer.setVisibility(layer.visible);
      activeLayers.push(layer);
    }));

    assetIds.forEach(assetId => {
      const layer = {
        type: LayerType.tiles3d,
        assetId: assetId,
        label: assetId,
        layer: assetId,
        visible: true,
        displayed: true,
        opacityDisabled: true,
        pickable: true,
        customAsset: true,
        load: () => {
        }
      };
      layer.load = () => this.addLayer(layer);
      activeLayers.push(layer);
    });

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

  async onCatalogLayerClicked(evt) {
    // toggle whether the layer is displayed or not (=listed in the side bar)
    const layer = evt.detail.layer;
    if (layer.displayed) {
      if (layer.visible) {
        layer.displayed = false;
        layer.visible = false;
        layer.remove && layer.remove();
        const idx = this.activeLayers.findIndex(l => l === layer);
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
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.viewer!.scene.requestRender();
  }

  onLayerChanged(evt) {
    this.queryManager!.hideObjectInformation();
    this.catalogLayers = [...this.catalogLayers];
    syncLayersParam(this.activeLayers);
    if (evt.detail) {
      this.maybeShowVisibilityHint(evt.detail);
    }
  }

  maybeShowVisibilityHint(config: Config) {
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

  async removeLayerWithoutSync(config) {
    if (config.setVisibility) {
      config.setVisibility(false);
    } else {
      const c = await config.promise;
      this.viewer!.dataSources.getByName(c.name)[0].show = false;
    }
    config.visible = false;
    config.displayed = false;
    if (config.remove) {
      config.remove();
    }
  }

  async removeLayer(config) {
    await this.removeLayerWithoutSync(config);
    this.viewer!.scene.requestRender();
    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
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
  addLayerFromSearch(searchLayer) {
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
      this.activeLayers.push(this.createSearchLayer(searchLayer.title, searchLayer.layer));
    }
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    this.requestUpdate();
  }

  createSearchLayer(title, layername) {
    const config = {
      type: LayerType.swisstopoWMTS,
      label: title,
      layer: layername,
      visible: true,
      displayed: true,
      opacity: DEFAULT_LAYER_OPACITY,
      queryType: 'geoadmin',
      load: () => {
      }
    };
    config.load = () => this.addLayer(config);
    return config;
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
            this.queryManager!.pickObject(windowPosition);
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

  addLayer(layer) {
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

  createRenderRoot() {
    return this;
  }
}
