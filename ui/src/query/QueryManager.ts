import ObjectSelector from './ObjectSelector';
import SwisstopoIdentify from './SwisstopoIdentify';
import { Cartesian2, CustomDataSource, Scene, Viewer } from 'cesium';
import {
  Cartesian3,
  Cartographic,
  Color,
  Entity,
  HeightReference,
  ScreenSpaceEventType,
} from 'cesium';
import i18next from 'i18next';
import {
  OBJECT_HIGHLIGHT_COLOR,
  SWISSTOPO_IT_HIGHLIGHT_COLOR,
} from '../constants';
import { lv95ToDegrees } from '../projection';
import DrawStore from '../store/draw';
import QueryStore from '../store/query';
import ToolboxStore from '../store/toolbox';
import NavToolsStore from '../store/navTools';
import type { PopupItem, QueryResult } from './types';

export default class QueryManager {
  objectSelector: ObjectSelector;
  swisstopoIdentify = new SwisstopoIdentify();
  viewer: Viewer;
  scene: Scene;
  enabled = true;
  highlightedEntity: Entity | undefined;
  highlightedGroup: CustomDataSource = new CustomDataSource(
    'highlightedLayerAreas',
  );
  searchableLayers: any[] = []; // todo type

  constructor(viewer) {
    this.objectSelector = new ObjectSelector(viewer);
    this.viewer = viewer;
    this.scene = viewer.scene;
    viewer.screenSpaceEventHandler.setInputAction(
      (click) => this.onclick(click),
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.viewer.dataSources.add(this.highlightedGroup);
  }

  set activeLayers(layers) {
    this.searchableLayers = layers;
  }

  async querySwisstopo(
    pickedPosition,
    layers,
  ): Promise<QueryResult | undefined> {
    const lang = i18next.language;
    const distance = Cartesian3.distance(
      this.scene.camera.positionWC,
      pickedPosition,
    );
    // layer list is reversed to match the display order on map
    const identifyResults = await this.swisstopoIdentify.identify(
      pickedPosition,
      distance,
      layers.slice().reverse(),
      lang,
    );
    if (!identifyResults.length) return undefined;
    const results: PopupItem[] = await Promise.all(
      identifyResults.map(async (r) => {
        const popupContent = await this.swisstopoIdentify.getPopupForFeature(
          r.layerBodId,
          r.featureId,
          lang,
        );
        return {
          content:
            popupContent &&
            popupContent
              .replace(/cell-left/g, 'key')
              .replace(/<td>/g, '<td class="value">')
              .replace(
                /<table>/g,
                '<table class="ui compact small very basic table">',
              ),
          mouseEnter: () => {
            this.highlightSelectedArea(r.geometry);
          },
          mouseLeave: () => {
            this.unhighlightEntity();
          },
          zoom: () => {
            if (!this.highlightedEntity) return;
            NavToolsStore.hideTargetPoint();
            this.viewer.zoomTo(this.highlightedEntity);
          },
        };
      }),
    );

    const onshow = () => {
      const geometries = identifyResults.map((r) => r.geometry);
      this.highlightGroup(geometries);
    };
    const onhide = () => {
      this.unhighlightGroup();
    };
    return {
      popupItems: results,
      onshow,
      onhide,
    };
  }

  async onclick(click) {
    this.unhighlightGroup();
    if (
      !this.enabled ||
      DrawStore.drawStateValue ||
      DrawStore.measureState.value
    ) {
      this.hideObjectInformation();
      return;
    }
    await this.pickObject(click.position);
  }

  async pickObject(position: Cartesian2) {
    const pickedPosition = this.scene.pickPosition(position);
    const object = this.objectSelector.getObjectAtPosition(position);
    let attributes = this.objectSelector.pickAttributes(
      position,
      pickedPosition,
      object,
    );
    const attributesEmpty =
      !attributes || !Object.getOwnPropertyNames(attributes).length;

    // we only search the remote Swisstopo service when there was no result for the local search.
    if (attributesEmpty && pickedPosition) {
      if (object) {
        // the clicked object was not pickable, stop here
        return;
      }

      // find all queryable swisstopo layers
      const layers = this.searchableLayers
        .filter((config) => config.queryType === 'geoadmin')
        .map((config) => config.layer);
      if (layers.length > 0) {
        const result = await this.querySwisstopo(pickedPosition, layers);
        attributes = result || attributes;
      }
    }

    if (attributes?.geomId) {
      ToolboxStore.setOpenedGeometryOptions({ id: attributes.geomId });
      return;
    }

    this.showObjectInformation(attributes);

    this.scene.requestRender();
  }

  highlightSelectedArea(geometry, group = false) {
    if (!group) this.unhighlightEntity();
    if (!geometry) return;
    const coordinates = geometry.coordinates;
    switch (geometry.type) {
      case 'MultiPolygon':
      case 'Polygon':
        this.highlightPolygon(coordinates, group);
        break;
      case 'MultiLineString':
        this.highlightLine(coordinates, group);
        break;
      case 'MultiPoint':
        this.highlightPoint(coordinates, group);
        break;
      default:
        console.error(`Geometry "${geometry.type}" not handled`);
    }
    this.scene.requestRender();
  }

  highlightGroup(geometries: { type: string; coordinates: number[] }[]) {
    this.unhighlightGroup();
    geometries.forEach((g) => this.highlightSelectedArea(g, true));
  }

  highlightPolygon(coordinates, group = false) {
    coordinates = coordinates[0];
    if (!coordinates.length) return;
    let entity;
    const createPolygon = (coords) => {
      const convertedCoords = coords.map((c) => {
        const degCoords = lv95ToDegrees(c);
        return Cartesian3.fromDegrees(degCoords[0], degCoords[1]);
      });
      return new Entity({
        polygon: {
          hierarchy: convertedCoords,
          material: group
            ? OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7)
            : SWISSTOPO_IT_HIGHLIGHT_COLOR,
        },
      });
    };
    if (typeof coordinates[0][0] === 'number') {
      //for polygon
      entity = createPolygon(coordinates);
    } else {
      //for multipolygon
      entity = new Entity();
      coordinates.forEach((coords) => {
        entity.merge(createPolygon(coords));
      });
    }
    this.highlightedGroup.entities.add(entity);
    if (!group) this.highlightedEntity = entity;
    this.viewer.render();
  }

