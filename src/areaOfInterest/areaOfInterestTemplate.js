import {html} from 'lit-html';
import {repeat} from 'lit-html/directives/repeat';
import i18next from 'i18next';
import {clickOnElement, onAccordionTitleClick, onAccordionIconClick} from '../utils.js';

const tooltipTranslationLabel = 'area_of_interest_add_hint';
const hintTranslationLabel = 'area_of_interest_empty_hint';
const btnTranslation = {
  cancel: 'cancel_area_btn_label',
  removeAll: 'remove_all_area_btn_label',
  add: 'add_area_btn_label',
  hide: 'hide_btn_tooltip',
  remove: 'remove_btn_tooltip',
  flyTo: 'fly_to_btn_tooltip',
  unhide: 'unhide_btn_tooltip',
  upload: 'upload_btn_label'
};

const areaUploadInputId = 'areaUpload';

export default function getTemplate() {
  return html`
  <div class="title" @click=${onAccordionTitleClick}>
    <i class="dropdown icon" @click=${onAccordionIconClick}></i>
    Areas of Interest
  </div>
  <div class="content">
    <div class="ui tiny fluid buttons ngm-new-aoi-container" ?hidden=${this.drawMode_}>
        <button class="ui blue button" @click=${this.onAddAreaClick_.bind(this)} data-i18n>
            <i class="plus icon"></i>${i18next.t(btnTranslation.add)}
        </button>
        <button class="ui blue button" @click=${clickOnElement.bind(null, areaUploadInputId)} data-i18n>
            <i class="file upload icon"></i>${i18next.t(btnTranslation.upload)}
        </button>
    </div>
    <button class="ui tiny red fluid button"
            @click=${this.onRemoveEntityClick_.bind(this, null)}
            data-i18n
            ?hidden=${this.drawMode_}>
            <i class="trash alternate outline icon"></i>${i18next.t(btnTranslation.removeAll)}
    </button>
    <input id="${areaUploadInputId}" type='file' accept=".kml,.KML" hidden @change=${this.uploadArea_.bind(this)} />
    <div class="ui tiny basic fluid buttons ngm-aoi-tooltip-container" ?hidden=${!this.drawMode_}>
        <button class="ui button" @click=${this.cancelDraw_.bind(this)} data-i18n>${i18next.t(btnTranslation.cancel)}</button>
        <button class="ui button ngm-help-btn"
                data-i18n
                data-tooltip=${i18next.t(tooltipTranslationLabel)}
                data-variation="tiny"
                data-position="top right">
            <i class="question circle outline icon"></i>
        </button>
    </div>
    <div class="ui segments" ?hidden=${!this.entitiesList_ || !this.entitiesList_.length}>
     ${repeat(this.entitiesList_, (i) => i.id, (i, index) =>
    html`
      <div class="ui segment ${i.selected ? 'secondary' : ''} ngm-aoi-segment">
        <label class="ngm-aoi-title">${i.name}</label>
        <div class="ui small basic icon buttons">
            <button
            class="ui button"
            @click=${this.flyToArea_.bind(this, i.id)}
            data-i18n
            data-tooltip=${i18next.t(btnTranslation.flyTo)}
            data-position="top center"
            data-variation="tiny"
            ><i class="map marked alternate icon"></i></button>
            <button
            class="ui button"
            @click=${this.onShowHideEntityClick_.bind(this, i.id)}
            data-i18n
            data-tooltip=${i18next.t(i.show ? btnTranslation.hide : btnTranslation.unhide)}
            data-position="top center"
            data-variation="tiny"
            ><i class="${i.show ? 'eye outline' : 'eye slash outline'} icon"></i></button>
            <button
            class="ui button"
            @click=${this.onRemoveEntityClick_.bind(this, i.id)}
            data-i18n
            data-tooltip=${i18next.t(btnTranslation.remove)}
            data-position="top center"
            data-variation="tiny"
            ><i class="trash alternate outline icon"></i></button>
        </div>
      </div>`)}
    </div>
    <div ?hidden=${this.entitiesList_ && this.entitiesList_.length} class="ui tertiary center aligned segment">
        <span data-i18n>${i18next.t(hintTranslationLabel)}</span>
    </div>
  </div>
  `;
}




