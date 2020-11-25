import {LitElement, html} from 'lit-element';


class NgmLayerLoadingIndicator extends LitElement {

  static get properties() {
    return {
      loading: {type: Number},
      config: {type: Object},
      actions: {type: Number}
    };
  }

  firstUpdated() {
    this.loading = 0;
    const callback = (pending, processing) => {
      this.loading = pending + processing;
    };
    this.loadProgressRemover_ = this.actions.listenForEvent(this.config, 'loadProgress', callback);
  }

  disconnectedCallback() {
    if (this.loadProgressRemover_) {
      this.loadProgressRemover_();
    }
  }

  render() {
    return html`<div class="ui ${this.loading > 0 ? 'active' : ''} inline mini loader">${this.loading}</div>`;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-layer-loading-indicator', NgmLayerLoadingIndicator);
