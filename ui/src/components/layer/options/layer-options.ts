import { customElement, state } from 'lit/decorators.js';
import { LitElementI18n } from '../../../i18n';
import {
  CustomDataSource,
  DataSource,
  DataSourceCollection,
  Viewer,
} from 'cesium';
import MainStore from '../../../store/main';
import { css, html } from 'lit';
import i18next from 'i18next';
import { debounce } from '../../../utils';
import { setExaggeration } from '../../../permalink';
import NavToolsStore from '../../../store/navTools';
import { updateExaggerationForKmlDataSource } from '../../../cesiumutils';
import '../../core';
import { SliderValueChangeEvent } from '../../core/core-slider';

@customElement('ngm-layer-options')
export class NgmLayerOptions extends LitElementI18n {
  @state()
  private accessor viewer: Viewer | null | undefined;

  @state()
  private accessor exaggeration: number = 1;

  @state()
  private accessor hideExaggeration = false;

  private prevExaggeration: number = 1;

  constructor() {
    super();
    MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
      this.exaggeration = this.viewer?.scene.verticalExaggeration ?? 1;
      this.prevExaggeration = this.exaggeration;
      this.viewer?.dataSources.dataSourceAdded.addEventListener(
        (
          _collection: DataSourceCollection,
          dataSource: DataSource | CustomDataSource,
        ) => {
          if (MainStore.uploadedKmlNames.includes(dataSource.name)) {
            const exaggeration = this.hideExaggeration ? 1 : this.exaggeration;
            updateExaggerationForKmlDataSource(dataSource, exaggeration, 1);
          }
        },
      );
    });
  }

  private toggleExaggerationVisibility() {
    if (!this.viewer) {
      return;
    }
    this.hideExaggeration = !this.hideExaggeration;
    const exaggeration = this.hideExaggeration ? 1 : this.exaggeration;
    this.viewer.scene.verticalExaggeration = exaggeration;
    this.updateExaggerationForKmls();
    NavToolsStore.exaggerationChanged.next(exaggeration);
    this.viewer.scene.requestRender();
  }

  private updateExaggerationForKmls() {
    const exaggeration = this.hideExaggeration ? 1 : this.exaggeration;
    MainStore.uploadedKmlNames.forEach((name) => {
      const dataSource = this.viewer?.dataSources.getByName(name)[0];
      updateExaggerationForKmlDataSource(
        dataSource,
        exaggeration,
        this.prevExaggeration,
      );
    });
    this.prevExaggeration = exaggeration;
    this.viewer?.scene.requestRender();
  }

  private updateExaggeration(event: SliderValueChangeEvent) {
    if (this.viewer == null) {
      return;
    }
    this.hideExaggeration = false;
    this.exaggeration = event.detail.value;
    this.viewer.scene.verticalExaggeration = this.exaggeration;
    // workaround for billboards positioning
    setTimeout(() => this.viewer!.scene.requestRender(), 500);
    setExaggeration(this.exaggeration);
    NavToolsStore.exaggerationChanged.next(this.exaggeration);
  }

  readonly render = () => html`
    <div class="group">
      <ngm-core-icon
        icon="${this.hideExaggeration ? 'invisible' : 'visible'}"
        title=${this.hideExaggeration
          ? i18next.t('dtd_show_exaggeration')
          : i18next.t('dtd_hide_exaggeration')}
        @click=${this.toggleExaggerationVisibility}
      ></ngm-core-icon>
      <label>${i18next.t('dtd_exaggeration_map')}</label>
    </div>
    <hr />
    <div class="group">
      <ngm-core-slider
        .min="${1}"
        .max="${20}"
        .step="${1}"
        .value="${this.exaggeration}"
        @change=${this.updateExaggeration}
        @pointerup="${debounce(() => this.updateExaggerationForKmls(), 300)}"
      ></ngm-core-slider>
      <div class="chip-container">
        <ngm-core-chip>${this.exaggeration.toFixed()}x</ngm-core-chip>
      </div>
    </div>
  `;

  static readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      background-color: var(--color-bg--white);
      box-sizing: border-box;
      border: 1px solid var(--color-border--default);
      border-radius: 4px;
    }

    ngm-core-icon {
      padding: 6px;
      color: var(--color-primary);
    }

    hr {
      margin: 0 10px;
      height: 1px;
      border-width: 0;
      color: var(--color-border--default);
      background-color: var(--color-border--default);
    }

    .group {
      display: flex;
      justify-content: flex-start;
      gap: 6px;
      align-items: center;
      margin: 10px;
    }

    .chip-container {
      min-width: 48px;
      display: flex;
      justify-content: flex-end;
    }
  `;
}
