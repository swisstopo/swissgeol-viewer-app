import ObjectSelector from './ObjectSelector';
import SwisstopoIdentify from './SwisstopoIdentify';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import i18next from 'i18next';
import {OBJECT_HIGHLIGHT_COLOR} from '../constants';
import {lv95ToDegrees} from '../projection.js';
import Entity from 'cesium/Source/DataSources/Entity';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import HeightReference from 'cesium/Source/Scene/HeightReference';


export default class QueryManager {
  constructor(viewer) {
    this.objectSelector = new ObjectSelector(viewer);
    this.swisstopoIndentify = new SwisstopoIdentify();
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.enabled = true;
    this.highlightEntity = null;
    viewer.screenSpaceEventHandler.setInputAction(click => this.onclick(click), ScreenSpaceEventType.LEFT_CLICK);
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
        popupContent = popupContent.replace(/cell-left/g, 'key')
          .replace(/<td>/g, '<td class="value">')
          .replace(/<table>/g, '<table class="ui compact small very basic table">');
      }

      const onshow = () => {
        this.highlightSelectedArea(identifyData.geometry);
      };
      const onhide = () => {
        this.unhighlight();
      };

      const zoom = () => {
        if (!this.highlightEntity) return;
        this.viewer.zoomTo(this.highlightEntity);
      };

      return {
        popupContent,
        onshow,
        onhide,
        zoom
      };
    }
  }

  async onclick(click) {
    this.unhighlight();
    const toolboxElement = document.querySelector('ngm-aoi-drawer');
    toolboxElement.deselectArea();
    if (!this.enabled || toolboxElement.drawState) {
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
    this.unhighlight();
    if (!geometry) return;
    const coordinates = geometry.coordinates;
    switch (geometry.type) {
      case 'MultiPolygon':
        this.highlightPolygon(coordinates);
        break;
      case 'MultiLineString':
        this.highlightLine(coordinates);
        break;
      case 'MultiPoint':
        this.highlightPoint(coordinates);
        break;
      default:
        console.error(`Geometry "${geometry.type}" not handled`);
    }
    this.scene.requestRender();
  }

  highlightPolygon(coordinates) {
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
  }

  highlightLine(coordinates) {
    const convertedCoords = coordinates[0].map(c => {
      const degCoords = lv95ToDegrees(c);
      return Cartesian3.fromDegrees(degCoords[0], degCoords[1]);

    });
    this.highlightEntity = this.viewer.entities.add({
      polyline: {
        positions: convertedCoords,
        material: OBJECT_HIGHLIGHT_COLOR,
        clampToGround: true,
        width: 4
      }
    });
  }

  highlightPoint(coordinates) {
    const degCoords = lv95ToDegrees(coordinates[0]);
    const convertedCoords = Cartesian3.fromDegrees(degCoords[0], degCoords[1]);
    this.highlightEntity = this.viewer.entities.add({
      position: convertedCoords,
      point: {
        color: OBJECT_HIGHLIGHT_COLOR,
        pixelSize: 6,
        heightReference: HeightReference.CLAMP_TO_GROUND
      }
    });
  }

  unhighlight() {
    if (this.highlightEntity) {
      this.viewer.entities.remove(this.highlightEntity);
      this.highlightEntity = null;
      this.scene.requestRender();
    }
  }
}
