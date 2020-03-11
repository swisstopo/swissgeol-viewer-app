import {html} from 'lit-html';
import {repeat} from 'lit-html/directives/repeat';
import i18next from 'i18next';
import {clickOnElement} from '../utils.js';

const areaUploadInputId = 'areaUpload';

export default function getTemplate() {
  const tooltipTranslationLabel = i18next.t('area_of_interest_add_hint');
  const hintTranslationLabel = i18next.t('area_of_interest_empty_hint');
  const btnTranslation = {
    cancel: i18next.t('cancel_area_btn_label'),
    removeAll: i18next.t('remove_all_area_btn_label'),
    add: i18next.t('add_area_btn_label'),
    hide: i18next.t('hide_btn_tooltip'),
    remove: i18next.t('remove_btn_tooltip'),
    flyTo: i18next.t('fly_to_btn_tooltip'),
    unhide: i18next.t('unhide_btn_tooltip'),
    upload: i18next.t('upload_btn_label')
  };

  return html`
    <div class="ui tiny fluid buttons ngm-aoi-buttons" ?hidden=${this.drawMode_}>
        <button class="ui button" @click=${this.onAddAreaClick_.bind(this)}>
            <i class="plus icon"></i>${btnTranslation.add}
        </button>
        <button class="ui button" @click=${clickOnElement.bind(null, areaUploadInputId)}>
            <i class="file upload icon"></i>${btnTranslation.upload}
        </button>
    </div>
    <!-- <button class="ui tiny fluid button"
            @click=${this.onRemoveEntityClick_.bind(this, null)}

            ?hidden=${this.drawMode_}>
            <i class="trash alternate outline icon"></i>${btnTranslation.removeAll}
    </button> -->
    <input id="${areaUploadInputId}" type='file' accept=".kml,.KML" hidden @change=${this.uploadArea_.bind(this)} />
    <div class="ui tiny basic fluid buttons ngm-aoi-tooltip-container" ?hidden=${!this.drawMode_}>
        <button class="ui button" @click=${this.cancelDraw_.bind(this)}>${btnTranslation.cancel}</button>
        <button class="ui button ngm-help-btn"
                data-tooltip=${tooltipTranslationLabel}
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
            data-tooltip=${btnTranslation.flyTo}
            data-position="top center"
            data-variation="tiny"
            ><i class="map marked alternate icon"></i></button>
            <button
            class="ui button"
            @click=${this.onShowHideEntityClick_.bind(this, i.id)}
            data-tooltip=${i.show ? btnTranslation.hide : btnTranslation.unhide}
            data-position="top center"
            data-variation="tiny"
            ><i class="${i.show ? 'eye outline' : 'eye slash outline'} icon"></i></button>
            <button
            class="ui button"
            @click=${this.onRemoveEntityClick_.bind(this, i.id)}
            data-tooltip=${btnTranslation.remove}
            data-position="top center"
            data-variation="tiny"
            ><i class="trash alternate outline icon"></i></button>
        </div>
      </div>`)}
    </div>
    <div ?hidden=${this.entitiesList_ && this.entitiesList_.length} class="ui tertiary center aligned segment">
        <span>${hintTranslationLabel}</span>
    </div>
  `;
}
