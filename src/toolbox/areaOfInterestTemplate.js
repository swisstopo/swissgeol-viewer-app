import {html} from 'lit-element';
import i18next from 'i18next';
import {clickOnElement} from '../utils.js';
import './ngm-gst-interaction.js';

const areaUploadInputId = 'areaUpload';

export default function getTemplate() {
  return html`
    <label>${i18next.t('drawing_tools_label')}</label>
    <div class="ui tiny fluid buttons ngm-aoi-buttons" ?hidden=${this.draw_.active}>
        <button class="ui button"
                data-tooltip=${i18next.t('add_point_btn_label')}
                data-variation="mini"
                data-position="top left"
                @click=${this.onAddAreaClick_.bind(this, 'point')}>
            <i class="map marker alternate icon"></i>
        <button class="ui button"
                data-tooltip=${i18next.t('add_line_btn_label')}
                data-variation="mini"
                data-position="top center"
                @click=${this.onAddAreaClick_.bind(this, 'line')}>
            <i class="route icon"></i>
        </button>
        <button class="ui button"
                data-tooltip=${i18next.t('add_polygon_area_btn_label')}
                data-variation="mini"
                data-position="top center"
                @click=${this.onAddAreaClick_.bind(this, 'polygon')}>
            <i class="draw polygon icon"></i>
        </button>
        <button class="ui button"
                data-tooltip=${i18next.t('add_rect_area_btn_label')}
                data-variation="mini"
                data-position="top center"
                @click=${this.onAddAreaClick_.bind(this, 'rectangle')}>
            <i class="vector square icon"></i>
        </button>
        <button class="ui button"
                data-tooltip=${i18next.t('upload_btn_label')}
                data-variation="mini"
                data-position="top right"
                @click=${clickOnElement.bind(null, areaUploadInputId)}>
            <i class="file upload icon"></i>
        </button>
    </div>
    <input id="${areaUploadInputId}" type='file' accept=".kml,.KML" hidden @change=${this.uploadArea_.bind(this)} />
    <div class="ui tiny basic fluid buttons ngm-aoi-tooltip-container" ?hidden=${!this.draw_.active}>
        <button class="ui button"
                ?hidden=${!this.draw_.entityForEdit}
                @click=${this.saveEditing.bind(this)}>${i18next.t('save_editing_btn_label')}</button>
        <button class="ui button" @click=${this.cancelDraw.bind(this)}>${i18next.t('cancel_area_btn_label')}</button>
        <button class="ui button ngm-help-btn"
                data-tooltip=${!this.draw_.entityForEdit ?
    i18next.t('area_of_interest_add_hint') :
    i18next.t('area_of_interest_edit_hint')}
                data-variation="tiny"
                data-position="top right">
            <i class="question circle outline icon"></i>
        </button>
    </div>

    <div class="ngm-volume-limits-input"
        ?hidden=${!this.draw_.entityForEdit
                  || !(this.draw_.entityForEdit.properties.volumeShowed
                  && this.draw_.entityForEdit.properties.volumeShowed.getValue())}>
        <div>
            <label>${i18next.t('volume_lower_limit')}:</label></br>
            <div class="ui mini input right labeled">
                 <input type="number" step="10" min="${this.minVolumeHeight}" max="${this.maxVolumeHeight}" class="ngm-lower-limit-input"
                    .value="${this.volumeHeightLimits.lowerLimit}"
                    @change="${this.onVolumeHeightLimitsChange.bind(this)}">
                <label class="ui label">m</label>
            </div>
        </div>
        <div>
            <label>${i18next.t('volume_height')}:</label></br>
            <div class="ui mini input right labeled">
                <input type="number" step="10" min="${this.minVolumeHeight}" max="${this.maxVolumeHeight}" class="ngm-volume-height-input"
                    .value="${this.volumeHeightLimits.height}"
                    @change="${this.onVolumeHeightLimitsChange.bind(this)}">
                <label class="ui label">m</label>
            </div>
        </div>
    </div>

    <label>${i18next.t('analysis_tools_label')}</label>
    <div class="ui vertical accordion ngm-aoi-areas" ?hidden=${!this.entitiesList_ || !this.entitiesList_.length}>
     ${aoiListTemplate.call(this)}
    </div>
    <div ?hidden=${this.entitiesList_ && this.entitiesList_.length} class="ui tertiary center aligned segment">
        <span>${i18next.t('area_of_interest_empty_hint')}</span>
    </div>
    <ngm-gst-modal .imageUrl="${this.sectionImageUrl}"></ngm-gst-modal>
  `;
}

function aoiListTemplate() {
  return this.entitiesList_.map(i =>
    html`
      <div class="item">
        <div class="title" @click=${evt => this.onAreaClick(evt)}>
             <i class="dropdown icon"></i>
            <div class="ui checkbox">
              <input type="checkbox" @input=${evt => this.onShowHideEntityClick_(evt, i.id)} .checked=${i.show}>
              <label class="ngm-aoi-title"><i class=${this.getIconClass.call(this, i.id)}></i>${i.name}</label>
            </div>
        </div>
        <div class="content ngm-aoi-content">
            <div class="ngm-btns-field">
                <div class="ui tiny fluid compact buttons ngm-aoi-buttons">
                    <button
                    class="ui button"
                    @click=${this.showAreaInfo.bind(this, i)}
                    data-tooltip=${i18next.t('info_btn_tooltip')}
                    data-position="top center"
                    data-variation="tiny"
                    ><i class="info circle icon"></i></button>
                    <button
                    class="ui button"
                    @click=${this.flyToArea.bind(this, i.id)}
                    data-tooltip=${i18next.t('fly_to_btn_tooltip')}
                    data-position="top center"
                    data-variation="tiny"
                    ><i class="search plus icon"></i></button>
                    <button
                    class="ui button"
                    @click=${this.editAreaPosition.bind(this, i.id)}
                    data-tooltip=${i18next.t('edit_area_btn_tooltip')}
                    data-position="top center"
                    data-variation="tiny"
                    ><i class="pen icon"></i></button>
                    <button
                    class="ui button"
                    @click=${this.updateEntityVolume.bind(this, i.id, true)}
                    ?hidden=${i.type === 'point' || i.volumeShowed}
                    data-tooltip=${i18next.t('show_volume_btn')}
                    data-position="top center"
                    data-variation="tiny"
                    ><i class="${this.getIconClass.call(this, i.id, true)}"></i></button>
                    <button
                    class="ui button"
                    @click=${this.hideVolume.bind(this, i.id)}
                    ?hidden=${i.type === 'point' || !i.volumeShowed}
                    data-tooltip=${i18next.t('hide_volume_btn')}
                    data-position="top center"
                    data-variation="tiny"
                    ><i class="${this.getIconClass.call(this, i.id, true)}"></i></button>
                    <button
                    class="ui button"
                    @click=${this.onRemoveEntityClick_.bind(this, i.id)}
                    data-tooltip=${i18next.t('remove_btn_tooltip')}
                    data-position="top center"
                    data-variation="tiny"
                    ><i class="trash alternate outline icon"></i></button>
                </div>
            </div>
            ${i.type !== 'polygon' ?
      html`
                    <ngm-gst-interaction
                        .viewer=${this.viewer}
                        .positions=${i.positions}
                        .geometryType=${i.type}
                        .parentElement=${this}>
                    </ngm-gst-interaction>
                ` : ''}
        </div>
      </div>`);
}


