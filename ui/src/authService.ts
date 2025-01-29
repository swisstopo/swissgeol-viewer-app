import type {
  CognitoIdentityCredentialProvider,
  CognitoIdentityCredentials,
} from '@aws-sdk/credential-provider-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import auth from './store/auth';
import { ClientConfig } from './api/client-config';

const cognitoState = 'cognito_state';
const cognitoUser = 'cognito_user';
const cognitoAccessToken = 'cognito_access_token';

export interface AuthUser {
  username: string;
  'cognito:groups': string[];
  auth_time: number;
  client_id: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  scope: string;
  sub: string;
  token_use: string;
}

let authTimeout = 0;

let _AWSCredentials: CognitoIdentityCredentialProvider | null = null;
export default class AuthService {
  private _clientConfig?: ClientConfig;
  public set clientConfig(value: ClientConfig) {
    this._clientConfig = value;
  }

  public initialize(): void {
    if (window.location.hash.startsWith('#')) {
      // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
      const response = window.location.hash.substring(1);
      const params = new URLSearchParams(response);

      if (params.has('error')) {
        throw new Error(`Auth error: ${params.get('error_description')}`);
      }

      if (
        params.has('access_token') &&
        params.has('id_token') &&
        params.get('token_type') === 'Bearer' &&
        params.get('state') === this.state()
      ) {
        localStorage.setItem('rawCognitoResponse', response);
        const token = params.get('access_token') ?? '';
        const payload = atob(token.split('.')[1]);
        const claims = JSON.parse(payload);
        this.setUser(claims);
        this.setAccessToken(params.get('id_token') ?? '');
      }
    } else if (this.getUser()) {
      // this strange line sets up observable and autologout
      this.setUser(this.getUser());
    }

    const accessToken = this.getAccessToken();
    if (accessToken && this._clientConfig) {
      const { cognito_pool_id, cognito_identity_pool_id, cognito_aws_region } =
        this._clientConfig.auth;
      (window as any)['AWSCred'] = _AWSCredentials = fromCognitoIdentityPool({
        client: new CognitoIdentityClient({
          region: cognito_aws_region,
        }),
        identityPoolId: cognito_identity_pool_id,
        logins: {
          [`cognito-idp.${cognito_aws_region}.amazonaws.com/${cognito_pool_id}`]:
            accessToken,
        },
      });
    }
  }

  getCredentialsPromise(): Promise<CognitoIdentityCredentials> | undefined {
    if (_AWSCredentials) {
      return _AWSCredentials();
    }
    return undefined; // FIXME: ugly
  }

  state(state?: string): string | null {
    if (state !== undefined) {
      localStorage.setItem(cognitoState, state);
    }
    if (localStorage.getItem(cognitoState) === null) {
      localStorage.setItem(
        cognitoState,
        Math.random().toString(36).substring(2),
      );
    }
    return localStorage.getItem(cognitoState);
  }

  getUser(): AuthUser | null {
    const value = localStorage.getItem(cognitoUser) as string;
    return JSON.parse(value);
  }

  setUser(user: AuthUser | null): void {
    if (authTimeout) {
      window.clearTimeout(authTimeout);
      authTimeout = 0;
    }
    if (user) {
      const remaining = 1000 * user.exp - Date.now();
      authTimeout = window.setTimeout(() => {
        this.logout();
      }, remaining);
    }
    auth.setUser(user);
    const value = JSON.stringify(user);
    localStorage.setItem(cognitoUser, value);
  }

  logout(): void {
    localStorage.removeItem(cognitoUser);
    localStorage.removeItem(cognitoState);
    localStorage.removeItem(cognitoAccessToken);
    localStorage.removeItem('rawCognitoResponse');
    auth.setUser(null);
    _AWSCredentials = null;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(cognitoAccessToken);
  }

  setAccessToken(token: string): void {
    localStorage.setItem(cognitoAccessToken, token);
  }

  async waitForAuthenticate(): Promise<void> {
    while (localStorage.getItem(cognitoUser) === null) {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 20);
      });
    }
  }
}
