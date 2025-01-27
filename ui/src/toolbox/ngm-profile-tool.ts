import { LitElementI18n } from '../i18n';
import { customElement, property, state } from 'lit/decorators.js';
import { html } from 'lit';
import type { NgmGeometry } from './interfaces';
import ToolboxStore from '../store/toolbox';

@customElement('ngm-profile-tool')
export class NgmProfileTool extends LitElementI18n {
  @property({ type: Boolean })
  accessor hidden = true;
  @state()
  accessor selectedGeomId = '';

  constructor() {
    super();
    ToolboxStore.geometryAction.subscribe((options) => {
      if (options.action === 'profile') {
        this.selectedGeomId = options.id || '';
        if (!options.id) ToolboxStore.nextGeometryAction({ action: 'pick' });
      }
    });
    ToolboxStore.openedGeometryOptions.subscribe((options) => {
      if (options?.editing) {
        ToolboxStore.nextGeometryAction({ action: 'profile' });
      }
    });
  }

  onGeomClick(id) {
    if (this.selectedGeomId === id) {
      this.selectedGeomId = '';
      ToolboxStore.nextGeometryAction({ action: 'pick' });
      ToolboxStore.nextGeometryAction({ action: 'profile' });
      return;
    }
    this.selectedGeomId = id;
    ToolboxStore.nextGeometryAction({ id: id, action: 'profile' });
    ToolboxStore.nextGeometryAction({ id: id, action: 'zoom' });
  }

  onGeometryAdded(newGeometries) {
    if (this.hidden) return;
    for (const geom of newGeometries) {
      if (geom.type === 'line') this.onGeomClick(geom.id);
    }
  }

  render() {
    return html` <ngm-draw-section
        ?hidden=${this.hidden}
        .enabledTypes=${['line']}
        .showUpload=${false}
      ></ngm-draw-section>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        .selectedId=${this.selectedGeomId}
        .disabledTypes=${['polygon', 'rectangle', 'point']}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) =>
          this.onGeomClick(evt.detail.id)}
        @geometriesadded=${(evt) =>
          this.onGeometryAdded(evt.detail.newGeometries)}
      >
      </ngm-geometries-list>`;
  }

  createRenderRoot() {
    return this;
  }
}
