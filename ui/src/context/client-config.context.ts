import {createContext} from '@lit/context';
import {ClientConfig} from '../api/client-config';
import AuthService from '../authService';
import {ApiClient} from '../api/api-client';
import {GstService} from '../gst.service';

export const clientConfigContext = createContext<ClientConfig>('clientConfig');
export const apiClientContext = createContext<ApiClient>('apiClient');
export const authServiceContext = createContext<AuthService>('authService');
export const gstServiceContext = createContext<GstService>('gstService');
