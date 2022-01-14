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
      this.setDownloadLinks();
    }
  }

  profileServiceUrl(format: ProfileServiceFormat) {
    const url = new URL(`https://api3.geo.admin.ch/rest/services/profile.${format}`);
    url.searchParams.set('geom', `{"type":"LineString","coordinates":[[${this.linestring!.map(c => c.slice(0, 2).toString()).join('],[')}]]}`);
    url.searchParams.set('sr', '2056');
    url.searchParams.set('nb_points', '1000');
    return url.toString();
  }

  setDownloadLinks() {
    // get svg source
    const svg = document.getElementById('profile-plot')?.firstChild as Node;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    // add name spaces
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    // add xml declaration
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    // convert svg source to URI data scheme
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);

    // set url value to a element's href attribute
    (document.getElementById('svg-link')! as any).href = url;
  }

  render() {
    return this.hidden ? html`` : html`
    <div class="ngm-floating-window-header drag-handle">
    ${i18next.t('topographic_profile_header')} (${this.name})
      <div class="ngm-close-icon" @click=${() => this.hidden = true}></div>
    </div>
    <div class="content-container">
      <p>${i18next.t('topographic_profile_downloads')}:
        <a href=${this.profileServiceUrl('csv')}>CSV</a>
        <a id="svg-link" download="${this.name}_profile">SVG</a>
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
