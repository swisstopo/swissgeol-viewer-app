import {html} from 'lit';
import {LitElementI18n} from '../i18n.js';
import '../toolbox/ngm-toolbox';
import '../layers/ngm-layers';
import '../layers/ngm-catalog';
import LayersActions from '../layers/LayersActions';
import {DEFAULT_LAYER_OPACITY, LayerType} from '../constants';
import defaultLayerTree from '../layertree';
import {getLayerParams, syncLayersParam, getAssetIds, getAttribute, getSliceParam} from '../permalink.js';
import {createCesiumObject} from '../layers/helpers';
import i18next from 'i18next';
import 'fomantic-ui-css/components/accordion.js';
import './ngm-map-configuration';
import {getZoomToPosition} from '../permalink';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import CMath from 'cesium/Source/Core/Math';
import {showWarning} from '../notifications';
import auth from '../store/auth';
import './ngm-share-link.js';
import '../layers/ngm-layers-upload';
import MainStore from '../store/main';
import {classMap} from 'lit/directives/class-map.js';
import {zoomTo} from '../utils';
import $ from '../jquery';

class SideBar extends LitElementI18n {

  constructor() {
    super();
    /**
     * @type {import('cesium').Viewer}
     */
    this.viewer = null;
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
  }

  static get properties() {
    return {
      catalogLayers: {type: Object},
      activeLayers: {type: Object},
      queryManager: {type: Object},
      activePanel: {type: String, attribute: false},
      showHeader: {type: Boolean, attribute: false},
      globeQueueLength_: {type: Number, attribute: false},
    };
  }

