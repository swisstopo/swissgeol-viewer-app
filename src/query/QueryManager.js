import ObjectSelector from './ObjectSelector';
import SwisstopoIdentify from './SwisstopoIdentify';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import i18next from 'i18next';


export default class QueryManager {
  constructor(viewer) {
    this.objectSelector = new ObjectSelector(viewer);
    this.swisstopoIndentify = new SwisstopoIdentify();
    this.scene = viewer.scene;
    viewer.screenSpaceEventHandler.setInputAction(click => this.onclick(click), ScreenSpaceEventType.LEFT_CLICK);
  }

  set activeLayers(names) {
    this.searchableLayers = names;
  }

  async querySwisstopo(pickedPosition, layers) {
    const lang = i18next.language;
    const identifyData = await this.swisstopoIndentify.identify(pickedPosition, layers, lang);
    if (identifyData) {
      const d = identifyData;
      const {layerBodId, featureId} = identifyData;
      let popupContent = await this.swisstopoIndentify.getPopupForFeature(layerBodId, featureId, lang);
      if (popupContent) {
        popupContent = popupContent.replace(/cell-left/g, 'key')
        .replace(/<td>/g, '<td class="value">')
        .replace(/<table>/g, '<table class="ui compact small very basic table">');
      }
      const onshow = () => {
        console.log('showing', d.geometry);
      };
      const onhide = () => {
        console.log('hiding', d.geometry);
      };
      return {
        popupContent,
        onhide,
        onshow
      };
    }
  }

  async onclick(click) {
    const pickedPosition = this.scene.pickPosition(click.position);
    let attributes = this.objectSelector.pickAttributes(click.position, pickedPosition);

    const layers = 'ch.swisstopo.geologie-geocover';
    // we only search the remote Swisstopo service when there was no result for the local search
    // and the geocover layer is enabled
    if (!attributes && this.searchableLayers.includes(layers)) {
      const result = await this.querySwisstopo(pickedPosition, layers);
      attributes = result || attributes;
    }

    const objectInfo = document.querySelector('ngm-object-information');
    objectInfo.info = attributes;
    objectInfo.opened = !!attributes;

    this.scene.requestRender();
  }
}
