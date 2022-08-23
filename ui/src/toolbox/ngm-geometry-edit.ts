import {LitElementI18n} from '../i18n';
import {customElement, property, query, state} from 'lit/decorators.js';
import {html} from 'lit';
import type {ConstantProperty, Event, Viewer} from 'cesium';
import {Entity, PropertyBag, Math as CesiumMath, JulianDate} from 'cesium';
import i18next from 'i18next';
import MainStore from '../store/main';
import {getAreaProperties, hideVolume, updateEntityVolume, updateVolumePositions} from './helpers';
import {getEntityColor, getValueOrUndefined} from '../cesiumutils';
import ToolboxStore from '../store/toolbox';
import DrawStore from '../store/draw';
import type {CesiumDraw} from '../draw/CesiumDraw';
import {COLORS_WITH_BLACK_TICK, GEOMETRY_COLORS, POINT_SYMBOLS} from '../constants';
import {classMap} from 'lit-html/directives/class-map.js';
import {styleMap} from 'lit/directives/style-map.js';
import './ngm-point-edit';

@customElement('ngm-geometry-edit')
export class NgmGeometryEdit extends LitElementI18n {
  @property({type: Object}) entity: Entity | undefined;
  @query('.ngm-lower-limit-input') lowerLimitInput;
  @query('.ngm-height-input') heightInput;
  @state() selectedColor = '';
  @state() selectedSymbol = '';
  @state() name = '';
  private editingEntity: Entity | undefined;
  private viewer: Viewer | null | undefined;
  private minVolumeHeight = 1;
  private maxVolumeHeight = 30000;
  private minVolumeLowerLimit = -30000;
  private maxVolumeLowerLimit = 30000;
  private julianDate = new JulianDate();
  private draw: CesiumDraw | undefined;
  private unsubscribeFromChanges: Event.RemoveCallback | undefined;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  update(changedProps) {
    if (this.entity && !this.editingEntity) {
      this.editingEntity = new Entity({properties: new PropertyBag()});
      // deep clone entity and props
      this.editingEntity.properties!.merge(this.entity.properties);
      this.editingEntity.merge(this.entity);
      this.viewer!.entities.add(this.editingEntity);
      this.editingEntity.show = true;
      this.entity.show = false;
      this.selectedColor = getEntityColor(this.editingEntity).withAlpha(1).toCssColorString();
      this.selectedSymbol = getValueOrUndefined(this.editingEntity.billboard?.image);
      this.name = this.editingEntity.name || '';
      this.draw = DrawStore.drawValue;
      this.unsubscribeFromChanges = this.entity.properties!.definitionChanged.addEventListener(properties => {
        const volumeShowed = getValueOrUndefined(properties.volumeShowed);
        if (getValueOrUndefined(properties.volumeShowed) !== getValueOrUndefined(this.editingEntity!.properties!.volumeShowed)) {
          this.editingEntity!.properties!.volumeShowed = volumeShowed;
          if (volumeShowed)
            updateEntityVolume(this.editingEntity!, this.viewer!.scene.globe);
          else
            hideVolume(this.editingEntity!);
          this.viewer?.scene.requestRender();
          this.requestUpdate();
        }
      });
      if (this.draw) {
        this.cancelDraw();
        this.draw.entityForEdit = this.editingEntity;
        this.draw.type = this.editingEntity.properties!.type.getValue();
        this.draw.active = true;
      }
    }
    super.update(changedProps);
  }

  disconnectedCallback() {
    if (this.unsubscribeFromChanges) this.unsubscribeFromChanges();
    this.cancelDraw();
    this.removeEditingEntity();
    super.disconnectedCallback();
  }

  onVolumeHeightLimitsChange() {
    const lowerLimit = CesiumMath.clamp(Number(this.lowerLimitInput.value), this.minVolumeLowerLimit, this.maxVolumeLowerLimit);
    const height = CesiumMath.clamp(Number(this.heightInput.value), this.minVolumeHeight, this.maxVolumeHeight);
    this.lowerLimitInput.value = lowerLimit.toString();
    this.heightInput.value = height.toString();
    this.editingEntity!.properties!.volumeHeightLimits = {lowerLimit, height};
    const positions = this.editingEntity!.polylineVolume!.positions!.getValue(this.julianDate);
    updateVolumePositions(this.editingEntity, positions, this.viewer!.scene.globe);
    this.viewer!.scene.requestRender();
  }

