import {html} from 'lit';
import {until} from 'lit/directives/until.js';
import {setupI18n} from '../i18n';
import '../style/index.css';
import '../layers/ngm-layers';
import './clean.css';
import type {Config} from '../layers/ngm-layers-item';

const ready = setupI18n();

export default {
  title: 'Components/NgmLayers',
};

const someActions = {
  changeVisibility(config, visible) {
    config.visible = visible;
  },
  reorderLayers(_, layers) {
    console.log('newOrder', layers.map(l => l.label));
  }
};

const someConfigs: Config[] = ['layer 1', 'layer 2', 'layer 3', 'layer 4'].map(
  label => ({
    label: label,
    opacity: 0.7,
    setOpacity: () => {},

    load() {
      return Promise.resolve(`bidon ${label}`);
    },
  })
);

function whenReady(partial) {
  // to render translated text, we need to wait for the i18next promise to be resolved
  return () => html`${until(ready.then(partial), html`<div>loading...</div>`)}`;
}

export const Default = whenReady(() => html`
  <div style="width: 450px">
  <ngm-layers
    .layers=${someConfigs} .actions=${someActions}>
  </ngm-layers>
  </div>`);
