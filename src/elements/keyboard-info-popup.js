import {html, render} from 'lit-html';
import {repeat} from 'lit-html/directives/repeat.js';
import i18next from 'i18next';

const pcMacLable = 'PC + Mac';
const pcLable = 'PC';
const macLable = 'MAC';

const t = a => a;
const infoConfig = () => [
  {
    title: t('info_tilt_label'),
    content: [
      {
        title: pcMacLable,
        content: 'info_tilt_pc_1'
      },
      {
        title: pcMacLable,
        content: 'info_tilt_pc_2'
      },
      {
        title: 'touch_label',
        content: 'info_tilt_touch'
      }
    ]
  }
];

export function initInfoPopup() {
  i18next.on('initialized', function(options) {
    renderKeyboardInfo();
  });

  i18next.on('languageChanged', function(options) {
    renderKeyboardInfo();
  });

  document.getElementById('navigationInfoBtn').addEventListener('click', event => {
    document.getElementById('navigationInfo').classList.toggle('visible');
  });
}

export function renderKeyboardInfo() {
  const infoLineRepeat = value => html`
    <div class="ngm-info-line">
      <div class="ngm-info-line-title" data-i18n>${i18next.t(value.title)}:</div>
      <div class="ngm-info-line-content" data-i18n>${i18next.t(value.content)}</div>
    </div>`;

  const rowRepeat = value => html`
    <div class="row">
      <div class="column">
        <h4 class="ui header" data-i18n>${i18next.t(value.title)}</h4>
        ${repeat(value.content, infoLineRepeat)}
      </div>
    </div>`;

  const info = html`
  <div class="ui internally celled grid ngm-keyboard-info-content">
   ${repeat(infoConfig(), rowRepeat)}
  </div>`;

  render(info, document.getElementById('navigationInfo'));
}
