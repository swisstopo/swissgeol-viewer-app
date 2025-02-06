import {LitElement} from 'lit';
import {Context, ContextProvider} from '@lit/context';
import {ClientConfig} from '../api/client-config';
import {apiClientContext, authServiceContext, clientConfigContext, gstServiceContext} from './client-config.context';
import {ApiClient} from '../api/api-client';
import AuthService from '../authService';
import {GstService} from '../gst.service';


export const registerAppContext: (element: LitElement, clientConfig: ClientConfig) => ContextProvider<Context<unknown, unknown>, LitElement>[]
  = (element: LitElement, clientConfig: ClientConfig) => {

  const authService = new AuthService();
  authService.clientConfig = clientConfig;
  authService.initialize();
  const apiClient = new ApiClient(authService);

  return [
    new ContextProvider(element, {context: clientConfigContext, initialValue: clientConfig}),
    new ContextProvider(element, {context: apiClientContext, initialValue: apiClient}),
    new ContextProvider(element, {context: authServiceContext, initialValue: authService}),
    new ContextProvider(element, {context: gstServiceContext, initialValue: new GstService(clientConfig)}),
  ];
};
