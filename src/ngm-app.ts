import {LitElementI18n} from './i18n';
import {html} from 'lit-html';
import './elements/ngm-side-bar';
import './elements/ngm-navigation-widgets';
import './elements/ngm-full-screen-view';
import './elements/ngm-object-information';
import './elements/ngm-feature-height';
import './elements/ngm-auth';
import './elements/ngm-drop-files';
import './elements/ngm-tracking-consent';
import './elements/ngm-camera-information.js';
import './elements/ngm-nav-tools';
import './elements/ngm-minimap';
import './elements/ngm-cam-configuration';

import {
  DEFAULT_VIEW,
} from './constants';

import {setupSearch} from './search.js';
import {setupViewer, addMantelEllipsoid, setupBaseLayers} from './viewer';

import {getCameraView, getSliceParam, syncCamera, syncSliceParam} from './permalink.js';
import i18next from 'i18next';
import {getZoomToPosition} from './permalink';
import Slicer from './slicer/Slicer';

import {setupI18n} from './i18n.js';
import QueryManager from './query/QueryManager';

import {initAnalytics} from './analytics.js';
import {initSentry} from './sentry.js';
import {showWarning} from './message';
import MainStore from './store/main';
import SlicerStore from './store/slicer';
import {classMap} from 'lit-html/directives/class-map.js';
import {customElement, state} from 'lit-element';
import MapChooser from './MapChooser';
import {NgmLayerLegendContainer} from './elements/ngm-layer-legend-container';
import {NgmSlowLoading} from './elements/ngm-slow-loading';
import {NgmSlicer} from './elements/slicer/ngm-slicer';
import {NgmAreaOfInterestDrawer} from './toolbox/AreaOfInterestDrawer';
import LayersUpload from './layers/ngm-layers-upload';
import {NgmLoadingMask} from './elements/ngm-loading-mask';
import {Viewer} from 'cesium';

const SKIP_STEP2_TIMEOUT = 5000;

const isLocalhost = document.location.hostname === 'localhost';

const onStep1Finished = (globe, searchParams) => {
  let sse = 2;
  if (isLocalhost) {
    sse = 20;
  }
  if (searchParams.has('maximumScreenSpaceError')) {
    sse = parseFloat(searchParams.get('maximumScreenSpaceError'));
  }
  globe.maximumScreenSpaceError = sse;
};

/**
 * This is the root component. It is useful for:
 * - wiring the attributes of all top-level components;
 * - distribute events vertically between components (non hierarchical).
 */
@customElement('ngm-app')
export class NgmApp extends LitElementI18n {
  @state() mapChooser: MapChooser | undefined;
  @state() slicer_: Slicer | undefined;
  @state() showMinimap = false;
  @state() showCamConfig = false;
  private viewer: Viewer | undefined;
  private queryManager: QueryManager | undefined;

  constructor() {
    super();
    // disable drag events to avoid appearing of drag&drop zone
    this.addEventListener('dragstart', e => e.preventDefault());
  }

  /**
   * @param {CustomEvent} evt
   */
  onLayerAdded(evt) {
    const layer = evt.detail.layer;
    if (layer.backgroundId !== undefined && this.mapChooser!.elements) {
      this.mapChooser!.selectMap(layer.backgroundId);
    }
    if (this.slicer_ && this.slicer_!.active) {
      if (layer && layer.promise) {
        this.slicer_!.applyClippingPlanesToTileset(layer.promise);
      }
    }
  }

  onShowLayerLegend(event) {
    (<NgmLayerLegendContainer> this.querySelector('ngm-layer-legend-container')).showLegend(event.detail.config);
  }

