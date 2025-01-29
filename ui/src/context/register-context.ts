import {LitElement} from 'lit';
import {Context, ContextProvider} from '@lit/context';
import {ClientConfig} from '../api/client-config';
import {apiClientContext, authServiceContext, clientConfigContext} from './client-config.context';
import {ApiClient} from '../api/api-client';
import AuthService from '../authService';
import {LayerService} from 'src/components/layer/layer.service';


type AppContext = ContextProvider<Context<unknown, unknown>, LitElement>
export const registerAppContext = (element: LitElement, clientConfig: ClientConfig): AppContext[] => {
  const contexts: AppContext[] = [];

  const authService = new AuthService();
  authService.clientConfig = clientConfig;
  authService.initialize();

  contexts.push(
    new ContextProvider(element, {context: clientConfigContext, initialValue: clientConfig}),
    new ContextProvider(element, {context: authServiceContext, initialValue: authService}),
  );

  const apiClient = new ApiClient(authService);
  contexts.push(
    new ContextProvider(element, {context: apiClientContext, initialValue: apiClient}),
  );

  const layerService = new LayerService();
  contexts.push(
    new ContextProvider(element, {context: LayerService.Context, initialValue: layerService}),
  );

  return contexts;
};
