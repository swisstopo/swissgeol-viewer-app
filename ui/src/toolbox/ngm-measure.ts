import {customElement, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import ToolboxStore from '../store/toolbox';
import {classMap} from 'lit-html/directives/class-map.js';
import DrawStore from '../store/draw';

@customElement('ngm-measure')
export class NgmMeasure extends LitElementI18n {
    @state() active = false;

    connectedCallback() {
        this.active = true;
        super.connectedCallback();
    }

    disconnectedCallback() {
        if (this.active) {
            ToolboxStore.nextGeometryAction({type: 'line', action: 'clearMeasure'});
            this.active = false;
        }
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
            <div class="ngm-draw-list">
                <div class="ngm-draw-list-item ${classMap({active: this.active})}"
                     @click=${() => {this.active = !this.active;}}>
                    <div class="ngm-line-draw-icon"></div>
                    <div>${i18next.t('tbx_measure_line_label')}</div>
                </div>
                <div class="ngm-draw-hint" .hidden="${!this.active}">
                    ${i18next.t('tbx_measure_hint')}
                    <div class="ngm-info-icon"></div>
                </div>
            </div>`;
    }

    createRenderRoot() {
        return this;
    }
}