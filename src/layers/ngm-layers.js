// @ts-check

import i18next from 'i18next';
import {syncLayersParam} from '../permalink.js';
import {createCesiumObject} from './helpers.js';
import {LAYER_TYPES} from '../constants.js';
import Cartesian3 from 'cesium/Core/Cartesian3';
import Matrix3 from 'cesium/Core/Matrix3';
import Color from 'cesium/Core/Color.js';
import {html, LitElement} from 'lit-element';
import {I18nMixin} from '../i18n.js';

import {classMap} from 'lit-html/directives/class-map';
import Rectangle from 'cesium/Core/Rectangle';
import Cartographic from 'cesium/Core/Cartographic';

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
      this.defaultBoxValue = {
        position: Cartesian3.ZERO,
        show: false,
        box: {
          material: Color.RED.withAlpha(0),
          dimensions: new Cartesian3(1, 1, 1),
          outline: true,
          outlineColor: Color.RED
        },
        rectangle: {
          material: Color.BLACK.withAlpha(0.3),
          coordinates: new Rectangle(0, 0, 0, 0)
        }
      };
      this.boundingBoxEntity = this.viewer.entities.add(this.defaultBoxValue);
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
      if (evt.target.checked && !config.displayed) {
        console.log('XXXX how is it possible?');
        if (config.type === LAYER_TYPES.swisstopoWMTS) config.add(0);
        config.displayed = true;
      }
      syncLayersParam(this.layers); // FIXME: these calls should be moved to left side bar or the app
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
      if (p.root && p.root.boundingVolume) {
        const b = p.root.boundingVolume.boundingVolume;
        this.boundingBoxEntity.position = b.center;
        // this.boundingBoxEntity.ellipsoid.radii = new Cartesian3(b.radius, b.radius, b.radius);
        const boundingRect = p.root.boundingVolume.rectangle;
        if (boundingRect) {
          const sw = Cartographic.toCartesian(Rectangle.southwest(boundingRect, new Cartographic()));
          const se = Cartographic.toCartesian(Rectangle.southeast(boundingRect, new Cartographic()));
          const nw = Cartographic.toCartesian(Rectangle.northwest(boundingRect, new Cartographic()));
          const x = Cartesian3.distance(sw, se);
          const y = Cartesian3.distance(sw, nw);

          this.boundingBoxEntity.box.dimensions = new Cartesian3(x, y, p.root.boundingVolume.maximumHeight);
          this.boundingBoxEntity.rectangle.coordinates = boundingRect;
        } else {
          const halfAxes = b.halfAxes;
          const absMatrix = Matrix3.abs(halfAxes, new Matrix3());
          const boxSize = Matrix3.multiplyByVector(absMatrix, new Cartesian3(2, 2.4, 2), new Cartesian3());
          this.boundingBoxEntity.box.dimensions = new Cartesian3(boxSize.y, boxSize.x, boxSize.z);

          const width = boxSize.y * 0.87; // TODO for some reason sizes for rect applies not the same as for box
          const height = boxSize.x * 1.25;

          const nw = new Cartesian3(b.center.x - height / 2, b.center.y - width / 2, b.center.z);
          const sw = new Cartesian3(nw.x + height, nw.y, b.center.z);
          const se = new Cartesian3(sw.x, sw.y + width, b.center.z);
          const ne = new Cartesian3(se.x - height, se.y, b.center.z);
          this.boundingBoxEntity.rectangle.coordinates = Rectangle.fromCartesianArray([sw, se, ne, nw]);
        }
        this.boundingBoxEntity.show = true;
        this.viewer.scene.requestRender();
      }
    };
    const mouseLeave = () => {
      if (this.boundingBoxEntity.show) {
        this.boundingBoxEntity.show = this.defaultBoxValue.show; // TODO
        this.boundingBoxEntity.rectangle = this.defaultBoxValue.rectangle;
        this.boundingBoxEntity.box = this.defaultBoxValue.box;
        this.boundingBoxEntity.position = this.defaultBoxValue.position;
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
            data-position="top center"
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
            data-position="top center"
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
