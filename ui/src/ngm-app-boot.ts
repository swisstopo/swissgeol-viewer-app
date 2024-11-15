import {LitElement, html} from 'lit';
import {customElement} from 'lit/decorators.js';
import './ngm-app';
import {Task} from '@lit/task';
import {provide} from '@lit/context';

import {ClientConfig} from './api/client-config';
import {apiClientContext, authServiceContext, clientConfigContext} from './context';
import {ConfigService} from './api/config.service';
import AuthService from './authService';
import {ApiClient} from './api/api-client';


@customElement('ngm-app-boot')
export class NgmAppBoot extends LitElement {
  @provide({context: clientConfigContext})
  private accessor clientConfig!: ClientConfig;
  @provide({context: authServiceContext})
  accessor authService = new AuthService();
  @provide({context: apiClientContext})
  accessor apiClient: ApiClient = null!;


  private viewerInitialization = new Task(this, {
    task: async () => {
      this.clientConfig = await new ConfigService().getConfig() as ClientConfig;
      if (!this.clientConfig) {
        console.error('Failed to load client config');
        return;
      }

      this.authService.clientConfig = this.clientConfig;
      this.authService.initialize();
      this.apiClient = new ApiClient(this.authService);
    },
    args: () => [],
  });

  render() {
    return this.viewerInitialization.render({
      pending: () => html`<p>Loading</p>`,
      complete: () => html`<ngm-app></ngm-app>`,
      error: (e) => html`<p>Error: ${e}</p>`
    });
  }

  // This deactivates shadow DOM. Because this is done for all other components, we have to add in for the time being.
  createRenderRoot() {
    return this;
  }
}
