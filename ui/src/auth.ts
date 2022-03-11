import type {
  CognitoIdentityCredentialProvider,
  CognitoIdentityCredentials} from '@aws-sdk/credential-provider-cognito-identity';
import {fromCognitoIdentityPool} from '@aws-sdk/credential-provider-cognito-identity';
import {CognitoIdentityClient} from '@aws-sdk/client-cognito-identity';
import auth from './store/auth';

const cognitoState = 'cognito_state';
const cognitoUser = 'cognito_user';
const cognitoAccessToken = 'cognito_access_token';

export interface AuthUser {
  username: string;
  'cognito:groups': string[];
  auth_time: number
  client_id: string
  exp: number
  iat: number
  iss: string
  jti: string
  scope: string
  sub: string
  token_use: string

}

export function getAccessToken() {
  return Auth.getAccessToken();
}

let authTimeout = 0;

let _AWSCredentials: CognitoIdentityCredentialProvider | null = null;
export default class Auth {

  static initialize(): void {
    if (window.location.hash.startsWith('#')) {
      // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
      const response = window.location.hash.substring(1);
      const params = new URLSearchParams(response);
      if (params.has('access_token') && params.has('id_token') &&
        params.get('token_type') === 'Bearer' && params.get('state') === this.state()) {
        localStorage.setItem('rawCognitoResponse', response);
        const token = params.get('access_token') || '';
        const payload = atob(token.split('.')[1]);
        const claims = JSON.parse(payload);
        this.setUser(claims);
        this.setAccessToken(params.get('id_token') || '');
      }
    } else if (this.getUser()) {
      // this strange line sets up observable and autologout
      this.setUser(this.getUser());
    }

    const accessToken = this.getAccessToken();
    if (accessToken) {
      (window as any)['AWSCred'] = _AWSCredentials = fromCognitoIdentityPool({
        client: new CognitoIdentityClient({
          region: 'eu-west-1'
        }),
        identityPoolId: 'eu-west-1:8e7b48a6-9d3f-4a46-afa3-d05a78c46a90',
        logins: {
          'cognito-idp.eu-west-1.amazonaws.com/eu-west-1_1NcmOhPt4': accessToken
        }
      });

      fetch('/api/token_test', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      .then(response => response.json())
      .then(json => {
        console.log(json);
      }).catch(err => {
        console.error(err);
      });
    }
  }

  static getCredentialsPromise(): Promise<CognitoIdentityCredentials> | undefined {
    if (_AWSCredentials) {
      return _AWSCredentials();
    }
    return undefined; // FIXME: ugly
  }

  static state(state?: string): string | null {
    if (state !== undefined) {
      localStorage.setItem(cognitoState, state);
    }
    if (localStorage.getItem(cognitoState) === null) {
      localStorage.setItem(cognitoState, Math.random().toString(36).substring(2));
    }
    return localStorage.getItem(cognitoState);
  }

  static getUser(): AuthUser|null {
    const value = localStorage.getItem(cognitoUser) as string;
    return JSON.parse(value);
  }

  static setUser(user: AuthUser|null): void {
    if (authTimeout) {
      window.clearTimeout(authTimeout);
      authTimeout = 0;
    }
    if (user) {
      const remaining = 1000 * user.exp - Date.now();
      console.log('Will log out in', Math.floor(remaining / 1000 / 60), 'min');
      authTimeout = window.setTimeout(() => {
        console.log('Token expired - logout');
        Auth.logout();
      }, remaining);
    }
    auth.setUser(user);
    const value = JSON.stringify(user);
    localStorage.setItem(cognitoUser, value);
  }

  static logout(): void {
    localStorage.removeItem(cognitoUser);
    localStorage.removeItem(cognitoState);
    localStorage.removeItem(cognitoAccessToken);
    localStorage.removeItem('rawCognitoResponse');
    auth.setUser(null);
    _AWSCredentials = null;
  }

  static getAccessToken(): string | null {
    return localStorage.getItem(cognitoAccessToken);
  }

  static setAccessToken(token: string): void {
    localStorage.setItem(cognitoAccessToken, token);
  }

  static async waitForAuthenticate(): Promise<void> {
    while (localStorage.getItem(cognitoUser) === null) {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 20);
      });
    }
  }
}
