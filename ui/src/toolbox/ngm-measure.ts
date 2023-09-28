import {customElement, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import ToolboxStore from '../store/toolbox';
import {classMap} from 'lit-html/directives/class-map.js';
import DrawStore from '../store/draw';
import {Subscription} from 'rxjs';

@customElement('ngm-measure')
export class NgmMeasure extends LitElementI18n {
    @state() active = false;
    @state() lineInfo = DrawStore.lineInfo.value;
    private lineInfoSubscription: Subscription | undefined;

    connectedCallback() {
        this.active = true;
        this.lineInfoSubscription =
            DrawStore.lineInfo.subscribe(value => this.lineInfo = value);
        super.connectedCallback();
    }

    disconnectedCallback() {
        if (this.active) {
            ToolboxStore.nextGeometryAction({type: 'line', action: 'clearMeasure'});
            this.active = false;
        }
        this.lineInfoSubscription?.unsubscribe();
        super.disconnectedCallback();
    }

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has('active')) {
            DrawStore.measureState.next(this.active);
            if (this.active) {
                ToolboxStore.nextGeometryAction({type: 'line', action: 'measure'});
            } else {
                ToolboxStore.nextGeometryAction({type: 'line', action: 'clearMeasure'});
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