  highlightLine(coordinates, group = false) {
    const convertedCoords = coordinates[0].map((c) => {
      const degCoords = lv95ToDegrees(c);
      return Cartesian3.fromDegrees(degCoords[0], degCoords[1]);
    });
    const entity = new Entity({
      polyline: {
        positions: convertedCoords,
        material: group ? OBJECT_HIGHLIGHT_COLOR : SWISSTOPO_IT_HIGHLIGHT_COLOR,
        clampToGround: true,
        width: 4,
      },
    });
    this.highlightedGroup.entities.add(entity);
    if (!group) this.highlightedEntity = entity;
    this.viewer.render();
  }

  highlightPoint(coordinates, group = false) {
    const degCoords = lv95ToDegrees(coordinates[0]);
    const convertedCoords = Cartesian3.fromDegrees(degCoords[0], degCoords[1]);
    const entity = new Entity({
      position: convertedCoords,
      point: {
        color: group
          ? OBJECT_HIGHLIGHT_COLOR.withAlpha(0.7)
          : SWISSTOPO_IT_HIGHLIGHT_COLOR,
        pixelSize: 10,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        outlineWidth: group ? 1 : 2,
        outlineColor: Color.BLACK,
      },
    });
    this.highlightedGroup.entities.add(entity);
    if (!group) this.highlightedEntity = entity;
    this.viewer.render();
  }

  unhighlightGroup() {
    this.highlightedGroup.entities.removeAll();
    this.scene.requestRender();
  }

  unhighlightEntity() {
    if (!this.highlightedEntity) return;
    this.highlightedGroup.entities.remove(this.highlightedEntity);
    this.highlightedEntity = undefined;
    this.scene.requestRender();
  }

  async selectTile(feature) {
    const x = getProperty(feature, /\w*XCOORD/);
    const y = getProperty(feature, /\w*YCOORD/);
    const z = getProperty(feature, /\w*ZCOORDB/);
    if (!x || !y || !z) return; // boreholes only solution for now
    const coords = lv95ToDegrees([x, y]);
    const cartographicCoords = Cartographic.fromDegrees(
      coords[0],
      coords[1],
      z,
    );
    const position = Cartographic.toCartesian(cartographicCoords);
    const attributes = this.objectSelector.pickAttributes(
      Cartesian2.ZERO,
      position,
      feature,
    );

    this.showObjectInformation(attributes);
    if (attributes?.zoom) attributes.zoom();

    this.scene.requestRender();
  }

  showObjectInformation(attributes) {
    QueryStore.setObjectInfo(attributes);
  }

  hideObjectInformation() {
    QueryStore.setObjectInfo(undefined);
  }
}

function getProperty(feature, pattern) {
  const key = feature.getPropertyIds().find((value) => pattern.test(value));
  if (key) {
    return feature.getProperty(key);
  }
}
