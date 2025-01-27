import { css, html, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n.js';
import i18next from 'i18next';
import auth from '../../store/auth';
import type { LayerTreeNode } from 'src/layertree';
import $ from 'jquery';
import '../core';
import fomanticTransitionCss from 'fomantic-ui-css/components/transition.css?raw';
import fomanticAccordionCss from 'fomantic-ui-css/components/accordion.css?raw';
import 'fomantic-ui-css/components/transition.js';
import { LayerEvent } from './layer-display';

@customElement('ngm-layer-catalog')
export class NgmLayerCatalog extends LitElementI18n {
  @property({ type: Array })
  accessor layers: LayerTreeNode[] = [];

  @state()
  accessor userGroups: string[] = [];

  constructor() {
    super();
    auth.user.subscribe((user) => {
      this.userGroups = user?.['cognito:groups'] ?? [];
    });
  }

  firstUpdated(): void {
    const { shadowRoot } = this;
    if (shadowRoot == null) {
      return;
    }
    $(shadowRoot.querySelectorAll(':host > .ui.accordion')).accordion({
      duration: 150,
    });
  }

  getCategoryOrLayerTemplate(
    node: LayerTreeNode,
    level: string,
  ): TemplateResult {
    if (node.children) {
      return this.getCategoryTemplate(node, level);
    }
    return this.getLayerTemplate(node);
  }

  getCategoryTemplate(category: LayerTreeNode, level: string): TemplateResult {
    // if it is a restricted layer, the user must be logged in to see it
    const content = category.children
      ?.filter(
        (node) =>
          !(
            node.restricted &&
            !node.restricted.some((g) => this.userGroups.includes(g))
          ),
      )
      .map((node) => this.getCategoryOrLayerTemplate(node, 'second-level'));

    if (!content?.length) return html``;

    return html`
      <div class="category ui accordion">
        <div class="title ${level}">
          <ngm-core-icon icon="dropdown"></ngm-core-icon>
          <label>${i18next.t(category.label)}</label>
        </div>
        <div class="content">${content}</div>
      </div>
    `;
  }

  getLayerTemplate(layer: LayerTreeNode): TemplateResult {
    return html`
      <div
        class="ngm-checkbox ${layer.displayed ? 'active' : ''}"
        @click=${() => {
          this.dispatchEvent(
            new CustomEvent('layer-click', {
              composed: true,
              bubbles: true,
              detail: {
                layer,
              },
            }) satisfies LayerEvent,
          );
        }}
      >
        <input type="checkbox" .checked=${!!layer.visible} />
        <span class="ngm-checkbox-icon"></span>
        <label class=${layer.displayed ? 'displayed' : ''}>
          <i class=${layer.restricted ? 'lock icon' : ''}></i>${i18next.t(
            layer.label,
          )}
        </label>
      </div>
    `;
  }

  render() {
    return html`${this.layers.map((node) =>
      this.getCategoryOrLayerTemplate(node, 'first-level'),
    )}`;
  }

  static readonly styles = css`
    ${unsafeCSS(fomanticTransitionCss)}
    ${unsafeCSS(fomanticAccordionCss)}

    :host, :host * {
      box-sizing: border-box;
    }

    .category.ui.accordion {
      margin-top: 0;
    }

    .category.ui.accordion > .title ~ .content,
    .category.ui.accordion .category.ui.accordion > .title ~ .content {
      padding-top: 0;
    }

    .category > .title {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    label {
      font-family: var(--font);
    }

    .category > .title.active > label,
    .category > .title.active > ngm-core-icon {
      color: var(--color-action);
    }

    .category > .title:hover > label,
    .category > .title:hover > ngm-core-icon {
      color: var(--color-action--light);
    }

    .category > .title > ngm-core-icon {
      color: var(--color-highlight--darker);
    }

    .category > .title.first-level {
      font-weight: 700;
    }

    .category > .title > label {
      cursor: pointer;
      font-size: 14px;
      margin-left: 10px;
    }

    .category > .title:not(.active) > ngm-core-icon {
      transform: rotate(-90deg);
    }

    .ngm-checkbox {
      display: flex;
      align-items: center;
      margin: 0 0 12px 5px;
      cursor: pointer;
    }

    .ngm-checkbox:hover {
      color: var(--color-action--light);
    }

    .ngm-checkbox.active {
      color: var(--color-action);
    }

    .ngm-checkbox > input {
      display: none;
    }

    .ngm-checkbox:hover > .ngm-checkbox-icon {
      border-color: var(--color-action--light);
    }

    .ngm-checkbox > .ngm-checkbox-icon {
      display: inline-block;
      position: relative;
      width: 19px;
      height: 18px;
      border-radius: 2px;
      border: 2px solid var(--ngm-interaction);
      transition: all 0.5s ease;
    }

    .ngm-checkbox > label {
      margin-left: 10px;
      cursor: pointer;
    }

    .ngm-checkbox.active > .ngm-checkbox-icon {
      border-color: var(--color-action);
    }

    .ngm-checkbox input:checked + .ngm-checkbox-icon {
      background-color: var(--color-action);
    }

    .ngm-checkbox.active:hover > .ngm-checkbox-icon {
      background-color: var(--color-action--light);
    }

    .ngm-checkbox > .ngm-checkbox-icon::before {
      box-sizing: content-box;
      content: '';
      top: -2px;
      left: 3px;
      width: 6px;
      height: 12px;
      display: none;
      position: absolute;
      transform: rotate(45deg);
      transition: all 0.5s ease;
      border-right: 2px solid #fff;
      border-bottom: 2px solid #fff;
    }

    .ngm-checkbox input:checked + .ngm-checkbox-icon::before {
      display: block;
    }
  `;
}
