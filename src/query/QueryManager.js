import ObjectSelector from './ObjectSelector';
import SwisstopoIdentify from './SwisstopoIdentify';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import i18next from 'i18next';
import {OBJECT_HIGHLIGHT_COLOR} from '../constants';
import {lv95ToDegrees} from '../projection.js';
import Entity from 'cesium/Source/DataSources/Entity';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';


export default class QueryManager {
  constructor(viewer) {
    this.objectSelector = new ObjectSelector(viewer);
    this.swisstopoIndentify = new SwisstopoIdentify();
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.enabled = true;
    this.highlightEntity = null;
    viewer.screenSpaceEventHandler.setInputAction(click => this.onclick(click), ScreenSpaceEventType.LEFT_CLICK);
    document.querySelector('ngm-object-information')
      .addEventListener('closed', () => this.unhiglight());
  }

  set activeLayers(names) {
    this.searchableLayers = names;
  }

  async querySwisstopo(pickedPosition, layers) {
    const lang = i18next.language;
    const identifyData = await this.swisstopoIndentify.identify(pickedPosition, layers, lang);
    if (identifyData) {
      const {layerBodId, featureId} = identifyData;
      let popupContent = await this.swisstopoIndentify.getPopupForFeature(layerBodId, featureId, lang);
      if (popupContent) {
        this.highlightSelectedArea(identifyData.geometry);
        popupContent = popupContent.replace(/cell-left/g, 'key')
          .replace(/<td>/g, '<td class="value">')
          .replace(/<table>/g, '<table class="ui compact small very basic table">');
      }

      return {
        popupContent,
      };
    }
  }

  async onclick(click) {
    if (!this.enabled) {
      const objectInfo = document.querySelector('ngm-object-information');
      objectInfo.info = null;
      objectInfo.opened = false;
      return;
    }
    const pickedPosition = this.scene.pickPosition(click.position);
    let attributes = this.objectSelector.pickAttributes(click.position, pickedPosition);

    const layers = 'ch.swisstopo.geologie-geocover';
    // we only search the remote Swisstopo service when there was no result for the local search
    // and the geocover layer is enabled
    if (!attributes && pickedPosition && this.searchableLayers.includes(layers)) {
      const result = await this.querySwisstopo(pickedPosition, layers);
      attributes = result || attributes;
    }

    const objectInfo = document.querySelector('ngm-object-information');
    objectInfo.info = attributes;
    objectInfo.opened = !!attributes;

    this.scene.requestRender();
  }

  highlightSelectedArea(geometry) {
    this.unhiglight();
    if (!geometry) return;
    const coordinates = geometry.coordinates;
    if (geometry.type === 'MultiPolygon') {
      const entity = new Entity();
      coordinates[0].forEach(coords => {
        const convertedCoords = coords.map(c => {
          const degCoords = lv95ToDegrees(c);
          return Cartesian3.fromDegrees(degCoords[0], degCoords[1]);
        });

        const ent = new Entity({
          polygon: {
            hierarchy: convertedCoords,
            material: OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7)
          }
        });
        entity.merge(ent);
      });
      this.viewer.entities.add(entity);
      this.highlightEntity = entity;
    } else if (geometry.type === 'MultiLineString') {
      const convertedCoords = coordinates[0].map(c => {
        const degCoords = lv95ToDegrees(c);
        return Cartesian3.fromDegrees(degCoords[0], degCoords[1]);

      });
      this.highlightEntity = this.viewer.entities.add({
        polyline: {
          positions: convertedCoords,
          material: OBJECT_HIGHLIGHT_COLOR
        }
      });
    }
    this.scene.requestRender();
  }

  unhiglight() {
    if (this.highlightEntity) {
      this.viewer.entities.remove(this.highlightEntity);
      this.highlightEntity = null;
      this.scene.requestRender();
    }
  }
}
