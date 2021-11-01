import {customElement, html, property, TemplateResult} from 'lit-element';
import {LitElementI18n} from '../i18n.js';
import i18next from 'i18next';
import auth from '../store/auth';
import {LayerTreeNode} from '../layertree';

@customElement('ngm-catalog')
export class Catalog extends LitElementI18n {
  @property({type: Array}) userGroups: string[] = [];
  @property({type: Array}) layers: LayerTreeNode[] = [];

  constructor() {
    super();
    auth.user.subscribe((user) => {
      this.userGroups = user?.['cognito:groups'] ?? [];
    });
  }

  getCategoryOrLayerTemplate(node: LayerTreeNode, level: string): TemplateResult {
    if (node.children) {
      return this.getCategoryTemplate(node, level);
    }
    return this.getLayerTemplate(node);
  }

  getCategoryTemplate(category: LayerTreeNode, level: string): TemplateResult {
    // if it is a restricted layer, the user must be logged in to see it
    const content = category.children?.filter(
      node => !(node.restricted && (!this.userGroups.includes(node.restricted)))
      ).map(node => this.getCategoryOrLayerTemplate(node, 'second-level'));

    return html`
      <div class="ui accordion ngm-layers-categories">
        <div class="title ngm-layer-title ${level}">
          <div class="ngm-dropdown-icon"></div>
          <label>${i18next.t(category.label)}</label>
        </div>
        <div class="content ngm-layer-content">
          ${content}
        </div>
      </div>
    `;
  }

  getLayerTemplate(layer: LayerTreeNode): TemplateResult {
    return html`
      <div class="ui checkbox ngm-displayed-container" @click=${() => {
        this.dispatchEvent(new CustomEvent('layerclick', {
          detail: {
            layer
          }
        }));
      }}>
        <input
          class="ngm-layer-checkbox"
          type="checkbox"
          .checked=${!!layer.visible}>
        <label class=${layer.displayed ? 'displayed' : ''}>
          <i class=${layer.restricted ? 'lock icon' : ''}></i>${i18next.t(layer.label)}
        </label>
      </div>
    `;
  }

  render() {
    return html`${this.layers.map(node => this.getCategoryOrLayerTemplate(node, 'first-level'))}`;
  }

  createRenderRoot() {
    return this;
  }
}