  onStep2Finished({loadingMask, viewer}) {
    loadingMask.active = false;
    const loadingTime = performance.now() / 1000;
    console.log(`loading mask displayed ${(loadingTime).toFixed(3)}s`);
    (<NgmSlowLoading> this.querySelector('ngm-slow-loading')).style.display = 'none';
    this.slicer_ = new Slicer(viewer);
    const sliceOptions = getSliceParam();
    if (sliceOptions && sliceOptions.type && sliceOptions.slicePoints) {
      this.slicer_!.sliceOptions = {
        ...this.slicer_!.sliceOptions, ...sliceOptions,
        syncBoxPlanesCallback: (sliceInfo) => syncSliceParam(sliceInfo),
        deactivationCallback: () => {
          (<NgmSlicer> this.querySelector('ngm-slicer')).onDeactivation();
        }
      };
      this.slicer_!.active = true;
    }
    SlicerStore.setSlicer(this.slicer_);

    // setup web components
    this.mapChooser = setupBaseLayers(viewer);
    this.mapChooser!.addMapChooser(this.querySelector('.ngm-bg-chooser-map'));
    MainStore.setMapChooser(this.mapChooser);
    // Handle queries (local and Swisstopo)
    this.queryManager = new QueryManager(viewer);

    const sideBar = this.querySelector('ngm-side-bar');

    setupSearch(viewer, this.querySelector('ga-search')!, sideBar);
  }


  /**
   * @param file
   * @param {'toolbox'|'model'} type
   */
  onFileDrop(file, type) {
    if (type === 'toolbox') {
      const aoi: NgmAreaOfInterestDrawer = this.querySelector('ngm-aoi-drawer')!;
      if (file.name.toLowerCase().endsWith('.kml')) {
        aoi.uploadKml(file);
      } else if (file.name.toLowerCase().endsWith('.gpx')) {
        aoi.uploadGpx(file);
      }
    } else if (type === 'model') {
      if (file.name.toLowerCase().endsWith('.kml')) {
        const kmlUpload: LayersUpload = this.querySelector('ngm-layers-upload')!;
        kmlUpload.uploadKml(file);
      } else {
        showWarning(i18next.t('dtd_file_not_kml'));
      }
    }
  }

  /**
   * @param {import ('cesium').Viewer} viewer
   */
  startCesiumLoadingProcess(viewer) {
    const globe = viewer.scene.globe;

    addMantelEllipsoid(viewer);

    // Temporarily increasing the maximum screen space error to load low LOD tiles.
    const searchParams = new URLSearchParams(document.location.search);
    globe.maximumScreenSpaceError = parseFloat(searchParams.get('initialScreenSpaceError') || '2000');

    let currentStep = 1;
    const loadingMask: NgmLoadingMask = this.querySelector('ngm-loading-mask')!;
    const unlisten = globe.tileLoadProgressEvent.addEventListener(queueLength => {
      loadingMask.message = queueLength;
      if (currentStep === 1 && globe.tilesLoaded) {
        currentStep = 2;
        loadingMask.step = currentStep;
        console.log('Step 1 finished');
        onStep1Finished(globe, searchParams);
        setTimeout(() => {
          if (currentStep === 2) {
            console.log('Too long: going straight to step 3');
            currentStep = 3;
            this.onStep2Finished({loadingMask, viewer});
            unlisten();
          }
        }, SKIP_STEP2_TIMEOUT);
      } else if (currentStep === 2 && globe.tilesLoaded) {
        currentStep = 3;
        console.log('Step 2 finished');
        this.onStep2Finished({loadingMask, viewer});
        unlisten();
      }
    });


  }

