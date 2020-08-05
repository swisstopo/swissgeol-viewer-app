import {html} from 'lit-element';
import i18next from 'i18next';
import {clickOnElement} from '../utils.js';

const areaUploadInputId = 'areaUpload';

export default function getTemplate() {
  return html`
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
        <button class="ui button" @click=${this.cancelDraw.bind(this)}>${i18next.t('cancel_area_btn_label')}</button>
        <button class="ui button ngm-help-btn"
                data-tooltip=${i18next.t('area_of_interest_add_hint')}
                data-variation="tiny"
                data-position="top right">
            <i class="question circle outline icon"></i>
        </button>
    </div>
    <div class="ui vertical accordion ngm-aoi-areas" ?hidden=${!this.entitiesList_ || !this.entitiesList_.length}>
     ${aoiListTemplate.call(this)}
    </div>
    <div ?hidden=${this.entitiesList_ && this.entitiesList_.length} class="ui tertiary center aligned segment">
        <span>${i18next.t('area_of_interest_empty_hint')}</span>
    </div>
  `;
}

function aoiListTemplate() {
  return this.entitiesList_.map(i =>
    html`
      <div class="item">
        <div class="title">
             <i class="dropdown icon"></i>
            <div class="ui checkbox">
              <input type="checkbox" name="x-large" @input=${evt => this.onShowHideEntityClick_(evt, i.id)}>
              <label class="ngm-aoi-title"><i class=${this.getIconClass.call(this, i.id)}></i>${i.name}</label>
            </div>
        </div>
        <div class="content ngm-aoi-content">
            <div class="ui tiny fluid buttons ngm-aoi-buttons">
                <button
                class="ui button"
                @click=${this.onShowHideEntityClick_.bind(this, i.id)}
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
                @click=${this.onRemoveEntityClick_.bind(this, i.id)}
                data-tooltip=${i18next.t('remove_btn_tooltip')}
                data-position="top center"
                data-variation="tiny"
                ><i class="trash alternate outline icon"></i></button>
            </div>
            ${i.type !== 'polygon' ?
                html`<div class="ui tiny buttons">
                  <button class="ui button">Create section</button>
                  <button class="ui button"><i class="tools icon"></i></button>
                </div>` : ''}
        </div>
      </div>`);
}
