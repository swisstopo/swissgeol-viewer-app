// @ts-check

import {syncLayersParam} from '../permalink.js';
import {calculateRectangle, getBoxFromRectangle, calculateBox} from './helpers.js';
import {LAYER_TYPES} from '../constants.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import Color from 'cesium/Core/Color.js';


export default class LayersAction {

  constructor(viewer) {
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

  changeVisibility(config, checked) {
    config.setVisibility(checked);
    config.visible = checked;
    this.viewer.scene.requestRender();
  }

  changeOpacity(config, value) {
    const opacity = Number(value);
    config.setOpacity(opacity);
    config.opacity = opacity;
    this.viewer.scene.requestRender();
  }

  async mouseEnter(config) {
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

  mouseLeave() {
    if (this.boundingBoxEntity.show) {
      this.boundingBoxEntity.show = false;
      this.viewer.scene.requestRender();
    }
  }

  // changes layer position in 'Displayed Layers'
  moveLayer(layers, config, delta) {
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
    if (config.type === LAYER_TYPES.swisstopoWMTS && otherConfig.type === LAYER_TYPES.swisstopoWMTS) {
      const imageries = this.viewer.scene.imageryLayers;
      config.promise.then(i => {
        if (delta < 0) {
          imageries.lower(i);
        } else {
          imageries.raise(i);
        }
      });
    }

    syncLayersParam(layers);
  }
}
