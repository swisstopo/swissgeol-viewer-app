import {LitElementI18n} from '../i18n.js';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import i18next from 'i18next';
import draggable from './draggable';
import ToolboxStore from '../store/toolbox';
import {cartesianToLv95} from '../projection';
import {plotProfile} from '../graphs';

import type {GeometryAction} from '../store/toolbox';

type ProfileServiceFormat = 'json' | 'csv'

@customElement('topographic-profile')
export class TopographicProfile extends LitElementI18n {
  @state() hidden = true;
  private linestring: number[][] | undefined;
  private profile: number[][] | undefined;
  private name: string | undefined;

  constructor() {
    super();
    super.hidden = this.hidden;
    ToolboxStore.geometryAction.subscribe(options => this.handleActions(options));
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  update(changedProperties) {
    if (changedProperties.has('hidden')) {
      super.hidden = this.hidden;
    }
    super.update(changedProperties);
  }

  async handleActions(options: GeometryAction) {
    if (options.action === 'profile') {
      const geom = ToolboxStore.geometries.getValue().find(geom => geom.id === options.id);
      this.linestring = geom!.positions.map(c => cartesianToLv95(c));
      this.name = geom!.name;

      this.profile = await fetch(this.profileServiceUrl('json')).then(
        respnse => respnse.json()).then(
          data => data.map(record => [record.dist, record.alts.DTM2]));

      this.hidden = false;
      await this.updateComplete;
      plotProfile(this.profile!);
    }
  }

  profileServiceUrl(format: ProfileServiceFormat) {
    const url = new URL(`https://api3.geo.admin.ch/rest/services/profile.${format}`);
    url.searchParams.set('geom', `{"type":"LineString","coordinates":[[${this.linestring!.map(c => c.slice(0, 2).toString()).join('],[')}]]}`);
    url.searchParams.set('sr', '2056');
    url.searchParams.set('nb_points', '1000');
    return url.toString();
  }

  render() {
    return this.hidden ? html`` : html`
    <div class="ngm-floating-window-header drag-handle">
    ${i18next.t('topographic_profile_header')} (${this.name})
      <div class="ngm-close-icon" @click=${() => this.hidden = true}></div>
    </div>
    <div class="content-container">
      <p>
        <a href=${this.profileServiceUrl('csv')}>CSV</a>
      </p>
      <div id="profile-plot"></div>
    </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