  onPropChange(evt, propName) {
    if (this.editingEntity!.properties![propName]) {
      this.editingEntity!.properties![propName] = evt.target.value;
    } else {
      this.editingEntity!.properties!.addProperty(propName, evt.target.value);
    }
  }

  save() {
    if (this.entity && this.editingEntity) {
      this.entity.properties = <any>getAreaProperties(this.editingEntity, this.editingEntity.properties!.type.getValue());
      if (this.entity.billboard) {
        this.entity.position = <any> this.editingEntity.position?.getValue(this.julianDate);
        this.entity.billboard.color = this.editingEntity.billboard!.color;
        this.entity.billboard.image = this.editingEntity.billboard!.image;
      } else if (this.entity.polyline) {
        const positions = this.editingEntity.polyline!.positions?.getValue(this.julianDate);
        (<ConstantProperty> this.entity.polyline.positions).setValue(positions);
        this.entity.polyline.material = this.editingEntity.polyline!.material;
      } else if (this.entity.polygon) {
        const hierarchy = this.editingEntity.polygon!.hierarchy?.getValue(this.julianDate);
        (<ConstantProperty> this.entity.polygon.hierarchy).setValue(hierarchy);
        this.entity.polygon.material = this.editingEntity.polygon!.material;
      }
      if (this.editingEntity.properties!.volumeShowed && this.entity.polylineVolume) {
        updateEntityVolume(this.entity, this.viewer!.scene.globe);
        this.entity.polylineVolume.outlineColor = this.editingEntity.polylineVolume!.outlineColor;
        this.entity.polylineVolume.material = this.editingEntity.polylineVolume!.material;
      }
      this.entity.name = this.editingEntity.name;
      this.endEditing();
    }
  }

  cancelDraw() {
    if (!this.draw || !this.draw.active) return;
    this.draw.active = false;
    this.draw.clear();

  }

  removeEditingEntity() {
    if (!this.editingEntity) return;
    this.viewer!.entities.removeById(this.editingEntity!.id);
    this.editingEntity = undefined;
    hideVolume(this.entity!);
    this.entity!.show = true;
    this.viewer!.scene.requestRender();
  }

  endEditing() {
    ToolboxStore.setOpenedGeometryOptions(this.entity ? {id: this.entity.id} : null);
  }

  onColorChange(color) {
    this.selectedColor = color.toCssColorString();
    if (!this.editingEntity) return;
    if (this.editingEntity.billboard) {
      this.editingEntity.billboard.color = color;
      return;
    }
    color = color.withAlpha(0.3);
    if (this.editingEntity.polyline) {
      this.editingEntity.polyline.material = color;
    } else if (this.editingEntity.polygon) {
      this.editingEntity.polygon.material = color;
    }
    if (this.editingEntity.polylineVolume) {
      this.editingEntity.polylineVolume.material = color;
      this.editingEntity.polylineVolume.outlineColor = color;
    }
    this.viewer!.scene.requestRender();
  }

  onSymbolChange(image) {
    if (!this.editingEntity || !this.editingEntity.billboard) return;
    this.selectedSymbol = `./images/${image}`;
    this.editingEntity.billboard.image = <any> this.selectedSymbol;
    this.viewer!.scene.requestRender();
  }

  onNameChange(evt) {
    this.editingEntity!.name = evt.target.value;
    this.name = evt.target.value;
  }

