import {customElement, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import {classMap} from 'lit-html/directives/class-map.js';
import DrawStore from '../store/draw';
import MainStore from '../store/main';
import MeasureTool from '../measure/MeasureTool';
import {DrawInfo} from '../draw/CesiumDraw';

@customElement('ngm-measure')
export class NgmMeasure extends LitElementI18n {
    @state()
    accessor active = false;
    @state()
    accessor lineInfo = {
        lengthLabel: '0km',
        segments: 0,
        type: 'line'
    };
    private measure: MeasureTool | undefined;

    constructor() {
        super();
        MainStore.viewer.subscribe(viewer => {
            if (!viewer) return;
            this.measure = new MeasureTool(viewer);
            this.measure.draw.addEventListener('drawInfo', (event) => {
                const info: DrawInfo = (<CustomEvent>event).detail;
                if (info.type === 'line') {
                    this.lineInfo = info;
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
                    <div class="ngm-geom-info-content" .hidden="${!this.active}">
                        <div>
                            <div class="ngm-geom-info-label">
                                ${i18next.t('obj_info_length_label')}
                            </div>
                            <div class="ngm-geom-info-value">${this.lineInfo.lengthLabel}</div>
                        </div>
                        <div>
                            <div class="ngm-geom-info-label">${i18next.t('obj_info_number_segments_label')}</div>
                            <div class="ngm-geom-info-value">${this.lineInfo.segments}</div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    createRenderRoot() {
        return this;
    }
}