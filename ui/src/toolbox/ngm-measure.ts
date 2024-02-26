import {customElement, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import {classMap} from 'lit-html/directives/class-map.js';
import DrawStore from '../store/draw';
import MainStore from '../store/main';
import MeasureTool from '../geoblocks/cesium-helpers/measure/MeasureTool';
import {DrawInfo} from '../geoblocks/cesium-helpers/draw/CesiumDraw';
import {DEFAULT_AOI_COLOR, GEOMETRY_LINE_ALPHA, HIGHLIGHTED_GEOMETRY_COLOR} from '../constants';
import './ngm-line-info';
import {LineInfo, SegmentInfo} from './interfaces';
import {getSegmentsInfo} from './helpers';

@customElement('ngm-measure')
export class NgmMeasure extends LitElementI18n {
    @state()
    accessor active = false;
    @state()
    accessor lineInfo: LineInfo | undefined;
    private measure: MeasureTool | undefined;
    private integerFormat = new Intl.NumberFormat('de-CH', {
        maximumFractionDigits: 1
    });
    private segments: SegmentInfo[] = [];

    constructor() {
        super();
        MainStore.viewer.subscribe(viewer => {
            if (!viewer) return;
            this.measure = new MeasureTool(viewer, {
                highlightColor: HIGHLIGHTED_GEOMETRY_COLOR,
                lineColor: DEFAULT_AOI_COLOR.withAlpha(GEOMETRY_LINE_ALPHA),
            });
            this.measure.draw.addEventListener('drawinfo', (event) => {
                const info: DrawInfo = (<CustomEvent>event).detail;
                if (info.type === 'line') {
                    if (this.segments.length !== info.distances.length) {
                        this.segments = getSegmentsInfo(info.points, info.distances);
                    }
                    this.lineInfo = {...info, segments: this.segments};
                }
            });
        });
    }

    connectedCallback() {
        this.active = true;
        super.connectedCallback();
    }

    disconnectedCallback() {
        if (this.active) {
            this.active = false;
        }
        super.disconnectedCallback();
    }

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has('active') && this.measure) {
            DrawStore.measureState.next(this.active);
            this.measure.active = this.active;
            if (!this.active) {
                this.lineInfo = undefined;
            }
        }
        super.updated(changedProperties);
    }

    render() {
        return html`
            <div>
                <div class="ngm-action-list-item ${classMap({active: this.active})}">
                    <div class="ngm-action-list-item-header"
                         @click=${() => {
                             this.active = !this.active;
                         }}>
                        <div class="ngm-line-draw-icon"></div>
                        <div>${i18next.t('tbx_measure_line_label')}</div>
                    </div>
                    <div class="ngm-draw-hint" .hidden="${!this.active}">
                        ${i18next.t('tbx_measure_hint')}
                        <div class="ngm-info-icon"></div>
                    </div>
                    <ngm-line-info
                            .hidden="${!this.active}"
                            .lineInfo=${this.lineInfo}>
                    </ngm-line-info>
                </div>
                ${this.lineInfo?.segments.map((segment, indx) => html`
                    <div class="ngm-action-list-item active ngm-measure-segment-info"
                         @mouseenter=${() => this.measure?.highlightSegment(indx)}
                         @mouseleave=${() => this.measure?.removeSegmentHighlight()}>
                        <div class="ngm-measure-segment-title">
                            <div>${i18next.t('tbx_measure_segment_label')} ${indx + 1}</div>
                        </div>
                        <div class="ngm-geom-info-content">
                            <div>
                                <div class="ngm-geom-info-label">
                                    ${i18next.t('obj_info_length_label')}
                                </div>
                                <div class="ngm-geom-info-value">${(segment.length).toFixed(3)} km</div>
                            </div>
                            <div>
                                <div class="ngm-geom-info-label">
                                    ${i18next.t('tbx_measure_easting_label')}
                                </div>
                                <div class="ngm-geom-info-value">${(segment.eastingDiff).toFixed(3)} km</div>
                            </div>
                            <div>
                                <div class="ngm-geom-info-label">
                                    ${i18next.t('tbx_measure_northing_label')}
                                </div>
                                <div class="ngm-geom-info-value">${(segment.northingDiff).toFixed(3)} km</div>
                            </div>
                            <div>
                                <div class="ngm-geom-info-label">
                                    ${i18next.t('tbx_measure_height_label')}
                                </div>
                                <div class="ngm-geom-info-value">${this.integerFormat.format(segment.heightDiff)} m</div>
                            </div>
                        </div>
                    </div>
                `)}
            </div>`;
    }

    createRenderRoot() {
        return this;
    }
}