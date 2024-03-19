import {customElement, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import {html} from 'lit';
import i18next from 'i18next';
import {dragArea} from './helperElements';
import draggable from './draggable';
import {classMap} from 'lit/directives/class-map.js';
import {getAssets, IonAsset} from '../api-ion';
import MainStore from '../store/main';
import {showSnackbarConfirmation} from '../notifications';
import {getAssetIds} from '../permalink';

@customElement('ngm-ion-modal')
export class NgmIonModal extends LitElementI18n {
    @state()
    accessor token: string | null = MainStore.ionToken.value;
    @state()
    accessor assets: IonAsset[] = [];
    @state()
    accessor errorMessage: string | undefined;
    @state()
    accessor preloader = false;

    connectedCallback() {
        draggable(this, {
            allowFrom: '.drag-handle'
        });
        super.connectedCallback();
    }
    async onLoadAssets() {
        if (!this.token) return;
        this.errorMessage = undefined;
        this.assets = [];
        this.preloader = true;
        const res = await getAssets(this.token);
        if (res.items) {
            MainStore.removeIonAssets();
            MainStore.setIonToken(this.token);
            this.assets = res.items;
        } else {
            this.errorMessage = res.message;
        }
        this.preloader = false;
    }

    loadAssets() {
        if (!this.token) return;
        const currentToken = MainStore.ionToken.value;
        const assets = getAssetIds();
        if (currentToken !== this.token && assets.length) {
            showSnackbarConfirmation(
                i18next.t('dtd_remove_assets_confirmation'),
                {onApprove: () => this.onLoadAssets()}
            );
        } else {
            this.onLoadAssets();
        }
    }

    addAsset(ionAsset: IonAsset) {
        if (!ionAsset?.id) return;
        MainStore.addIonAssetId(ionAsset);
    }

    render() {
        return html`
        <div class="ngm-floating-window-header drag-handle">
          <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
        </div>
        <div class="content-container">
            <div class="ngm-ion-load-container">
                <div class="ngm-input ${classMap({'ngm-input-warning': !this.token && this.token !== null})}">
                    <input type="text" placeholder="required" .value=${this.token || ''}
                           @input=${evt => {
                               this.token = evt.target.value;
                           }}/>
                    <span class="ngm-floating-label">${i18next.t('dtd_ion_token_label')}</span>
                </div>
                <button class="ui button ngm-load-ion-btn ngm-action-btn" @click=${() => this.loadAssets()}>
                    ${this.preloader ? html` <div class="ui loader"></div>` : i18next.t('dtd_load_ion_assets_btn')}
                </button>
            </div>
            <label .hidden=${!this.errorMessage?.length} class="ngm-ion-error">${this.errorMessage}</label>
            <div class="ngm-divider" .hidden=${!this.assets.length}></div>
            <div class="ngm-ion-assets">
                <table class="ui compact small very basic table ngm-info-table" .hidden=${!this.assets.length}>
                    <tbody>
                    <tr class="top aligned">
                        <td class="key">ID</td>
                        <td class="value">${i18next.t('tbx_name_label')}</td>
                        <td></td>
                    </tr>
                    ${this.assets.map(row =>
                            html`
                            <tr class="top aligned">
                                <td class="key">${row.id}</td>
                                <td class="value">${row.description || row.name}</td>
                                <td>
                                    <button class="ui button ngm-add-ion-btn ngm-action-btn" @click=${() => this.addAsset(row)}>
                                        ${i18next.t('dtd_add_ion_asset_btn')}
                                    </button>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        </div>
        ${dragArea}
      `;
    }

    createRenderRoot() {
        // no shadow dom
        return this;
    }
}