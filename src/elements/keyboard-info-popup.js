import {html, render} from 'lit-html';
import {repeat} from 'lit-html/directives/repeat.js';
import i18next from 'i18next';

const popupId = 'navigationInfo';
const buttonId = 'navigationInfoBtn';

const t = a => a;
const infoConfig = [
  {
    title: t('info_tilt_label'),
    content: [
      {
        title: t('pc_mac_label'),
        content: t('info_tilt_pc_1')
      },
      {
        title: t('pc_mac_label'),
        content: t('info_tilt_pc_2')
      },
      {
        title: t('touch_label'),
        content: t('info_tilt_touch'),
        img: '../images/info/TouchTilt.png'
      }
    ]
  },
  {
    title: t('info_look_label'),
    content: [
      {
        title: t('pc_label'),
        content: t('info_look_pc')
      },
      {
        title: t('mac_label'),
        content: t('info_look_mac')
      },
      {
        title: t('touch_label'),
        content: t('info_look_touch'),
        img: '../images/info/TouchRotate.png'
      }
    ]
  },
  {
    title: t('info_zoom_label'),
    content: [
      {
        title: t('pc_mac_label'),
        content: t('info_zoom')
      },
      {
        title: t('touch_label'),
        content: t('info_zoom_touch'),
        img: '../images/info/TouchZoom.png'
      }
    ]
  },
  {
    title: t('info_move_label'),
    content: [
      {
        title: t('pc_mac_label'),
        content: t('info_move')
      },
      {
        title: t('touch_label'),
        content: t('info_move_touch')
      }
    ]
  },
  {
    title: t('info_move_forward_label'),
    content: [
      {
        title: t('pc_mac_label'),
        content: t('info_move_forward')
      },
      {
        title: t('touch_label'),
        content: t('info_move_forward_touch')
      }
    ]
  },
  {
    title: t('info_elevator_label'),
    content: [
      {
        title: t('pc_mac_label'),
        content: t('info_elevator')
      }
    ]
  },
  {
    title: t('info_clockwise_rotate_label'),
    content: [
      {
        title: t('pc_mac_label'),
        content: t('info_clockwise_rotate')
      }
    ]
  },
  {
    title: t('info_rotate_label'),
    content: [
      {
        title: t('pc_mac_label'),
        content: t('info_rotate')
      }
    ]
  }
];

function renderKeyboardInfo() {
  const infoLineRepeat = value => html`
    <div class="ngm-info-line">
      <div class="ngm-info-line-title" data-i18n>
        ${i18next.t(value.title)}:
        ${value.img ? html`<img src="${value.img}">` : ''}
      </div>
      <div class="ngm-info-line-content" data-i18n>${i18next.t(value.content)}</div>
    </div>`;

  const rowRepeat = value => html`
    <div class="row">
      <div class="column">
        <h4 data-i18n>${i18next.t(value.title)}</h4>
        ${repeat(value.content, infoLineRepeat)}
      </div>
    </div>`;

  const info = html`
  <div class="ui internally celled grid ngm-keyboard-info-content">
   ${repeat(infoConfig, rowRepeat)}
  </div>
  <h4 class="ngm-keyboard-tip" data-i18n>${i18next.t('info_tip')}</h4>`;

  render(info, document.getElementById(popupId));
}

function closeInfoPopup(evt) {
  const popupElement = document.getElementById(popupId);
  const btnElement = document.getElementById(buttonId);
  if (!popupElement.contains(evt.target) && !btnElement.contains(evt.target)) {
    document.getElementById(popupId).classList.remove('visible');
    document.querySelector('body').removeEventListener('click', closeInfoPopup);
  }
}

export function initInfoPopup() {
  i18next.on('initialized', () => renderKeyboardInfo());
  i18next.on('languageChanged', () => renderKeyboardInfo());

  document.getElementById(buttonId).addEventListener('click', event => {
    document.getElementById(popupId).classList.toggle('visible');
    document.querySelector('body').addEventListener('click', closeInfoPopup);
  });
}
