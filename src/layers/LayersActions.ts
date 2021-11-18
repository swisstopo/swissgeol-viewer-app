import {syncLayersParam} from '../permalink';
import {calculateBox, calculateRectangle, getBoxFromRectangle} from './helpers';
import {LayerType} from '../constants';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Rectangle from 'cesium/Source/Core/Rectangle';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Color from 'cesium/Source/Core/Color';
import Viewer from 'cesium/Source/Widgets/Viewer/Viewer';
import {ImageryLayer} from 'cesium';
import {Config} from './ngm-layers-item.js';


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

  changeVisibility(config: Config, checked: boolean) {
    config.setVisibility(checked);
    config.visible = checked;
    this.viewer.scene.requestRender();
  }

  changeOpacity(config: Config, value: number) {
    config.setOpacity(value);
    config.opacity = value;
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

  // changes layer position in 'Displayed Layers'
  moveLayer(layers, config: Config, delta: number) {
    console.assert(delta === -1 || delta === 1);
    const previousIndex = layers.indexOf(config);
    const toIndex = previousIndex + delta;
    if (toIndex < 0 || toIndex > layers.length - 1) {
      // should not happen with proper UI
      return;
    }

    // Swap values
    const otherConfig = layers[toIndex];
    layers[toIndex] = layers[previousIndex];
    layers[previousIndex] = otherConfig;

    // FIXME: this is nonsensical, all imageries should be handled
    // permute imageries order
    if (config.type === LayerType.swisstopoWMTS && otherConfig.type === LayerType.swisstopoWMTS) {
      const imageries = this.viewer.scene.imageryLayers;
      config.promise.then((i: ImageryLayer) => {
        if (delta < 0) {
          imageries.lower(i);
        } else {
          imageries.raise(i);
        }
      });
    }

    syncLayersParam(layers);
  }


  listenForEvent(config: Config, eventName, callback) {
    const stuff = config.promise; // yes, this is not a promise !
    if (stuff[eventName]) {
      console.debug('Adding event', eventName, 'on', config.layer);
      stuff[eventName].addEventListener(callback);
    }
  }
}
