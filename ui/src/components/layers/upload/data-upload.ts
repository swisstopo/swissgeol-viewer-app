import {customElement, property} from "lit/decorators.js";
import {LitElementI18n} from "../../../i18n";
import {html} from "lit";
import i18next from "i18next";
import '../../../layers/ngm-layers-upload';


@customElement('ngm-data-upload')
export class DataUpload extends  LitElementI18n {
  @property({type: Object})
  accessor toastPlaceholder!: HTMLElement;

  @property({type: Function})
  accessor onKmlUpload!: (file: File, clampToGround: boolean) => Promise<void> | void;

  private openIonModal(): void {
    this.dispatchEvent(new CustomEvent('openIonModal', {
      bubbles: true,
      composed: true,
    }));
  }
  readonly render =() => html` <ngm-layers-upload
          .toastPlaceholder=${this.toastPlaceholder}
          .onKmlUpload=${this.onKmlUpload}>
        </ngm-layers-upload>
        <button
          class="ui button ngm-ion-add-content-btn ngm-action-btn"
          @click=${this.openIonModal}
        >
          ${i18next.t('dtd_add_ion_token')}
        </button>`
}
