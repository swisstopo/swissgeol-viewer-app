import { customElement, property } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n';
import { html } from 'lit';
import i18next from 'i18next';
import { NgmGeometry } from '../../toolbox/interfaces';
import '../../toolbox/ngm-geometries-simple-list';

@customElement('ngm-project-geoms-section')
export class NgmProjectGeomsSection extends LitElementI18n {
  @property({ type: Boolean })
  accessor viewMode = false;
  @property({ type: Array })
  accessor geometries: NgmGeometry[] = [];

  render() {
    return html` <div>
      <div class="ngm-proj-title-icon">
        <div class="ngm-vector-icon"></div>
        <div>${i18next.t('dashboard_project_geometries')}</div>
      </div>
      <div class="project-edit-fields">
        ${this.geometries?.length
          ? html` <ngm-geometries-simple-list
              .viewMode=${this.viewMode}
              .geometries="${this.geometries}"
              .hideMapInteractionButtons=${true}
              .directNameEdit=${!this.viewMode}
            >
            </ngm-geometries-simple-list>`
          : html` <div>${i18next.t('dashboard_no_geom_text')}</div>`}
      </div>
    </div>`;
  }

  createRenderRoot() {
    return this;
  }
}