  render() {
    if (!this.editingEntity) return '';
    const type = getValueOrUndefined(this.editingEntity!.properties!.type);
    return html`
      <div class="ngm-input ${classMap({'ngm-input-warning': !this.name})}">
        <input type="text" placeholder="required" .value=${this.name}
               @input=${evt => this.onNameChange(evt)}/>
        <span class="ngm-floating-label">${i18next.t('tbx_name_label')}</span>
      </div>
      <div class="ngm-input ngm-textarea">
        <textarea type="text" placeholder="required"
                  .value=${getValueOrUndefined(this.editingEntity!.properties!.description) || ''}
                  @input=${evt => this.onPropChange(evt, 'description')}></textarea>
        <span class="ngm-floating-label">${i18next.t('tbx_description_label')}</span>
      </div>
      <div class="ngm-input">
        <input type="text" placeholder="required"
               .value=${getValueOrUndefined(this.editingEntity!.properties!.image) || ''}
               @input=${evt => this.onPropChange(evt, 'image')}/>
        <span class="ngm-floating-label">${i18next.t('tbx_image_label')}</span>
      </div>
      <div class="ngm-input">
        <input type="text" placeholder="required"
               .value=${getValueOrUndefined(this.editingEntity!.properties!.website) || ''}
               @input=${evt => this.onPropChange(evt, 'website')}/>
        <span class="ngm-floating-label">${i18next.t('tbx_website_label')}</span>
      </div>
      <div class="ngm-geom-edit-double-input"
           ?hidden=${!getValueOrUndefined(this.editingEntity!.properties!.volumeShowed) || type === 'point'}>
        <div class="ngm-input">
          <input type="number" min=${this.minVolumeLowerLimit} max=${this.maxVolumeLowerLimit}
                 .value=${getValueOrUndefined(this.editingEntity!.properties!.volumeHeightLimits)?.lowerLimit.toFixed()}
                 @input=${this.onVolumeHeightLimitsChange}
                 class="ngm-lower-limit-input" placeholder="required"/>
          <span class="ngm-floating-label">${i18next.t('tbx_volume_lower_limit_label')}</span>
        </div>
        <div class="ngm-input">
          <input type="number" min=${this.minVolumeHeight} max=${this.maxVolumeHeight}
                 .value=${getValueOrUndefined(this.editingEntity!.properties!.volumeHeightLimits)?.height.toFixed()}
                 @input=${this.onVolumeHeightLimitsChange}
                 class="ngm-height-input" placeholder="required"/>
          <span class="ngm-floating-label">${i18next.t('tbx_volume_height_label')}</span>
        </div>
      </div>
      <ngm-point-edit ?hidden=${type !== 'point'} .entity=${this.editingEntity}></ngm-point-edit>
      <div>
        <div class="geom-styles-title">${i18next.t('tbx_styles_title')}</div>
        <div class="ngm-geom-colorpicker">
          ${GEOMETRY_COLORS.map(color => html`
            <div
              style="background-color: ${color.color};"
              @click=${() => this.onColorChange(color.value)}
              class="ngm-geom-color ${classMap({
                active: this.selectedColor === color.value.toCssColorString(),
                'black-tick': COLORS_WITH_BLACK_TICK.includes(color.color)
              })}">
            </div>`
          )}
        </div>
      </div>
      <div class="ngm-geom-symbolpicker" ?hidden=${!this.editingEntity.billboard}>
        ${POINT_SYMBOLS.map(image => {
          const imgSrc = `./images/${image}`;
          return html`
            <div
              class="ngm-geom-symbol ${classMap({active: this.selectedSymbol === imgSrc})}"
              style=${styleMap({
                '-webkit-mask-image': `url('${imgSrc}')`,
                'mask-image': `url('${imgSrc}')`,
                backgroundColor: this.selectedColor
              })}
              @click=${() => this.onSymbolChange(image)}></div>`;
        })}
      </div>
      <div class="ngm-geom-edit-actions">
        <button @click="${this.save}"
                class="ui button ngm-action-btn ${classMap({'ngm-disabled': !this.name})}">
          ${i18next.t('tbx_save_editing_btn_label')}
        </button>
        <button @click="${() => this.endEditing()}" class="ui button ngm-action-btn ngm-cancel-btn">
          ${i18next.t('app_cancel_btn_label')}
        </button>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
