// @ts-check

import i18next from 'i18next';
import {syncLayersParam} from '../permalink.js';
import {createCesiumObject, calculateRectangle, getCartesianBoxSize} from './helpers.js';
import {LAYER_TYPES} from '../constants.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Matrix3 from 'cesium/Core/Matrix3.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartographic from 'cesium/Core/Cartographic.js';
import Color from 'cesium/Core/Color.js';
import {html, LitElement} from 'lit-element';
import {I18nMixin} from '../i18n.js';

import {classMap} from 'lit-html/directives/class-map';

export default class LayerTree extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      layers: {type: Object},
    };
  }

  createRenderRoot() {
    return this;
  }

  updated() {
    if (this.viewer && !this.boundingBoxEntity) {
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
  }


  // builds html container for layer
  getLayerRender(config, idx) {
    if (!config.promise) {
      config.promise = createCesiumObject(this.viewer, config);
    }
    const changeVisibility = evt => {
      config.setVisibility(evt.target.checked);
      config.visible = evt.target.checked;
      syncLayersParam(this.layers); // FIXME: these calls should be moved to left side bar or the app
      this.dispatchEvent(new CustomEvent('layerChanged'));
      this.viewer.scene.requestRender();
    };

    const changeOpacity = evt => {
      const opacity = Number(evt.target.value);
      config.setOpacity(opacity);
      config.opacity = opacity;
      syncLayersParam(this.layers);
      this.viewer.scene.requestRender();
    };


    const mouseEnter = async () => {
      const p = await config.promise;
      if (p.boundingRectangle) { // earthquakes
        const {x, y} = getCartesianBoxSize(p.boundingRectangle);
        this.boundingBoxEntity.position = Cartographic.toCartesian(Rectangle.center(p.boundingRectangle));
        this.boundingBoxEntity.box.dimensions = new Cartesian3(x, y, p.maximumHeight);
        this.boundingBoxEntity.rectangle.coordinates = p.boundingRectangle;
        this.boundingBoxEntity.show = true;
        this.viewer.scene.requestRender();
      } else if (p.root && p.root.boundingVolume) {
        const boundingVolume = p.root.boundingVolume.boundingVolume;
        const boundingRectangle = p.root.boundingVolume.rectangle;
        const boundingSphere = p.root.boundingVolume.boundingSphere;
        this.boundingBoxEntity.position = boundingVolume.center;
        if (boundingRectangle) {
          const {x, y} = getCartesianBoxSize(boundingRectangle);
          this.boundingBoxEntity.box.dimensions = new Cartesian3(x, y, p.root.boundingVolume.maximumHeight);
          this.boundingBoxEntity.rectangle.coordinates = boundingRectangle;
        } else {
          // get box sizes from boundingVolume
          const absMatrix = Matrix3.abs(boundingVolume.halfAxes, new Matrix3());
          const boxSize = new Cartesian3();
          for (let i = 0; i < 3; i++) {
            const column = Matrix3.getColumn(absMatrix, i, new Cartesian3());
            const row = Matrix3.getRow(absMatrix, i, new Cartesian3());
            boxSize.y = boxSize.y + column.x + row.x;
            boxSize.x = boxSize.x + column.y + row.y;
            boxSize.z = boxSize.z + column.z + row.z;
          }
          //calculate rectangle extent according to boundingSphere
          const diagonal = Math.sqrt(boxSize.x * boxSize.x + boxSize.y * boxSize.y);
          const radius = boundingSphere.radius;
          const scale = Math.max(diagonal / (radius * 2), (radius * 2) / diagonal);
          boxSize.x = boxSize.x * scale;
          boxSize.y = boxSize.y * scale;
          boxSize.z = boxSize.z > 60000 ? 60000 : boxSize.z;
          this.boundingBoxEntity.box.dimensions = boxSize;
          this.boundingBoxEntity.rectangle.coordinates = calculateRectangle(boxSize.x, boxSize.y, boundingVolume.center);
        }
        this.boundingBoxEntity.show = true;
        this.viewer.scene.requestRender();
      }
    };


    const mouseLeave = () => {
      if (this.boundingBoxEntity.show) {
        this.boundingBoxEntity.show = false;
        this.viewer.scene.requestRender();
      }
    };

    const upClassMap = {disabled: idx === 0};
    const downClassMap = {disabled: (idx === this.layers.length - 1)};

    return html`
      <div class="ngm-displayed-container"
        @mouseenter=${mouseEnter}
        @mouseleave=${mouseLeave}>
        <div class="ui checkbox">
          <input class="ngm-layer-checkbox" type="checkbox"
                 .checked=${config.visible} @change=${changeVisibility}>
          <label @click=${evt => {
      const input = evt.target.previousElementSibling;
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change'));
    }}>${i18next.t(config.label)}</label>
        </div>
        <div class="ui icon buttons compact mini">
            <button class="ui button"
            data-tooltip=${i18next.t('zoom_to')}
            data-position="top left"
            data-variation="mini"
            @click=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}>
              <i class="search plus icon"></i>
            </button>
            <button class="ui button ${classMap(upClassMap)}"
            data-tooltip=${i18next.t('layer_up')}
            data-position="top center"
            data-variation="mini"
            @click=${this.moveLayer.bind(this, config, -1)}>
              <i class="angle up icon"></i>
            </button>
            <button class="ui button ${classMap(downClassMap)}"
            data-tooltip=${i18next.t('layer_down')}
            data-position="top center"
            data-variation="mini"
            @click=${this.moveLayer.bind(this, config, +1)}>
              <i class="angle down icon"></i>
            </button>
            <button class="ui button"
            data-tooltip=${i18next.t('remove_btn_tooltip')}
            data-position="top right"
            data-variation="mini"
            @click=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {
      detail: {
        config,
        idx
      }
    }))}>
          <i class="icon trash alternate outline"></i>
        </button>
        </div>
    </div>
    <div class="ngm-displayed-container" ?hidden=${!config.setOpacity}>
      <label>${i18next.t('opacity_label')}: </label>
      <input type="range" min="0" max="1" .value=${config.opacity || 1} @input=${changeOpacity} step="0.05">
    </div>
    `;
  }

  // builds ui structure of layertree and makes render
  render() {
    return html`${this.layers.map((l, idx) => this.getLayerRender(l, idx))}`;
  }

  // changes layer position in 'Displayed Layers'
  moveLayer(config, delta) {
    console.assert(delta === -1 || delta === 1);
    const previousIndex = this.layers.indexOf(config);
    const toIndex = previousIndex + delta;
    if (toIndex < 0 || toIndex > this.layers.length - 1) {
      // should not happen with proper UI
      return;
    }

    // Swap values
    const otherConfig = this.layers[toIndex];
    this.layers[toIndex] = this.layers[previousIndex];
    this.layers[previousIndex] = otherConfig;

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

    syncLayersParam(this.layers);
    this.requestUpdate();
  }
}

customElements.define('ngm-layers', LayerTree);
