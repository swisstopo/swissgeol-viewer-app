import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './ngm-app';
import { Task } from '@lit/task';

import { ClientConfig } from './api/client-config';
import { registerAppContext } from './context';
import { ConfigService } from './api/config.service';

@customElement('ngm-app-boot')
export class NgmAppBoot extends LitElement {
  private readonly viewerInitialization = new Task(this, {
    task: async () => {
      const clientConfig =
        (await new ConfigService().getConfig()) as ClientConfig;
      if (!clientConfig) {
        console.error('Failed to load client config');
        return;
      }

      registerAppContext(this, clientConfig);
    },
    args: () => [],
  });

  render() {
    return this.viewerInitialization.render({
      pending: () => html`<p>Loading</p>`,
      complete: () => html` <ngm-app></ngm-app>`,
      error: (e) => html`<p>Error: ${e}</p>`,
    });
  }

  // This deactivates shadow DOM. Because this is done for all other components, we have to add it for the time being.
  createRenderRoot() {
    return this;
  }
}
