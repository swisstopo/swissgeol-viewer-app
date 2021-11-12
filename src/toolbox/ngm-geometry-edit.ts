import {LitElementI18n} from '../i18n';
import {customElement, property, query} from 'lit/decorators.js';
import {html} from 'lit';
import {Entity, Viewer} from 'cesium';
import i18next from 'i18next';
import MainStore from '../store/main';
import {updateEntityVolume, updateVolumePositions} from './helpers';
import {getValueOrUndefined} from '../cesiumutils';
import ToolboxStore from '../store/toolbox';
import CesiumMath from 'cesium/Source/Core/Math';
import JulianDate from 'cesium/Source/Core/JulianDate';

@customElement('ngm-geometry-edit')
export class NgmGeometryEdit extends LitElementI18n {
  @property({type: Object}) entity: Entity | undefined;
  @query('.ngm-lower-limit-input') lowerLimitInput;
  @query('.ngm-height-input') heightInput;
  private editingEntity: Entity | undefined;
  private viewer: Viewer | null | undefined;
  private minVolumeHeight = 1;
  private maxVolumeHeight = 30000;
  private minVolumeLowerLimit = -30000;
  private maxVolumeLowerLimit = 30000;
  private julianDate = new JulianDate();

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  update(changedProps) {
    if (this.entity && !this.editingEntity) {
      this.editingEntity = new Entity();
      this.editingEntity.merge(this.entity);
      this.viewer!.entities.add(this.editingEntity);
      this.entity.show = false;
    }
    super.update(changedProps);
  }

  disconnectedCallback() {
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
      this.entity.properties = this.editingEntity.properties;
      if (this.entity.billboard) {
        this.entity.position = this.editingEntity.position;
        this.entity.billboard.color = this.editingEntity.billboard!.color;
        this.entity.billboard.image = this.editingEntity.billboard!.image;
      } else if (this.entity.polyline) {
        this.entity.polyline.positions = this.editingEntity.polyline!.positions;
        this.entity.polyline.material = this.editingEntity.polyline!.material;
      } else if (this.entity.polygon) {
        this.entity.polygon.hierarchy = this.editingEntity.polygon!.hierarchy;
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

  removeEditingEntity() {
    if (!this.editingEntity) return;
    this.viewer!.entities.removeById(this.editingEntity!.id);
    this.editingEntity = undefined;
    this.entity!.show = true;
    this.viewer!.scene.requestRender();
  }

  endEditing() {
    ToolboxStore.setOpenedGeometryOptions(this.entity ? {id: this.entity.id} : null);
  }

  render() {
    if (!this.editingEntity) return '';
    return html`
      <div class="ngm-input">
        <input type="text" required .value=${this.editingEntity.name}
               @input=${evt => this.editingEntity!.name = evt.target.value}/>
        <span class="ngm-floating-label">${i18next.t('tbx_name_label')}</span>
      </div>
      <div class="ngm-input ngm-textarea">
        <textarea type="text" required
                  .value=${getValueOrUndefined(this.editingEntity!.properties!.description) || ''}
                  @input=${evt => this.onPropChange(evt, 'description')}></textarea>
        <span class="ngm-floating-label">${i18next.t('tbx_description_label')}</span>
      </div>
      <div class="ngm-input">
        <input type="text" required
               .value=${getValueOrUndefined(this.editingEntity!.properties!.image) || ''}
               @input=${evt => this.onPropChange(evt, 'image')}/>
        <span class="ngm-floating-label">${i18next.t('tbx_image_label')}</span>
      </div>
      <div class="ngm-input">
        <input type="text" required
               .value=${getValueOrUndefined(this.editingEntity!.properties!.website) || ''}
               @input=${evt => this.onPropChange(evt, 'website')}/>
        <span class="ngm-floating-label">${i18next.t('tbx_website_label')}</span>
      </div>
      <div class="ngm-geom-limits-edit" ?hidden=${!getValueOrUndefined(this.editingEntity!.properties!.volumeShowed)}>
        <div class="ngm-input">
          <input type="number" min=${this.minVolumeLowerLimit} max=${this.maxVolumeLowerLimit}
                 .value=${getValueOrUndefined(this.editingEntity!.properties!.volumeHeightLimits)?.lowerLimit}
                 @change=${this.onVolumeHeightLimitsChange}
                 class="ngm-lower-limit-input" required/>
          <span class="ngm-floating-label">${i18next.t('tbx_volume_lower_limit_label')}</span>
        </div>
        <div class="ngm-input">
          <input type="number" min=${this.minVolumeHeight} max=${this.maxVolumeHeight}
                 .value=${getValueOrUndefined(this.editingEntity!.properties!.volumeHeightLimits)?.height}
                 @change=${this.onVolumeHeightLimitsChange}
                 class="ngm-height-input" required/>
          <span class="ngm-floating-label">${i18next.t('tbx_volume_height_label')}</span>
        </div>
      </div>
      <div class="ngm-geom-edit-actions">
        <button @click="${this.save}" class="ui button ngm-action-btn">
          ${i18next.t('tbx_save_editing_btn_label')}
        </button>
        <button @click="${this.endEditing}" class="ui button ngm-action-btn ngm-cancel-btn">
          ${i18next.t('tbx_cancel_area_btn_label')}
        </button>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
