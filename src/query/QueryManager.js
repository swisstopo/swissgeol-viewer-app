import ObjectSelector from './ObjectSelector';
import SwisstopoIdentify from './SwisstopoIdentify';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import i18next from 'i18next';
import {OBJECT_HIGHLIGHT_COLOR} from '../constants';
import {lv95ToDegrees} from '../projection.js';
import Entity from 'cesium/Source/DataSources/Entity';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import DrawStore from '../store/draw';
import QueryStore from '../store/query';


export default class QueryManager {
  constructor(viewer) {
    this.objectSelector = new ObjectSelector(viewer);
    this.swisstopoIdentify = new SwisstopoIdentify();
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.enabled = true;
    this.highlightEntity = null;
    viewer.screenSpaceEventHandler.setInputAction(click => this.onclick(click), ScreenSpaceEventType.LEFT_CLICK);
  }

  set activeLayers(layers) {
    this.searchableLayers = layers;
  }

  async querySwisstopo(pickedPosition, layers) {
    const lang = i18next.language;
    const distance = Cartesian3.distance(this.scene.camera.position, pickedPosition);
    // layer list is reversed to match the display order on map
    const identifyResult = await this.swisstopoIdentify.identify(pickedPosition, distance, layers.slice().reverse(), lang);
    if (identifyResult) {
      let popupContent = await this.swisstopoIdentify.getPopupForFeature(identifyResult.layerBodId, identifyResult.featureId, lang);
      if (popupContent) {
        popupContent = popupContent.replace(/cell-left/g, 'key')
          .replace(/<td>/g, '<td class="value">')
          .replace(/<table>/g, '<table class="ui compact small very basic table">');
      }

      const onshow = () => {
        this.highlightSelectedArea(identifyResult.geometry);
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
    if (!this.enabled || DrawStore.drawStateValue) {
      this.hideObjectInformation();
      return;
    }
    await this.pickObject(click.position);
  }

  async pickObject(position) {
    const pickedPosition = this.scene.pickPosition(position);
    let attributes = this.objectSelector.pickAttributes(position, pickedPosition);
    const attributesEmpty = !attributes || !Object.getOwnPropertyNames(attributes).length;

    // we only search the remote Swisstopo service when there was no result for the local search.
    if (attributesEmpty && pickedPosition) {
      // find all queryable swisstopo layers
      const layers = this.searchableLayers.filter(config => config.queryType === 'geoadmin').map(config => config.layer);
      if (layers.length > 0) {
        const result = await this.querySwisstopo(pickedPosition, layers);
        attributes = result || attributes;
      }
    }

    this.showObjectInformation(attributes);

    this.scene.requestRender();
  }

  highlightSelectedArea(geometry) {
    this.unhighlight();
    if (!geometry) return;
    const coordinates = geometry.coordinates;
    switch (geometry.type) {
      case 'MultiPolygon':
      case 'Polygon':
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
    coordinates = coordinates[0];
    if (!coordinates.length) return;
    let entity;
    const createPolygon = (coords) => {
      const convertedCoords = coords.map(c => {
        const degCoords = lv95ToDegrees(c);
        return Cartesian3.fromDegrees(degCoords[0], degCoords[1]);
      });
      return new Entity({
        polygon: {
          hierarchy: convertedCoords,
          material: OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7)
        }
      });
    };
    if (typeof coordinates[0][0] === 'number') {
      //for polygon
      entity = createPolygon(coordinates);
    } else {
      //for multipolygon
      entity = new Entity();
      coordinates.forEach(coords => {
        entity.merge(createPolygon(coords));
      });
    }
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

  async selectTile(feature) {
    const x = getProperty(feature, /\w*XCOORD/);
    const y = getProperty(feature, /\w*YCOORD/);
    const z = getProperty(feature, /\w*ZCOORDB/);
    if (!x || !y || !z) return; // boreholes only solution for now
    const coords = lv95ToDegrees([x, y]);
    const cartographicCoords = Cartographic.fromDegrees(coords[0], coords[1], z);
    const position = Cartographic.toCartesian(cartographicCoords);
    const attributes = this.objectSelector.pickAttributes(null, position, feature);

    this.showObjectInformation(attributes);
    attributes.zoom();

    this.scene.requestRender();
  }

  showObjectInformation(attributes) {
    QueryStore.setObjectInfo(attributes);
  }

  hideObjectInformation() {
    QueryStore.setObjectInfo(null);
  }
}

function getProperty(feature, pattern) {
  const key = feature.getPropertyNames().find(value => pattern.test(value));
  if (key) {
    return feature.getProperty(key);
  }
}
