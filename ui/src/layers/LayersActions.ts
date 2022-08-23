import {syncLayersParam} from '../permalink';
import {calculateBox, calculateRectangle, getBoxFromRectangle} from './helpers';
import {LayerType} from '../constants';
import {Cartesian3, Rectangle, Cartographic, Color} from 'cesium';
import type {Viewer, ImageryLayer} from 'cesium';
import type {Config} from './ngm-layers-item.js';


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

  async changeVisibility(config: Config, checked: boolean) {
    if (config.setVisibility) {
      config.setVisibility(checked);
    } else {
      this.viewer.dataSources.getByName((await config.promise)!.name)[0].show = checked;
    }
    config.visible = checked;
    this.viewer.scene.requestRender();
  }

  changeOpacity(config: Config, value: number) {
    config.setOpacity!(value);
    this.viewer.scene.requestRender();
  }

  async showBoundingBox(config: Config) {
    const p = await config.promise;
    if (p.boundingRectangle) { // earthquakes
      this.boundingBoxEntity.position = Cartographic.toCartesian(Rectangle.center(p.boundingRectangle));
      this.boundingBoxEntity.box.dimensions = getBoxFromRectangle(p.boundingRectangle, p.maximumHeight);
      this.boundingBoxEntity.rectangle.coordinates = p.boundingRectangle;
      this.boundingBoxEntity.show = true;
      this.viewer.scene.requestRender();
    } else if (p.root && p.root.boundingVolume) {
      const boundingVolume = p.root.boundingVolume.boundingVolume;
      const boundingRectangle = p.root.boundingVolume.rectangle;
      this.boundingBoxEntity.position = boundingVolume.center;
      if (boundingRectangle) {
        this.boundingBoxEntity.box.dimensions = getBoxFromRectangle(boundingRectangle, p.root.boundingVolume.maximumHeight);
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

  async reorderLayers(_: Config[], newLayers: Config[]) {
    const imageries = this.viewer.scene.imageryLayers;
    for (const config of newLayers) {
      if (config.type === LayerType.swisstopoWMTS) {
        const imagery: ImageryLayer = await config.promise;
        imageries.raiseToTop(imagery);
      }
    }
    syncLayersParam(newLayers);
  }


  listenForEvent(config: Config, eventName, callback) {
    const stuff = config.promise!; // yes, this is not a promise ! Why?
    if (stuff[eventName]) {
      console.debug('Adding event', eventName, 'on', config.layer);
      stuff[eventName].addEventListener(callback);
    }
  }
}
