import {html} from 'lit-html';
import {repeat} from 'lit-html/directives/repeat';
import i18next from 'i18next';

const tooltipTranslationLabel = 'area_of_interest_add_hint';
const hintTranslationLabel = 'area_of_interest_empty_hint';
const btnTranslation = {
  cancel: 'cancel_area_btn_label',
  removeAll: 'remove_all_area_btn_label',
  add: 'add_area_btn_label'

};

export default function getTemplate() {
  return html`
  <div class="title" @click=${this.onAccordionTitleClick} style="font-weight: 400;color: rgba(0,0,0,.87);">
    <i class="dropdown icon"></i>
    Areas of Interest
  </div>
  <div class="content">
    <div class="ui tiny fluid buttons" ?hidden=${this.drawMode_}>
        <button class="ui blue button" @click=${this.onAddAreaClick_.bind(this)} data-i18n>
            <i class="plus icon"></i>${i18next.t(btnTranslation.add)}
        </button>
        <button class="ui red button" @click=${this.onRemoveEntityClick_.bind(this, null)} data-i18n>
            <i class="trash alternate outline icon"></i>${i18next.t(btnTranslation.removeAll)}
        </button>
    </div>
    <div class="ui tiny basic fluid buttons" ?hidden=${!this.drawMode_}>
        <button class="ui button" @click=${this.cancelDraw_.bind(this)} data-i18n>${i18next.t(btnTranslation.cancel)}</button>
        <button class="ui button"
                data-i18n
                data-tooltip=${i18next.t(tooltipTranslationLabel)}
                data-position="top center"
                data-variation="tiny"
                style="width: 0;padding: 0;">
            <i class="question circle outline icon"></i>
        </button>
    </div>
    <div class="ui segments" ?hidden=${!this.entitiesList_ || !this.entitiesList_.length} style="overflow-y: auto;max-height: 300px;">
     ${repeat(this.entitiesList_, (i) => i.id, (i, index) =>
    html`
      <div class="ui segment ${i.selected ? 'secondary' : ''}" style="
      padding-top: 5px;
      padding-bottom: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      ">
        <label>${i.id.split('-')[0]}</label>
        <div class="ui small basic icon buttons">
            <button class="ui button" @click=${this.flyToArea_.bind(this, i.id)}><i class="map marked alternate icon"></i></button>
            <button class="ui button" @click=${this.onShowHideEntityClick_.bind(this, i.id)}>
                <i class="${i.show ? 'eye outline' : 'eye slash outline'} icon"></i>
            </button>
            <button class="ui button" @click=${this.onRemoveEntityClick_.bind(this, i.id)}><i class="trash alternate outline icon"></i></button>
        </div>
      </div>`)}
    </div>
    <div ?hidden=${this.entitiesList_ && this.entitiesList_.length} class="ui tertiary center aligned segment">
        <span data-i18n>${i18next.t(hintTranslationLabel)}</span>
    </div>
  </div>
  `;
}




