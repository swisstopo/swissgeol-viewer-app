import {html} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../../i18n.js';
import $ from '../../jquery';
import '../ngm-i18n-content.js';
import MainStore from '../../store/main';
import SlicerStore from '../../store/slicer';

class NgmToolboxSlicer extends LitElementI18n {

  static get properties() {
    return {
      positions: {type: Array},
      lowerLimit: {type: Number},
      height: {type: Number},
      type: {type: String},
      showBox: {type: Boolean},
      onEnableSlicing: {type: Function},
      onDisableSlicing: {type: Function},
      onShowSlicingBoxChange: {type: Function}
    };
  }

  constructor() {
    super();

    /**
     * @type {Slicer}
     */
    this.slicer = null;
    SlicerStore.getSlicer().subscribe(slicer => this.slicer = slicer);

    this.sliceSide = 'left';
    this.sliceEnabled = false;
    this.showBox = true;
  }

  firstUpdated() {
    // FIXME: update the i18n extractor to collect the 'key' from ngm-i18n-content
    // workaround: t('tbx_line_slice_warn')
    $(this.querySelector('.ngm-slice-warn')).popup({
      position: 'top left',
      html: '<ngm-i18n-content key="tbx_line_slice_warn"></ngm-i18n-content>',
      variation: 'mini',
      forcePosition: true,
    });
    $(this.querySelector('.ngm-slice-tools-btn')).popup({
      popup: $(this.querySelector('.ngm-slice-tools-popup')),
      on: 'click',
      position: 'right center'
    });
    $(this.querySelector('.ngm-slice-side')).dropdown({
      onChange: value => {
        this.sliceSide = value;
        if (this.slicer.active) {
          this.toggleSlicer(true);
        }
      }
    });
    if (this.type === 'rectangle')
      $(this.querySelector('.ui.checkbox')).checkbox(this.showBox ? 'check' : 'uncheck');
  }

  toggleSlicer(value) {
    this.sliceEnabled = false;
    if (this.slicer.active) this.slicer.active = false;
    if (value) {
      if (this.type === 'line') {
        this.slicer.sliceOptions = {
          type: 'line',
          slicePoints: [this.positions[0], this.positions[this.positions.length - 1]],
          negate: this.sliceSide === 'left',
          deactivationCallback: () => this.onDeactivation()
        };
      } else {
        this.slicer.sliceOptions = {
          type: 'box',
          slicePoints: this.positions,
          lowerLimit: this.lowerLimit,
          height: this.height,
          negate: this.sliceSide === 'right',
          showBox: this.showBox,
          deactivationCallback: () => this.onDeactivation()
        };
      }
      this.onEnableSlicing();
      this.slicer.active = true;
      this.sliceEnabled = true;
    }
    this.requestUpdate();
  }

  onDeactivation() {
    let positions = undefined;
    let lowerLimit = undefined;
    let height = undefined;
    if (this.type === 'rectangle') {
      const bbox = this.slicer.slicingTool.bbox;
      const bboxCorners = bbox.corners;
      height = bbox.height;
      lowerLimit = bbox.lowerLimit - bbox.altitude;
      positions = [bboxCorners.bottomLeft, bboxCorners.bottomRight, bboxCorners.topRight, bboxCorners.topLeft];
    }
    this.onDisableSlicing(positions, lowerLimit, height);
    this.sliceEnabled = false;
    this.requestUpdate();
  }

  onShowBoxChange(event) {
    this.showBox = event.target.checked;
    this.slicer.toggleBoxVisibility(this.showBox);
    this.onShowSlicingBoxChange(this.showBox);
  }

  render() {
    if (this.slicer && this.positions.length) {
      return html`
        <div class="ngm-slice-btns-container">
          <div class="ui tiny buttons">
            ${this.sliceEnabled ?
              html`
                <button class="ui button ngm-slice-off-btn"
                        @click=${() => this.toggleSlicer(false)}>
                  ${i18next.t('tbx_disable_slice_btn_label')}
                </button>` :
              html`
                <button class="ui button"
                        @click=${() => this.toggleSlicer(true)}>
                  ${this.type === 'line' ? i18next.t('tbx_slice_btn_label') : i18next.t('tbx_slice_edit_btn_label')}
                  ${this.positions.length > 2 && this.type === 'line' ? html`
                    <i class="exclamation triangle icon ngm-slice-warn">` : ''}
                </button>`}
            <button class="ui button ngm-slice-tools-btn"><i class="tools icon"></i></button>
          </div>
        </div>
        <div class="ui mini popup ngm-slice-tools-popup">
          <label>${i18next.t('tbx_slice_side_label')}</label>
          <div class="ui fluid selection mini dropdown ngm-slice-side">
            <input type="hidden" value="${this.sliceSide}">
            <div class="text"></div>
            <i class="dropdown icon"></i>
            <div class="menu">
              <div class="item" data-value="left">
                ${this.type === 'line' ? i18next.t('tbx_slice_left_label') : i18next.t('tbx_slice_outside_label')}
              </div>
              <div class="item" data-value="right">
                ${this.type === 'line' ? i18next.t('tbx_slice_right_label') : i18next.t('tbx_slice_inside_label')}
              </div>
            </div>
          </div>
          ${this.type === 'rectangle' ? html`
            <div class="ui checkbox">
              <input type="checkbox" @change="${this.onShowBoxChange}">
              <label>${i18next.t('nav_box_show_slice_box')}</label>
            </div>` : ''}
        </div>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-toolbox-slicer', NgmToolboxSlicer);
