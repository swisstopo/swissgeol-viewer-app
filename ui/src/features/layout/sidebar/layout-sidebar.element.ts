import i18next from 'i18next';
import { css, html, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import { SidebarPanel } from 'src/features/layout/layout.model';
import 'src/ngm-app-settings';
import { LayerService } from 'src/features/layer/layer.service';
import { consume } from '@lit/context';
import { until } from 'lit/directives/until.js';
import ToolboxStore from 'src/store/toolbox';
import 'src/toolbox/ngm-toolbox';
import 'src/elements/dashboard/ngm-dashboard';
import 'src/elements/ngm-share-link';
import { LexicFilterService } from 'src/features/lexic';

@customElement('ngm-layout-sidebar')
export class LayoutSidebar extends CoreElement {
  @state()
  accessor activePanel: SidebarPanel | null = null;

  @state()
  accessor countOfLayers = 0;

  @state()
  accessor countOfLexicLayers = 0;

  @state()
  accessor countOfGeometries = 0;

  @state()
  accessor isLexicOpen = false;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @consume({ context: LexicFilterService.context() })
  accessor filterService!: LexicFilterService;

  private promise: Promise<unknown> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.role = 'navigation';

    this.register(
      this.layerService.activeLayerIds$.subscribe((ids) => {
        this.countOfLayers = ids.length;
      }),
    );

    this.register(
      ToolboxStore.geometries.subscribe((geometries) => {
        this.countOfGeometries = geometries.length;
      }),
    );

    this.register(
      this.filterService.isOpen$.subscribe((isOpen) => {
        this.isLexicOpen = isOpen;
        if (isOpen) {
          this.ensureLexicModuleLoaded();
        }
      }),
    );
  }

  private readonly handlePanelActivation = (
    event: CustomEvent<{ panel: SidebarPanel }>,
  ) => {
    this.activePanel = event.detail.panel;
    switch (this.activePanel) {
      case SidebarPanel.Layers:
        this.promise =
          customElements.get('ngm-catalog') === undefined
            ? import('src/features/catalog/catalog.module')
            : null;
        break;
      default:
        this.promise = null;
    }
  };

  private readonly handleLexicToggle = () => {
    this.filterService.toggle();
  };

  private ensureLexicModuleLoaded(): void {
    if (customElements.get('ngm-lexic-filter-panel') === undefined) {
      void import('src/features/lexic/lexic.module');
    }
  }

  private readonly handlePanelDeactivation = (
    event: CustomEvent<{ panel: SidebarPanel }>,
  ) => {
    if (this.activePanel === event.detail.panel) {
      this.closePanel();
    }
  };

  private readonly closePanel = () => {
    this.activePanel = null;
  };

  // We currently do not get around to keeping this component open,
  // as it holds multiple open components that heavily rely on global css and js behavior.
  // If we ever get to refactor these nested components (first and foremost, the toolbox), we can remove this,
  // alongside the awkward css handling we are doing in here.
  createRenderRoot() {
    return this;
  }

  updated(): void {
    requestAnimationFrame(() => {
      const panel = this.querySelector('ngm-navigation-panel');
      document.body.style.setProperty(
        '--sidebar-offset',
        `${panel?.getBoundingClientRect().width ?? 0}px`,
      );
    });
  }

  readonly render = () => html`
    <!-- Inject the "local" styles as global, as we currently disable the shadow dom on this component. -->
    <style>
      ${LayoutSidebar.stylesAsGlobal.cssText}
    </style>

    ${this.renderItems()}
    <ngm-navigation-panel
      ?open="${this.activePanel !== null}"
      .size="${this.activePanel === SidebarPanel.Projects ? 'large' : 'normal'}"
    >
      <ngm-navigation-panel-header closeable @close="${this.closePanel}">
        ${i18next.t(`layout:items.${this.activePanel}`)}
      </ngm-navigation-panel-header>
      ${this.renderPanel()}
    </ngm-navigation-panel>
    ${this.isLexicOpen
      ? html`<ngm-lexic-filter-panel></ngm-lexic-filter-panel>`
      : ''}
  `;

  private readonly renderItems = () => html`
    <ul>
      ${this.renderItem({
        panel: SidebarPanel.Layers,
        icon: 'layer',
        counter: this.countOfLayers,
      })}
      <li>
        <ngm-layout-sidebar-item
          .panel="${SidebarPanel.Lexic}"
          data-cy="Lexic"
          icon="lexic"
          .counter="${this.countOfLexicLayers}"
          ?active="${this.isLexicOpen}"
          @activate="${this.handleLexicToggle}"
          @deactivate="${this.handleLexicToggle}"
        ></ngm-layout-sidebar-item>
      </li>
      ${this.renderItem({
        panel: SidebarPanel.Tools,
        icon: 'tools',
        counter: this.countOfGeometries,
      })}
      ${this.renderItem({
        panel: SidebarPanel.Share,
        icon: 'share',
      })}
    </ul>
    <ul>
      ${this.renderItem({
        panel: SidebarPanel.Settings,
        icon: 'config',
      })}
    </ul>
  `;

  private readonly renderItem = (options: {
    panel: SidebarPanel;
    icon: string;
    counter?: number;
  }) => html`
    <li>
      <ngm-layout-sidebar-item
        .panel="${options.panel}"
        data-cy="${options.panel}"
        icon="${options.icon}"
        .counter="${options.counter ?? 0}"
        ?active="${options.panel === this.activePanel}"
        @activate="${this.handlePanelActivation}"
        @deactivate="${this.handlePanelDeactivation}"
      ></ngm-layout-sidebar-item>
    </li>
  `;

  private readonly renderPanel = () => {
    // These are panels that need to stay rendered even if they are not displayed.
    // This is due to two reasons:
    //
    //   1. They create global objects and/or subscriptions that are not cleaned up when the panel itself is removed,
    //      meaning that removing and re-adding the panels will cause state duplications.
    //   2. They create and manage global state (such as viewer data sources) that is in use by other parts of the application.
    //
    // Ideally, we will get to refactor these at some point, so we do not need to render more than necessary.
    // Additionally, tying global state to semi-permanent ui is kind of bad for readability,
    // separation of concerns and other stuff, so getting rid of these panels will help the rest of the application too.
    const staticPanels = html`
      <ngm-tools
        ?hidden="${this.activePanel !== SidebarPanel.Tools}"
      ></ngm-tools>
      <ngm-dashboard
        ?hidden=${this.activePanel !== SidebarPanel.Projects}
      ></ngm-dashboard>
    `;

    const render = () => {
      this.promise = null;
      switch (this.activePanel) {
        case SidebarPanel.Layers:
          return html`<ngm-catalog></ngm-catalog>`;
        case SidebarPanel.Share:
          return html`<ngm-share-link></ngm-share-link>`;
        case SidebarPanel.Settings:
          return html` <ngm-app-settings></ngm-app-settings>`;
        case SidebarPanel.Projects:
        case SidebarPanel.Tools:
        case null:
          return undefined;
        default:
          return undefined;
      }
    };

    const panel =
      this.promise == null
        ? render()
        : until(
            this.promise.then(render),
            html`<ngm-core-loader></ngm-core-loader>`,
          );

    return html`
      <div class="content">${panel}</div>
      ${staticPanels}
    `;
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      padding: 12px 6px 2px 6px;

      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    ngm-navigation-panel {
      position: absolute;
      top: 0;
      left: 80px;
    }

    ngm-navigation-panel:not([open]) {
      display: none;
    }

    ngm-navigation-panel > .content {
      padding: 16px;

      height: calc(var(--panel-height) - var(--panel-header-height));
    }

    ngm-navigation-panel > .content:empty {
      display: none;
    }
  `;

  // This transforms the `styles` value into a globally usable css.
  // This should be safe, with the caveat that nested, non-shadow-dom components may be affected by the styles.
  private static readonly stylesAsGlobal = css`
    ngm-layout-sidebar {
      ${unsafeCSS(LayoutSidebar.styles.cssText.replaceAll(':host', '&'))}
    }

    /* Old panel styles. */
    /* Can be removed once all panels have been redesigned. */
    .ngm-panel-header {
      height: var(--ngm-panel-header-height);
      border-bottom: 2px solid #dfe2e6;
      display: flex;
      align-items: center;
      font:
        normal normal bold 14px/20px Inter,
        sans-serif;
      color: #212529;
    }

    .ngm-panel-header .ngm-close-icon {
      width: 24px;
      height: 24px;
      background-color: #000000;
      margin-left: auto;
    }

    .ngm-panel-header .ngm-close-icon:hover {
      background-color: var(--ngm-action-hover);
    }
  `;
}
