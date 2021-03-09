import {html} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../../i18n.js';
import $ from '../../jquery';
import '../ngm-i18n-content.js';
import {Cartographic} from 'cesium';

class NgmToolboxSlicer extends LitElementI18n {

  static get properties() {
    return {
      slicer: {type: Object},
      positions: {type: Array},
      lowerLimit: {type: Number},
      height: {type: Number},
      type: {type: String},
      onEnableSlicing: {type: Function},
      onDisableSlicing: {type: Function}
    };
  }

  constructor() {
    super();

    /**
     * @type {Slicer}
     */
    this.slicer;

    this.sliceSide = 'left';
    this.sliceEnabled = false;
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
      const bboxCorners = this.slicer.slicingTool.bbox.corners;
      const bboxCenter = Cartographic.fromCartesian(this.slicer.slicingTool.bbox.center);
      height = this.slicer.slicingTool.bbox.height;
      lowerLimit = bboxCenter.height - (height / 2);
      positions = [bboxCorners.bottomLeft, bboxCorners.bottomRight, bboxCorners.topRight, bboxCorners.topLeft];
    }
    this.onDisableSlicing(positions, lowerLimit, height);
    this.sliceEnabled = false;
    this.requestUpdate();
  }

  render() {
    if (this.slicer && this.positions.length) {
      return html`
        <div class="ngm-slice-btns-container">
          <div class="ui tiny buttons">
            ${this.sliceEnabled ?
              html`
                <button class="ui button"
                        @click=${() => this.toggleSlicer(false)}>
                  ${i18next.t('tbx_disable_slice_btn_label')}
                </button>` :
              html`
                <button class="ui button ngm-slice-btn"
                        @click=${() => this.toggleSlicer(true)}>
                  ${this.type === 'line' ? i18next.t('tbx_slice_btn_label') : i18next.t('tbx_slice_edit_btn_label')}
                  ${this.positions.length > 2 && this.type === 'line' ? html`
                    <i class="exclamation triangle icon ngm-slice-warn">` : ''}
                </button>`}
            ${this.type === 'line' ?
              html`<button class="ui button ngm-slice-tools-btn"><i class="tools icon"></i></button>` : ''}
          </div>
        </div>
        <div class="ui mini popup ngm-slice-tools-popup">
          <label>${i18next.t('tbx_slice_side_label')}</label>
          <div class="ui fluid selection mini dropdown ngm-slice-side">
            <input type="hidden" value="${this.sliceSide}">
            <div class="text"></div>
            <i class="dropdown icon"></i>
            <div class="menu">
              <div class="item" data-value="left">${i18next.t('tbx_slice_left_label')}</div>
              <div class="item" data-value="right">${i18next.t('tbx_slice_right_label')}</div>
            </div>
          </div>
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