  firstUpdated() {
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

    return html`
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
          <div class="ngm-share ${classMap({'ngm-active-section': this.activePanel === 'share'})}"
               @click=${() => this.togglePanel('share')}>
            <div class="ngm-share-icon"></div>
            ${i18next.t('lsb_share')}
          </div>
        </div>
        <div class="ngm-menu-2">
          <ngm-auth class="ngm-user"
                    endpoint='https://ngm-prod.auth.eu-west-1.amazoncognito.com/oauth2/authorize'
                    clientId='6brvjsufv7fdubr12r9u0gajnj'
          ></ngm-auth>
          <div class="ngm-help" @click=${() => this.querySelector('.ngm-help-link').click()}>
            <div class="ngm-help-icon"></div>
            ${i18next.t('lsb_help')}
            <a href="/manuals/manual_en.html" target="_blank" .hidden=${true} class="ngm-help-link"></a>
          </div>
          <div class="ngm-settings ${classMap({'ngm-active-section': this.activePanel === 'settings'})}"
               @click=${() => this.togglePanel('settings')}>
            <div class="ngm-settings-icon"></div>
            ${i18next.t('lsb_settings')}
          </div>
          <div class="ngm-nav-close ${classMap({'ngm-disabled': !this.activePanel})}"
               @click=${() => this.togglePanel('')}>
            <div class="ngm-nav-close-icon"></div>
            ${i18next.t('lsb_close')}
          </div>
        </div>
      </div>
      <div .hidden=${this.activePanel !== 'dashboard'} class="ngm-side-bar-panel ngm-large-panel">
      </div>
      <div .hidden=${this.activePanel !== 'data'} class="ngm-side-bar-panel ngm-layer-catalog">
        <div class="ngm-panel-header">${i18next.t('lyr_geocatalog_label')}
          <div class="ngm-close-icon" @click=${() => this.activePanel = ''}></div>
        </div>
        <ngm-catalog class="ui accordion ngm-panel-content" .layers=${this.catalogLayers}
                     @layerclick=${evt => this.onCatalogLayerClicked(evt)}>
        </ngm-catalog>
      </div>
      <div .hidden=${this.activePanel !== 'tools'} class="ngm-side-bar-panel">
        <ngm-tools @close=${() => this.activePanel = ''}></ngm-tools>
      </div>
      <div .hidden=${this.activePanel !== 'share'} class="ngm-side-bar-panel">
        <div class="ngm-panel-header">${i18next.t('lsb_share')}
          <div class="ngm-close-icon" @click=${() => this.activePanel = ''}></div>
        </div>
        <ngm-share-link></ngm-share-link>
      </div>
      <div .hidden=${this.activePanel !== 'data'} class="ngm-side-bar-panel ngm-extension-panel">
        <div class="ngm-panel-header">${i18next.t('dtd_displayed_data_label')}
          <div class="ngm-close-icon" @click=${() => this.activePanel = ''}></div>
        </div>
        <div class="ngm-panel-content">
          <ngm-layers
            .layers=${this.activeLayers}
            .actions=${this.layerActions}
            @zoomTo=${evt => zoomTo(this.viewer, evt.detail)}
            @removeDisplayedLayer=${evt => this.onRemoveDisplayedLayer(evt)}
            @layerChanged=${() => this.onLayerChanged()}>
          </ngm-layers>
          <h5 class="ui header">
            ${i18next.t('dtd_background_map_label')}
            <div class="ui ${this.globeQueueLength_ > 0 ? 'active' : ''} inline mini loader">
              <span class="small_load_counter">${this.globeQueueLength_}</span>
            </div>
          </h5>
          <ngm-map-configuration></ngm-map-configuration>
          <div class="ui divider"></div>
          <ngm-layers-upload .viewer="${this.viewer}"></ngm-layers-upload>
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
  }

  // todo not use for now
  // get activeLayersForDownload() {
  //   const result = this.activeLayers
  //     .filter(l => l.visible && !!l.downloadDataType)
  //     .map(l => ({
  //       layer: l.layer,
  //       url: l.downloadDataPath,
  //       type: l.downloadDataType
  //     }));
  //   return result;
  // }
  //
  // async downloadActiveData(evt) {
  //   const {bbox4326} = evt.detail;
  //   const specs = this.activeLayersForDownload;
  //   const data = [];
  //   for await (const d of createDataGenerator(specs, bbox4326)) data.push(d);
  //   if (data.length === 0) {
  //     showWarning(i18next.t('tbx_no_data_to_download_warning'));
  //     return;
  //   }
  //   const zip = await createZipFromData(data);
  //   const blob = await zip.generateAsync({type: 'blob'});
  //   saveAs(blob, 'swissgeol_data.zip');
  // }

  initializeActiveLayers() {
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

    const activeLayers = [];
    urlLayers.forEach(urlLayer => {
      let layer = flatLayers.find(fl => fl.layer === urlLayer.name);
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = this.createSearchLayer(urlLayer.name, urlLayer.name);
      }
      layer.visible = urlLayer.visible;
      layer.opacity = urlLayer.opacity;
      layer.displayed = true;
      activeLayers.push(layer);
    });

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
        customAsset: true
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
          this.queryManager.selectTile(feature);
          return;
        }
      }
    };
  }

  update(changedProperties) {
    if (this.viewer && !this.layerActions) {
      this.layerActions = new LayersActions(this.viewer);
      if (!this.catalogLayers) {
        this.catalogLayers = [...defaultLayerTree];
        this.initializeActiveLayers();
      }
      this.viewer.scene.globe.tileLoadProgressEvent.addEventListener(queueLength => {
        this.globeQueueLength_ = queueLength;
      });
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
    }
    layer.setVisibility && layer.setVisibility(layer.visible);

    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.viewer.scene.requestRender();
  }

  onLayerChanged() {
    this.queryManager.hideObjectInformation();
    this.catalogLayers = [...this.catalogLayers];
    syncLayersParam(this.activeLayers);
  }

  onRemoveDisplayedLayer(evt) {
    const {config, idx} = evt.detail;
    this.activeLayers.splice(idx, 1);
    this.removeLayer(config);
  }

  removeLayer(config) {
    config.setVisibility(false);
    config.visible = false;
    config.displayed = false;
    if (config.remove) {
      config.remove();
    }
    this.viewer.scene.requestRender();
    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.requestUpdate();
  }

  getFlatLayers(tree, tileLoadCallback) {
    const flat = [];
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
      this.viewer.scene.requestRender();
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
      queryType: 'geoadmin'
    };
    config.load = () => this.addLayer(config);
    return config;
  }

  zoomToPermalinkObject() {
    this.zoomedToPosition = true;
    const zoomToPosition = getZoomToPosition();
    if (zoomToPosition) {
      let altitude = undefined, cartesianPosition = undefined, windowPosition = undefined;
      const updateValues = () => {
        altitude = this.viewer.scene.globe.getHeight(this.viewer.scene.camera.positionCartographic) || 0;
        cartesianPosition = Cartesian3.fromDegrees(zoomToPosition.longitude, zoomToPosition.latitude, zoomToPosition.height + altitude);
        windowPosition = this.viewer.scene.cartesianToCanvasCoordinates(cartesianPosition);
      };
      updateValues();
      const completeCallback = () => {
        if (windowPosition) {
          let maxTries = 25;
          let triesCounter = 0;
          const eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
          eventHandler.setInputAction(event => maxTries = 0, ScreenSpaceEventType.LEFT_DOWN);
          // Waits while will be possible to select an object
          const tryToSelect = () => setTimeout(() => {
            updateValues();
            this.zoomToObjectCoordinates(cartesianPosition);
            this.queryManager.pickObject(windowPosition);
            triesCounter += 1;
            if (!this.queryManager.objectSelector.selectedObj && triesCounter <= maxTries) {
              tryToSelect();
            } else {
              eventHandler.destroy();
              if (triesCounter > maxTries) {
                showWarning(i18next.t('dtd_object_on_coordinates_not_found_warning'));
              }
            }
          }, 500);
          tryToSelect();
        }

      };
      this.zoomToObjectCoordinates(cartesianPosition, completeCallback);
    }
  }

  zoomToObjectCoordinates(center, complete) {
    const boundingSphere = new BoundingSphere(center, 1000);
    const zoomHeadingPitchRange = new HeadingPitchRange(
      0,
      -CMath.toRadians(45),
      boundingSphere.radius);
    this.viewer.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
      complete: complete
    });
  }

  addLayer(layer) {
    layer.promise = createCesiumObject(this.viewer, layer);
    this.dispatchEvent(new CustomEvent('layeradded', {
      detail: {
        layer
      }
    }));
    return layer.promise;
  }

  createRenderRoot() {
    return this;
  }
}


customElements.define('ngm-side-bar', SideBar);
