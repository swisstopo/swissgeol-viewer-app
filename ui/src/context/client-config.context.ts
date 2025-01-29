import { createContext } from '@lit/context';
import { ClientConfig } from '../api/client-config';
import AuthService from '../authService';
import { ApiClient } from '../api/api-client';

export const clientConfigContext = createContext<ClientConfig>('clientConfig');
export const authServiceContext = createContext<AuthService>('authService');
export const apiClientContext = createContext<ApiClient>('apiClient');
