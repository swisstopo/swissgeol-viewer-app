import { customElement, property, query, state } from 'lit/decorators.js';
import { css, html } from 'lit';
import { LitElementI18n } from '../../i18n';
import { LayerConfig } from '../../layertree';
import './layer-catalog';
import { Viewer } from 'cesium';
import MainStore from '../../store/main';
import { Subscription } from 'rxjs';
import './options/layer-options';
import { classMap } from 'lit/directives/class-map.js';
import i18next from 'i18next';
import { applyTypography, hostStyles } from '../../styles/theme';

@customElement('ngm-layer-tabs')
export class NgmLayerTabs extends LitElementI18n {
  @property()
  public accessor layers: LayerConfig[] | null = null;

  @property({ type: Function })
  accessor onKmlUpload!: (
    file: File,
    clampToGround: boolean,
  ) => Promise<void> | void;

  @state()
  private accessor activeTab: Tab = Tab.Catalog;

  @state()
  private accessor viewer: Viewer | null = null;

  private readonly subscription = new Subscription();

  //TODO: where is this from exactly?
  @query('.ngm-toast-placeholder')
  accessor toastPlaceholder!: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    this.subscription.add(
      MainStore.viewer.subscribe((viewer) => {
        this.viewer = viewer;
      }),
    );
  }

  readonly render = () => html`
    <div class="tabs">
      ${this.renderTabButton(Tab.Catalog)}
      ${this.renderTabSeparator(Tab.Catalog, Tab.Upload)}
      ${this.renderTabButton(Tab.Upload)}
      ${this.renderTabSeparator(Tab.Upload, Tab.Options)}
      ${this.renderTabButton(Tab.Options)}
    </div>
    <div ?hidden="${this.activeTab !== Tab.Catalog}">
      ${this.renderCatalog()}
    </div>
    <div ?hidden="${this.activeTab !== Tab.Upload}">
      <ngm-layer-upload
        .toastPlaceholder=${this.toastPlaceholder}
      ></ngm-layer-upload>
    </div>
    <div ?hidden="${this.activeTab !== Tab.Options}">
      <ngm-layer-options></ngm-layer-options>
    </div>
  `;

  readonly renderTabButton = (tab: Tab) => html`
    <button
      @click="${() => (this.activeTab = tab)}"
      class="${classMap({ 'is-active': this.activeTab === tab })}"
    >
      ${i18next.t(`dtd_tab_labels.${tab}`)}
    </button>
  `;

  readonly renderTabSeparator = (a: Tab, b: Tab) => html`
    <div
      class="separator ${classMap({
        'is-active': this.activeTab !== a && this.activeTab !== b,
      })}"
    ></div>
  `;

  private readonly renderCatalog = () => html`
    <ngm-layer-catalog .layers=${this.layers}></ngm-layer-catalog>
  `;

  static readonly styles = css`
    ${hostStyles}

    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
    }

    .tabs {
      display: flex;
      justify-content: space-evenly;
      align-items: center;
      background-color: white;
      min-height: 52px;
      border-radius: 4px;
      padding: 6px;
    }

    .tabs > button {
      ${applyTypography('button')};

      color: var(--color-primary);
      background-color: transparent;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      flex: 1;
    }

    .tabs > button.is-active {
      background-color: var(--color-rest-active);
      color: var(--color-text--emphasis--medium);
    }

    .tabs > .separator {
      border: 1px solid #e0e1e4;
      height: 18px;
    }

    .tabs > .separator:not(.is-active) {
      display: none;
    }
  `;
}

enum Tab {
  Catalog = 'catalog',
  Upload = 'upload',
  Options = 'options',
}
