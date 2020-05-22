import {html} from 'lit-element';
import i18next from 'i18next';
import {clickOnElement} from '../utils.js';

const areaUploadInputId = 'areaUpload';

export default function getTemplate() {
  return html`
    <div class="ui tiny fluid buttons ngm-aoi-buttons" ?hidden=${this.draw_.active}>
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
                data-position="top center"
                @click=${clickOnElement.bind(null, areaUploadInputId)}>
            <i class="file upload icon"></i>
        </button>
    </div>
    <!-- <button class="ui tiny fluid button"
            @click=${this.onRemoveEntityClick_.bind(this, null)}
            ?hidden=${this.draw_.active}>
            <i class="trash alternate outline icon"></i>${i18next.t('remove_all_area_btn_label')}
    </button> -->
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
    <div class="ui segments" ?hidden=${!this.entitiesList_ || !this.entitiesList_.length}>
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
      <div class="ui segment ${i.selected ? 'secondary' : ''} ngm-aoi-segment">
        <div class="ngm-aoi-title-container">
            <label class="ngm-aoi-title">${i.name}</label>
            <label class="ngm-aoi-subtitle">
                ${i.type === 'rectangle' && i.sidesLength ?
                `${i.sidesLength[0]}km x ${i.sidesLength[1]}km` :
                `${i18next.t('Area')}: ${i.area}km²`}
            </label>
        </div>
        <div class="ui small basic icon buttons">
            <button
            class="ui button"
            @click=${this.flyToArea_.bind(this, i.id)}
            data-tooltip=${i18next.t('fly_to_btn_tooltip')}
            data-position="top center"
            data-variation="tiny"
            ><i class="map marked alternate icon"></i></button>
            <button
            class="ui button"
            @click=${this.onShowHideEntityClick_.bind(this, i.id)}
            data-tooltip=${i.show ? i18next.t('hide_btn_tooltip') : i18next.t('unhide_btn_tooltip')}
            data-position="top center"
            data-variation="tiny"
            ><i class="${i.show ? 'eye outline' : 'eye slash outline'} icon"></i></button>
            <button
            class="ui button"
            @click=${this.onRemoveEntityClick_.bind(this, i.id)}
            data-tooltip=${i18next.t('remove_btn_tooltip')}
            data-position="top center"
            data-variation="tiny"
            ><i class="trash alternate outline icon"></i></button>
        </div>
      </div>`);
}
