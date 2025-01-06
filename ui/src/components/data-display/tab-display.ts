import {customElement, property, query, state} from 'lit/decorators.js';
import {css, html} from 'lit';
import {LitElementI18n} from '../../i18n';
import {LayerConfig} from '../../layertree';
import '../layers/layers-catalog';
import {Viewer} from 'cesium';
import MainStore from '../../store/main';
import {Subscription} from 'rxjs';
import './tabs/exaggeration-slider';
import {classMap} from 'lit/directives/class-map.js';

@customElement('ngm-tab-display')
export class DataUpload extends LitElementI18n {
  @property()
  public accessor layers: LayerConfig[] | null = null

  @property({type: Function})
  accessor onKmlUpload!: (file: File, clampToGround: boolean) => Promise<void> | void

  @state()
  private accessor activeTab: Tab = Tab.Catalog

  @state()
  private accessor viewer: Viewer | null = null

  private readonly subscription = new Subscription();

  //TODO: where is this from exactly?
  @query('.ngm-side-bar-panel > .ngm-toast-placeholder')
  accessor toastPlaceholder!: HTMLElement

  connectedCallback() {
    super.connectedCallback();
    this.subscription.add(MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
    }));
  }

  readonly render = () => html`
    <div class="container">
      <div class="tabs">
        <button @click="${() => this.activeTab = Tab.Catalog}"
                class="${classMap({'active': this.activeTab === Tab.Catalog})}">Katalog
        </button>
        <div class="${classMap({'hide-border': this.activeTab !== Tab.Exaggeration})}"></div>
        <button @click="${() => this.activeTab = Tab.Upload}"
                class="${classMap({'active': this.activeTab === Tab.Upload})} center">Upload
        </button>
        <div class="${classMap({'hide-border': this.activeTab !== Tab.Catalog})}"></div>
        <button @click="${() => this.activeTab = Tab.Exaggeration}"
                class="${classMap({'active': this.activeTab === Tab.Exaggeration})}">Einstellungen
        </button>
      </div>
      <div ?hidden="${this.activeTab !== Tab.Catalog}">
        ${this.renderCatalog()}
      </div>
      <div ?hidden="${this.activeTab !== Tab.Upload}">
        <ngm-layers-upload
          .toastPlaceholder=${this.toastPlaceholder}
        ></ngm-layers-upload>
      </div>
      <div ?hidden="${this.activeTab !== Tab.Exaggeration}">
        <ngm-exaggeration-slider></ngm-exaggeration-slider>
      </div>
    </div>
  `;

  private readonly renderCatalog = () => html`
    <ngm-layers-catalog
      .layers=${this.layers}
    ></ngm-layers-catalog>
  `;

  static readonly styles = css`
    .container {
      padding: 16px
    }

    .tabs {
      display: flex;
      justify-content: space-evenly;
      align-items: center;
      background-color: white;
      height: 52px;
      border-radius: 4px;
      padding: 0 6px;
    }

    .tabs > button {
      background-color: transparent;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      height: 40px;
      flex: 1;
      color: var(--color-main);
      font-family: var(--font);
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
    }

    .tabs > button.active {
      background-color: var(--color-rest-active);
      color: var(--color-medium-emphasis);
    }

    .tabs > div {
      border: 1px solid #E0E1E4;
      height: 18px;
    }

    .tabs > div.hide-border {
      border-color: transparent;
    }
  `;
}

enum Tab {
  Catalog,
  Upload,
  Exaggeration
}
