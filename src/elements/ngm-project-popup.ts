import {LitElementI18n} from '../i18n';
import {customElement, state} from 'lit/decorators.js';
import {html} from 'lit';
import {dragArea} from './helperElements';
import draggable from './draggable';
import DashboardStore from '../store/dashboard';
import {translated} from './ngm-dashboard';
import type {SelectedView} from './ngm-dashboard';

@customElement('ngm-project-popup')
export class NgmProjectPopup extends LitElementI18n {
  @state() selectedView: SelectedView | undefined;

  constructor() {
    super();
    DashboardStore.selectedView.subscribe(selectedProj => {
      this.hidden = false;
      this.selectedView = selectedProj;
    });
  }

  connectedCallback() {
    this.hidden = true;
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  changeView(indexChange) {
    if (!this.selectedView) return;
    const proj = this.selectedView.project;
    let index = this.selectedView.viewIndex + indexChange;

    if (index > proj.views.length - 1) index = 0;
    else if (index < 0) index = proj.views.length - 1;

    DashboardStore.setViewIndex(index);
  }

  render() {
    if (!this.selectedView) return '';
    const project = this.selectedView.project;
    const viewIndex = this.selectedView.viewIndex;
    return html`
      <div class="ngm-floating-window-header drag-handle">
        <div class="ngm-floating-window-header-title">${translated(project.title)}</div>
        <div class="ngm-close-icon" @click=${() => this.hidden = true}></div>
      </div>
      <div class="ngm-project-popup-content">
        <div class="ngm-play-last-icon" @click=${() => this.changeView(-1)}></div>
        <div class="ngm-project-view-title">${translated(project.views[viewIndex].title)}</div>
        <div class="ngm-play-icon" @click=${() => this.changeView(1)}></div>
      </div>
      ${dragArea}`;
  }

  createRenderRoot() {
    return this;
  }
}
