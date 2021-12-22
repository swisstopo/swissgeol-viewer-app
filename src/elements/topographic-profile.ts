import {LitElementI18n} from '../i18n.js';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import i18next from 'i18next';
import draggable from './draggable';
import ToolboxStore from '../store/toolbox';
import {cartesianToLv95} from '../projection';
import * as d3 from 'd3';

import type {GeometryAction} from '../store/toolbox';

type ProfileServiceFormat = 'json' | 'csv'

@customElement('topographic-profile')
export class TopographicProfile extends LitElementI18n {
  @state() hidden = true;
  private coords: number[][] | undefined;
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
      this.coords = geom!.positions.map(c => cartesianToLv95(c));
      this.name = geom!.name;
      this.hidden = false;
      await this.updateComplete;
      this.plotProfile();
    }
  }

  profileServiceUrl(format: ProfileServiceFormat) {
    const url = new URL(`https://api3.geo.admin.ch/rest/services/profile.${format}`);
    url.searchParams.set('geom', `{"type":"LineString","coordinates":[[${this.coords!.map(c => c.slice(0, 2).toString()).join('],[')}]]}`);
    url.searchParams.set('sr', '2056');
    url.searchParams.set('nb_points', '1000');
    return url.toString();
  }


  plotProfile() {
    // set the dimensions and margins of the graph
    const margin = {top: 10, right: 10, bottom: 40, left: 60};
    const width = 900 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    // append the svg object
    const svg = d3.select('#profile-plot')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    d3.json(this.profileServiceUrl('json')).then(data => {
      // Add X axis
      const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.dist / 1000))
        .range([0, width]);
      svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(x));

      // Add Y axis
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.alts.DTM2)])
        .range([height, 0]);
      svg.append('g')
        .call(d3.axisLeft(y));

      // Add X axis label
      svg.append('text')
        .attr('text-anchor', 'end')
        .attr('x', width / 2 + margin.left)
        .attr('y', height + margin.top + 20)
        .text('Distance [km]');

      // Add Y axis label
      svg.append('text')
        .attr('text-anchor', 'end')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -margin.top)
        .text('Elevation [m]');

      // Add the area
      svg.append('path')
        .datum(data)
        .attr('fill', '#FF0000')
        .attr('stroke', '#B9271A')
        .attr('stroke-width', 1.5)
        .attr('d', d3.area()
          .x(d => x(d.dist / 1000))
          .y1(d => y(d.alts.DTM2))
          .y0(y(0))
        );
    });
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
