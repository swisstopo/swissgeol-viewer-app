import {syncLayersParam} from '../permalink';
import {calculateBox, calculateRectangle, getBoxFromRectangle} from './helpers';
import {LayerType} from '../constants';
import {
  Cartesian3,
  Rectangle,
  Cartographic,
  Color,
  Cesium3DTileset,
  ImageryLayer,
  CustomDataSource,
  GeoJsonDataSource
} from 'cesium';
import type {Viewer} from 'cesium';

import {LayerConfig} from '../layertree';
import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer';


export default class LayersAction {
  viewer: Viewer;
  boundingBoxEntity: any;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.boundingBoxEntity = this.viewer.entities.add({
      position: Cartesian3.ZERO,
      show: false,
      box: {
        fill: false,
        dimensions: new Cartesian3(1, 1, 1),
        outline: true,
        outlineColor: Color.RED
      },
      rectangle: {
        material: Color.RED.withAlpha(0.3),
        coordinates: new Rectangle(0, 0, 0, 0)
      }
    });
  }

  async changeVisibility(config: LayerConfig, checked: boolean) {
    if (config.setVisibility) {
      config.setVisibility(checked);
    } else {
      const layer = await config.promise;
      if (layer instanceof CustomDataSource || layer instanceof GeoJsonDataSource) {
        this.viewer.dataSources.getByName(layer.name)[0].show = checked;
      }
    }
    config.visible = checked;
    this.viewer.scene.requestRender();
  }

  changeOpacity(config: LayerConfig, value: number) {
    config.setOpacity!(value);
    this.viewer.scene.requestRender();
  }

  async showBoundingBox(config: LayerConfig) {
    const p = await config.promise;
    // wrong type in cesium;
    const rootBoundingVolume = (<any> p)?.root?.boundingVolume;
    if (p instanceof EarthquakeVisualizer && p.boundingRectangle) { // earthquakes
      this.boundingBoxEntity.position = Cartographic.toCartesian(Rectangle.center(p.boundingRectangle));
      this.boundingBoxEntity.box.dimensions = getBoxFromRectangle(p.boundingRectangle, p.maximumHeight);
      this.boundingBoxEntity.rectangle.coordinates = p.boundingRectangle;
      this.boundingBoxEntity.show = true;
      this.viewer.scene.requestRender();
    } else if ((p instanceof Cesium3DTileset) && rootBoundingVolume) {
      const boundingVolume = rootBoundingVolume.boundingVolume;
      const boundingRectangle = rootBoundingVolume.rectangle;
      this.boundingBoxEntity.position = boundingVolume.center;
      if (boundingRectangle) {
        this.boundingBoxEntity.box.dimensions = getBoxFromRectangle(boundingRectangle, rootBoundingVolume.maximumHeight);
        this.boundingBoxEntity.rectangle.coordinates = boundingRectangle;
      } else {
        const boxSize = calculateBox(boundingVolume.halfAxes, p.root.boundingSphere.radius);
        this.boundingBoxEntity.box.dimensions = boxSize;
        this.boundingBoxEntity.rectangle.coordinates = calculateRectangle(boxSize.x, boxSize.y, boundingVolume.center);
      }
      this.boundingBoxEntity.show = true;
      this.viewer.scene.requestRender();
    }
  }

  hideBoundingBox() {
    if (this.boundingBoxEntity.show) {
      this.boundingBoxEntity.show = false;
      this.viewer.scene.requestRender();
    }
  }

  async reorderLayers(newLayers: LayerConfig[]) {
    const imageries = this.viewer.scene.imageryLayers;
    const dataSources = this.viewer.dataSources;
    for (const config of newLayers) {
      const layer = await config.promise;
      if (config.type === LayerType.swisstopoWMTS && layer instanceof ImageryLayer) {
        imageries.raiseToTop(layer);
      } else if (layer instanceof CustomDataSource && dataSources.contains(layer)) {
        dataSources.raiseToTop(layer);
      }
    }
    syncLayersParam(newLayers);
  }


  listenForEvent(config: LayerConfig, eventName, callback) {
    const stuff = config.promise!; // yes, this is not a promise ! Why?
    if (stuff[eventName]) {
      console.debug('Adding event', eventName, 'on', config.layer);
      stuff[eventName].addEventListener(callback);
    }
  }
}
