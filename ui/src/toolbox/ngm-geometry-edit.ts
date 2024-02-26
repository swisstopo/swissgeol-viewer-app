import {LitElementI18n} from '../i18n';
import {customElement, property, query, state} from 'lit/decorators.js';
import {html} from 'lit';
import type {ConstantProperty, Event, Viewer} from 'cesium';
import {Entity, PropertyBag, Math as CesiumMath, JulianDate, CustomDataSource} from 'cesium';
import i18next from 'i18next';
import MainStore from '../store/main';
import {
  getAreaProperties,
  hideVolume,
  pauseGeometryCollectionEvents,
  updateEntityVolume,
  updateVolumePositions
} from './helpers';
import {getEntityColor, getValueOrUndefined} from '../geoblocks/cesium-helpers/cesiumutils';
import ToolboxStore from '../store/toolbox';
import DrawStore from '../store/draw';
import type {CesiumDraw} from '../geoblocks/cesium-helpers/draw/CesiumDraw';
import {COLORS_WITH_BLACK_TICK, GEOMETRY_COLORS, GEOMETRY_DATASOURCE_NAME, POINT_SYMBOLS} from '../constants';
import {classMap} from 'lit-html/directives/class-map.js';
import {styleMap} from 'lit/directives/style-map.js';
import './ngm-point-edit';
import {skip, take} from 'rxjs';

