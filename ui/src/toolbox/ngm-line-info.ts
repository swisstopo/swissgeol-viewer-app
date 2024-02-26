import {LitElementI18n} from '../i18n';
import {html} from 'lit';
import i18next from 'i18next';
import {customElement, property} from 'lit/decorators.js';
import {LineInfo} from './interfaces';

const DEFAULT_LINE_INFO: LineInfo = {
    length: 0,
    numberOfSegments: 0,
    segments: [],
    type: 'line',
    drawInProgress: false
};

@customElement('ngm-line-info')
export class NgmLineInfo extends LitElementI18n {
    @property({type: Object})
    accessor lineInfo: LineInfo | undefined;
    render() {
        if (!this.lineInfo) this.lineInfo = DEFAULT_LINE_INFO;
        return html`
            <div class="ngm-geom-info-content">
                <div>
                    <div class="ngm-geom-info-label">
                        ${this.lineInfo.drawInProgress ? i18next.t('tbx_length_of_last_segment_label') : i18next.t('obj_info_length_label')}
                    </div>
                    <div class="ngm-geom-info-value">${this.lineInfo.length.toFixed(3)} km</div>
                </div>
                <div>
                    <div class="ngm-geom-info-label">${i18next.t('obj_info_number_segments_label')}</div>
                    <div class="ngm-geom-info-value">${this.lineInfo.numberOfSegments}</div>
                </div>
            </div>`;
    }

    createRenderRoot() {
        return this;
    }
}