  firstUpdated() {
    setupI18n();
    const cesiumContainer = this.querySelector('#cesium')!;
    const viewer = setupViewer(cesiumContainer, isLocalhost);
    this.viewer = viewer;
    window['viewer'] = viewer; // for debugging

    this.startCesiumLoadingProcess(viewer);

    const {destination, orientation} = getCameraView();
    const zoomToPosition = getZoomToPosition();
    if (!zoomToPosition) {
      viewer.camera.flyTo({
        destination: destination || DEFAULT_VIEW.destination,
        orientation: orientation || DEFAULT_VIEW.orientation,
        duration: 0
      });
    }

    viewer.camera.moveEnd.addEventListener(() => syncCamera(viewer.camera));

    MainStore.setViewer(viewer);

    i18next.on('initialized', () => {
      this.showSlowLoadingWindow();
    });

    const origin = window.location.origin;
    const pathname = window.location.pathname;
    (<any> this.querySelector('#ngm-home-link')).href = `${origin}${pathname}`;

    window.addEventListener('resize', () => {
      (<any> this.querySelectorAll('.ngm-floating-window')).forEach(flWin => {
        if (flWin.interaction) {
          flWin.interaction.reflow({name: 'drag', axis: 'xy'});
        }
      });
    });
  }

  showSlowLoadingWindow() {
    const timeout = 10000;
    const loadingMask: NgmLoadingMask = this.querySelector('ngm-loading-mask')!;
    if (loadingMask.active && performance.now() > timeout) {
      (<NgmSlowLoading> this.querySelector('ngm-slow-loading'))!.style.display = 'block';
    } else {
      setTimeout(() => {
        if (loadingMask.active) {
          (<NgmSlowLoading> this.querySelector('ngm-slow-loading'))!.style.display = 'block';
        }
      }, timeout - performance.now());
    }
  }

  onTrackingAllowedChanged(event) {
    initSentry(event.detail.allowed);
    initAnalytics(event.detail.allowed);
  }

  render() {
    return html`
      <header>
        <a id="ngm-home-link" href=""><img class="logo" src="src/images/logo-CH.svg"></a>
        <ga-search class="ui big icon input" types="location,layer" locationOrigins="zipcode,gg25,gazetteer">
          <input type="search" placeholder="${i18next.t('header_search_placeholder')}">
          <div class="ngm-search-icon-container ngm-search-icon"></div>
          <ul class="search-results"></ul>
        </ga-search>
        <div class="ngm-map-icon ${classMap({'ngm-map-active': this.showMinimap})}"
             @click=${() => this.showMinimap = !this.showMinimap}></div>
        <ngm-camera-information .viewer="${this.viewer}"></ngm-camera-information>
      </header>
      <main>
        <ngm-drop-files @filedrop="${event => this.onFileDrop(event.detail.file, event.detail.type)}"
                        .target="${document.body}"></ngm-drop-files>
        <ngm-loading-mask></ngm-loading-mask>
        <ngm-side-bar
          .queryManager=${this.queryManager}
          @layeradded=${this.onLayerAdded}
          @showLayerLegend=${this.onShowLayerLegend}>
        </ngm-side-bar>
        <div class='map'>
          <div id='cesium'>
            <ngm-slow-loading style='display: none;'></ngm-slow-loading>
            <ngm-object-information class="ngm-floating-window" ></ngm-object-information>
            <ngm-nav-tools class="ngm-floating-window" .scene=${this.viewer?.scene} .showCamConfig=${this.showCamConfig}
                           @togglecamconfig=${() => this.showCamConfig = !this.showCamConfig}>
            </ngm-nav-tools>
            <ngm-minimap class="ngm-floating-window" .viewer=${this.viewer} .hidden=${!this.showMinimap}
                         @close=${() => this.showMinimap = false}>
            </ngm-minimap>
            <ngm-cam-configuration class="ngm-floating-window"
                                   .hidden=${!this.showCamConfig}
                                   .viewer=${this.viewer}
                                   @close=${() => this.showCamConfig = false}>
            </ngm-cam-configuration>
            <ngm-layer-legend-container></ngm-layer-legend-container>
            <ngm-map-chooser class="ngm-bg-chooser-map" .initiallyOpened=${false}></ngm-map-chooser>
          </div>
          <ngm-tracking-consent @change=${this.onTrackingAllowedChanged}></ngm-tracking-consent>
        </div>
      </main>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
