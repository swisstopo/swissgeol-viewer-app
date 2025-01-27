import { LitElementI18n, translated } from '../i18n';
import { customElement, state } from 'lit/decorators.js';
import { html } from 'lit';
import { dragArea } from './helperElements';
import draggable from './draggable';
import DashboardStore from '../store/dashboard';
import type { Project, Topic } from './dashboard/ngm-dashboard';

@customElement('ngm-project-popup')
export class NgmProjectPopup extends LitElementI18n {
  @state()
  accessor selectedTopic: Topic | Project | undefined;
  @state()
  accessor viewIndex: number | undefined;

  constructor() {
    super();
    DashboardStore.selectedTopicOrProject.subscribe((selectedProj) => {
      this.selectedTopic = selectedProj;
      if (!selectedProj) this.hidden = true;
    });
    DashboardStore.viewIndex.subscribe((index) => {
      this.viewIndex = index;
      this.hidden = index === undefined;
    });
  }

  connectedCallback() {
    this.hidden = true;
    draggable(this, {
      allowFrom: '.drag-handle',
    });
    super.connectedCallback();
  }

  changeView(indexChange) {
    if (!this.selectedTopic || this.viewIndex === undefined) return;
    let index = this.viewIndex + indexChange;

    if (index > this.selectedTopic.views.length - 1) index = 0;
    else if (index < 0) index = this.selectedTopic.views.length - 1;

    DashboardStore.setViewIndex(index);
  }

  onClose() {
    this.hidden = true;
    DashboardStore.setViewIndex(undefined);
  }

  render() {
    if (!this.selectedTopic || this.viewIndex === undefined) return '';
    return html` <div class="ngm-floating-window-header drag-handle">
        <div class="ngm-floating-window-header-title">
          ${translated(this.selectedTopic.title)}
        </div>
        <div class="ngm-close-icon" @click=${this.onClose}></div>
      </div>
      <div class="ngm-project-popup-content">
        <div
          class="ngm-play-last-icon"
          @click=${() => this.changeView(-1)}
        ></div>
        <div class="ngm-project-view-title">
          ${translated(this.selectedTopic.views[this.viewIndex].title)}
        </div>
        <div class="ngm-play-icon" @click=${() => this.changeView(1)}></div>
      </div>
      ${dragArea}`;
  }

  createRenderRoot() {
    return this;
  }
}