@customElement('ngm-geometry-edit')
export class NgmGeometryEdit extends LitElementI18n {
  @property({type: Object})
  accessor entity: Entity | undefined;
  @query('.ngm-lower-limit-input')
  accessor lowerLimitInput;
  @query('.ngm-height-input')
  accessor heightInput;
  @state()
  accessor selectedColor = '';
  @state()
  accessor selectedSymbol = '';
  @state()
  accessor name = '';
  @state()
  accessor validLowerLimit = true;
  private editingEntity: Entity | undefined;
  private viewer: Viewer | null | undefined;
  private minVolumeHeight = 1;
  private maxVolumeHeight = 30000;
  private minVolumeLowerLimit = -30000;
  private maxVolumeLowerLimit = 30000;
  private julianDate = new JulianDate();
  private draw: CesiumDraw | undefined;
  private unsubscribeFromChanges: Event.RemoveCallback | undefined;
  private geometriesDataSource: CustomDataSource | undefined;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
      if (this.viewer) {
        this.geometriesDataSource = this.viewer.dataSources.getByName(GEOMETRY_DATASOURCE_NAME)[0];
      }
    });
  }

  update(changedProps) {
    this.onEntityChange();
    super.update(changedProps);
  }

  @pauseGeometryCollectionEvents
  onEntityChange() {
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
      this.unsubscribeFromChanges = this.entity.properties!.definitionChanged.addEventListener(properties => this.onEntityPropertyChange(properties));
      if (this.draw) {
        this.cancelDraw();
        this.draw.entityForEdit = this.editingEntity;
        this.draw.type = this.editingEntity.properties!.type.getValue();
        this.draw.active = true;
      }
    }
  }

  @pauseGeometryCollectionEvents
  onEntityPropertyChange(properties) {
    const volumeShowed = getValueOrUndefined(properties.volumeShowed);
    if (volumeShowed !== getValueOrUndefined(this.editingEntity!.properties!.volumeShowed)) {
      this.editingEntity!.properties!.volumeShowed = volumeShowed;
      if (volumeShowed) {
        updateEntityVolume(this.editingEntity!, this.viewer!.scene.globe);
      } else {
        hideVolume(this.editingEntity!);
      }
      this.viewer?.scene.requestRender();
      this.requestUpdate();
    }
  }

  onHeightLimitChange() {
    const height = CesiumMath.clamp(Number(this.heightInput.value), this.minVolumeHeight, this.maxVolumeHeight);
    this.heightInput.value = height.toString();

    const lowerLimit = Number(this.lowerLimitInput.value);
    this.editingEntity!.properties!.volumeHeightLimits = {lowerLimit, height};

    this.updateVolumePositions();
  }

  onLowerLimitChange() {
    let lowerLimit;
    // the condition allows users to enter the negative sign without converting it to 0
    if (this.lowerLimitInput.value === '') {
      lowerLimit = this.lowerLimitInput.value;
    } else {
      lowerLimit = CesiumMath.clamp(Number(this.lowerLimitInput.value), this.minVolumeLowerLimit, this.maxVolumeLowerLimit);
      this.lowerLimitInput.value = lowerLimit.toString();
    }

    const height = Number(this.heightInput.value);
    this.editingEntity!.properties!.volumeHeightLimits = {lowerLimit, height};

    this.lowerLimitInputValidation();
    this.updateVolumePositions();
  }

  updateVolumePositions() {
    const positions = this.editingEntity!.polylineVolume!.positions!.getValue(this.julianDate);
    updateVolumePositions(this.editingEntity, positions, this.viewer!.scene.globe);
    this.viewer!.scene.requestRender();
  }


  lowerLimitInputValidation() {
    const lowerLimit = this.editingEntity!.properties!.volumeHeightLimits.getValue().lowerLimit;
    const validationTest = /^-?(0|[1-9]\d*)(\.\d+)?$/.test(lowerLimit);
    this.validLowerLimit = validationTest;
  }

  onPropChange(evt, propName) {
    if (this.editingEntity!.properties![propName]) {
      this.editingEntity!.properties![propName] = evt.target.value;
    } else {
      this.editingEntity!.properties!.addProperty(propName, evt.target.value);
    }
  }

  @pauseGeometryCollectionEvents
  save() {
    if (this.entity && this.editingEntity) {
      this.entity.properties = <any>getAreaProperties(this.editingEntity, this.editingEntity.properties!.type.getValue());
      if (this.entity.billboard) {
        this.entity.position = <any> this.editingEntity.position?.getValue(this.julianDate);
        this.entity.billboard.color = this.editingEntity.billboard!.color;
        this.entity.billboard.image = this.editingEntity.billboard!.image;
        if (this.editingEntity.properties!.volumeShowed) {
          updateEntityVolume(this.entity!, this.viewer!.scene.globe);
        }
      } else if (this.entity.polyline) {
        const positions = this.editingEntity.polyline!.positions?.getValue(this.julianDate);
        (<ConstantProperty> this.entity.polyline.positions).setValue(positions);
        this.entity.polyline.material = this.editingEntity.polyline!.material;
      } else if (this.entity.polygon) {
        const hierarchy = this.editingEntity.polygon!.hierarchy?.getValue(this.julianDate);
        (<ConstantProperty> this.entity.polygon.hierarchy).setValue(hierarchy);
        this.entity.polygon.material = this.editingEntity.polygon!.material;
      }
      if (getValueOrUndefined(this.editingEntity.properties!.volumeShowed) && this.entity.polylineVolume) {
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
    this.viewer!.scene.requestRender();
  }

  endEditing() {
    this.geometriesDataSource?.entities.suspendEvents();
    if (this.unsubscribeFromChanges) this.unsubscribeFromChanges();
    this.cancelDraw();
    this.removeEditingEntity();
    if (this.entity) this.entity.show = true;
    ToolboxStore.openedGeometryOptions.pipe(skip(1), take(1)).subscribe(() => {
      this.geometriesDataSource?.entities.resumeEvents();
    });
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
        <div class="ngm-input ${classMap({'ngm-input-warning': !this.validLowerLimit})}">
          <input type="number" min=${this.minVolumeLowerLimit} max=${this.maxVolumeLowerLimit}
                 .value=${getValueOrUndefined(this.entity!.properties!.volumeHeightLimits)?.lowerLimit.toFixed(1)}
                 step="0.1"
                 @focusout=${this.onLowerLimitChange}
                 class="ngm-lower-limit-input" placeholder="required"/>
          <span class="ngm-floating-label">${i18next.t('tbx_volume_lower_limit_label')}</span>
        </div>
        <div class="ngm-input">
          <input type="number" min=${this.minVolumeHeight} max=${this.maxVolumeHeight}
                 .value=${getValueOrUndefined(this.entity!.properties!.volumeHeightLimits)?.height.toFixed(1)}
                 step="0.1"
                 @focusout=${this.onHeightLimitChange}
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
                class="ui button ngm-action-btn ${classMap({'ngm-disabled': !this.name || !this.validLowerLimit})}">
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
