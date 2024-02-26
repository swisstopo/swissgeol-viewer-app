import {LitElementI18n} from '../i18n.js';
import {html} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import i18next from 'i18next';
import draggable from '../elements/draggable';
import type {GeometryAction} from '../store/toolbox';
import ToolboxStore from '../store/toolbox';
import {cartesianToLv95} from '../projection';
import {plotProfile} from '../graphs';
import {pointer} from 'd3-selection';
import MainStore from '../store/main';
import type {Viewer} from 'cesium';
import {Color, HeightReference, CallbackProperty, Cartesian3, Entity} from 'cesium';
import {getPointOnPolylineByRatio} from '../geoblocks/cesium-helpers/cesiumutils';
import type {NgmGeometry} from './interfaces';
import {styleMap} from 'lit/directives/style-map.js';
import {bisector} from 'd3-array';

type ProfileServiceFormat = 'json' | 'csv'

export type ProfileData = {
  alts: {
    COMB: number,
    DTM2: number,
    DTM25: number
  },
  dist: number,
  domainDist: number,
  easting: number,
  northing: number
}

@customElement('ngm-topo-profile-modal')
export class NgmTopoProfileModal extends LitElementI18n {
  @state()
  accessor hidden = true;
  @state()
  accessor tooltipData = {
    position: {left: '0px', top: '0px'},
    values: {dist: '0 m', elev: '0 m'}
  };
  @state()
  accessor showTooltip = false;
  @query('.ngm-profile-plot')
  accessor profilePlot;
  @query('.svg-link')
  accessor svgLink;
  @query('.ngm-profile-tooltip')
  accessor profileTooltip;
  private viewer: Viewer | null | undefined;
  private bisect = bisector((d) => d.domainDist).left;
  private linestring: number[][] | undefined;
  private data: ProfileData[] = [];
  private name: string | undefined;
  private profileInfo: any | undefined;
  private domain: any;
  private distInKM = false;
  private highlightPointPosition: Cartesian3 = new Cartesian3();
  private highlightPoint = new Entity({
    position: <any> new CallbackProperty(() => this.highlightPointPosition, false),
    point: {
      show: new CallbackProperty(() => this.showTooltip, false),
      color: Color.WHITE,
      outlineWidth: 1,
      outlineColor: Color.BLACK,
      pixelSize: 9,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  });

  constructor() {
    super();
    super.hidden = this.hidden;
    ToolboxStore.geometryAction.subscribe(options => this.handleActions(options));
    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
      if (viewer) viewer.entities.add(this.highlightPoint);
    });
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
      this.hidden = true;
      if (!options.id) return;
      const geom: NgmGeometry | undefined = ToolboxStore.geometries.getValue().find(geom => geom.id === options.id);
      if (!geom) return;
      this.linestring = geom.positions.map(c => cartesianToLv95(c));
      this.name = geom.name;

      this.data = await fetch(this.profileServiceUrl('json')).then(
        respnse => respnse.json()).then(
        data => {
          this.distInKM = data[data.length - 1].dist >= 10000;
          const denom = this.distInKM ? 1000 : 1;
          return data.map(record => {
            return {...record, domainDist: record.dist / denom};
          });
        });
      const denom = this.distInKM ? 1000 : 1;
      let totalDist = 0;
      const extremPoints = geom.positions.map((pos, indx) => {
        totalDist += indx === 0 ? 0 : Cartesian3.distance(geom.positions[indx - 1], pos) / denom;
        return {dist: totalDist, position: this.linestring![indx]};
      });

      this.hidden = false;
      await this.updateComplete;
      this.profileInfo = plotProfile(this.data, extremPoints, this.profilePlot, this.distInKM);
      this.domain = this.profileInfo.domain;

      this.attachPathListeners(geom);
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
    const svg = this.profilePlot?.firstChild as Node;

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

    // convert svg source to URI data scheme, set url value to a element's href attribute
    this.svgLink.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  }

  attachPathListeners(geometry: NgmGeometry) {
    const areaChartPath = this.profileInfo.group.select('.ngm-profile-area');
    areaChartPath.on('mousemove', (evt) => {
      const x = pointer(evt)[0];
      const xCoord = this.domain.X.invert(x);

      const selectedData = this.data[this.bisect(this.data, xCoord, 0)];
      const yCoord = selectedData.alts['DTM2'];
      const y = this.domain.Y(yCoord);

      this.tooltipData = {
        position: {left: `${x}px`, top: `${y}px`},
        values: {
          dist: `${xCoord.toFixed(2)} ${this.distInKM ? 'km' : 'm'}`,
          elev: `${yCoord.toFixed(2)} m`
        }
      };
      let ratio = xCoord / this.data[this.data.length - 1].domainDist;
      if (ratio < 0) ratio = 0;
      else if (ratio > 1) ratio = 1;
      getPointOnPolylineByRatio(geometry!.positions, ratio, this.highlightPointPosition);
      this.viewer?.scene.requestRender();
    });
    areaChartPath.on('mouseover', () => {
      this.showTooltip = true;
    });
    areaChartPath.on('mouseout', () => {
      this.showTooltip = false;
      this.viewer?.scene.requestRender();
    });
  }

  render() {
    return this.hidden ? html`` : html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('topographic_profile_header')} (${this.name})
        <div class="ngm-close-icon" @click=${() => ToolboxStore.nextGeometryAction({action: 'profile'})}></div>
      </div>
      <div class="content-container">
        <p>${i18next.t('topographic_profile_downloads')}:
          <a href=${this.profileServiceUrl('csv')}>CSV</a>
          <a class="svg-link" download="${this.name}_profile">SVG</a>
        </p>
        <div class="ngm-profile-plot"></div>
        <div .hidden=${!this.showTooltip} class="ngm-profile-tooltip" style="${styleMap(this.tooltipData.position)}">
          <div>
            <div class="ngm-profile-distance">${i18next.t('profile_distance')} ${this.tooltipData.values.dist}</div>
            <div class="ngm-profile-elevation">${i18next.t('profile_elevation')} ${this.tooltipData.values.elev}</div>
          </div>
          <div class="ngm-profile-tooltip-arrow"></div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
