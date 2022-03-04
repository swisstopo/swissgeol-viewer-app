import {LitElementI18n} from '../i18n';
import {customElement, state} from 'lit/decorators.js';
import {html} from 'lit';
import {dragArea} from './helperElements';
import draggable from './draggable';
import DashboardStore from '../store/dashboard';
import type {DashboardTopic} from './ngm-dashboard';
import i18next from 'i18next';

@customElement('ngm-project-popup')
export class NgmProjectPopup extends LitElementI18n {
  @state() selectedTopic: DashboardTopic | undefined;
  @state() viewIndex: number | undefined;

  constructor() {
    super();
    DashboardStore.selectedTopic.subscribe(selectedProj => {
      this.selectedTopic = selectedProj;
      if (!selectedProj) this.hidden = true;
    });
    DashboardStore.viewIndex.subscribe(index => {
      this.viewIndex = index;
      this.hidden = index === undefined;
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
    return html`
      <div class="ngm-floating-window-header drag-handle">
        <div class="ngm-floating-window-header-title">${this.selectedTopic.title[i18next.language]}</div>
        <div class="ngm-close-icon" @click=${this.onClose}></div>
      </div>
      <div class="ngm-project-popup-content">
        <div class="ngm-play-last-icon" @click=${() => this.changeView(-1)}></div>
        <div class="ngm-project-view-title">${this.selectedTopic.views[this.viewIndex].title[i18next.language]}</div>
        <div class="ngm-play-icon" @click=${() => this.changeView(1)}></div>
      </div>
      ${dragArea}`;
  }

  createRenderRoot() {
    return this;
  }
}
