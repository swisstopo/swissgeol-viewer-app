import {customElement, state} from "lit/decorators.js";
import {LitElementI18n} from "../../../i18n";
import {CustomDataSource, DataSource, DataSourceCollection, Viewer} from "cesium";
import MainStore from "../../../store/main";
import {html} from "lit";
import i18next from "i18next";
import {debounce} from "../../../utils";
import { setExaggeration} from "../../../permalink";
import NavToolsStore from "../../../store/navTools";
import {updateExaggerationForKmlDataSource} from "../../../cesiumutils";
import {classMap} from "lit/directives/class-map.js";


@customElement('ngm-exaggeration-slider')
export class DataUpload extends  LitElementI18n {
  @state()
  accessor viewer: Viewer | null | undefined;
  @state()
  accessor exaggeration: number = 1;
  @state()
  accessor hideExaggeration = false;
  private prevExaggeration: number = 1;

  constructor() {
    super();

    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
      this.exaggeration = this.viewer?.scene.verticalExaggeration ?? 1;
      this.prevExaggeration = this.exaggeration;
      this.viewer?.dataSources.dataSourceAdded.addEventListener((_collection: DataSourceCollection, dataSource: DataSource | CustomDataSource) => {
        if (MainStore.uploadedKmlNames.includes(dataSource.name)) {
          const exaggeration = this.hideExaggeration ? 1 : this.exaggeration;
          updateExaggerationForKmlDataSource(dataSource, exaggeration, 1);
        }
      });
    });
  }

  updateExaggerationForKmls() {
    const exaggeration = this.hideExaggeration ? 1 : this.exaggeration;
    MainStore.uploadedKmlNames.forEach(name => {
      const dataSource = this.viewer?.dataSources.getByName(name)[0];
      updateExaggerationForKmlDataSource(dataSource, exaggeration, this.prevExaggeration);
    });
    this.prevExaggeration = exaggeration;
    this.viewer?.scene.requestRender();
  }

  updateExaggeration(evt: InputEvent) {
    if (this.viewer) {
      if (this.hideExaggeration) {
        this.hideExaggeration = false;
      }
      this.exaggeration = Number((<HTMLInputElement>evt.target).value);
      this.viewer.scene.verticalExaggeration = this.exaggeration;
      // workaround for billboards positioning
      setTimeout(() => this.viewer!.scene.requestRender(), 500);
      setExaggeration(this.exaggeration);
      NavToolsStore.exaggerationChanged.next(this.exaggeration);
    }
  }
  readonly render =() => html`
    <div class="ngm-base-layer">
      <div
        title=${!this.hideExaggeration ? i18next.t('dtd_hide_exaggeration') : i18next.t('dtd_show_exaggeration')}
        class="ngm-layer-icon ${classMap({
          'ngm-visible-icon': !this.hideExaggeration,
          'ngm-invisible-icon': this.hideExaggeration
        })}"
        @click=${() => {
          if (!this.viewer) return;
          this.hideExaggeration = !this.hideExaggeration;
          const exaggeration = this.hideExaggeration ? 1 : this.exaggeration;
          this.viewer.scene.verticalExaggeration = exaggeration;
          this.updateExaggerationForKmls();
          NavToolsStore.exaggerationChanged.next(exaggeration);
          this.viewer.scene.requestRender();
        }}>HIDE</div>
      <div class="ngm-displayed-slider ngm-exaggeration-slider">
        <div>
          <label>${i18next.t('dtd_exaggeration_map')}</label>
          <label>${(this.exaggeration).toFixed()}x</label>
        </div>
        <input type="range"
               class="ngm-slider"
               style="background-image: linear-gradient(to right, var(--ngm-interaction-active), var(--ngm-interaction-active) ${this.exaggeration * 5}%, white ${this.exaggeration * 5}%)"
               min=1 max=20 step=1
               .value=${!isNaN(this.exaggeration) ? this.exaggeration : 1}
               @input=${(evt: InputEvent) => this.updateExaggeration(evt)}
               @pointerup=${debounce(() => this.updateExaggerationForKmls(), 300)}>
      </div>
    </div>



  `


}
