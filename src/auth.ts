import {CognitoIdentityCredentialProvider, CognitoIdentityCredentials, fromCognitoIdentityPool} from '@aws-sdk/credential-provider-cognito-identity';
import {CognitoIdentityClient} from '@aws-sdk/client-cognito-identity';
const cognitoState = 'cognito_state';
const cognitoUser = 'cognito_user';
const cognitoAccessToken = 'cognito_access_token';

interface AuthUser {
  name: string;
  'cognito:groups': string;
}

let _AWSCredentials: CognitoIdentityCredentialProvider|null = null;
export default class Auth {

  static initialize() {
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
    }
  }

  static getCredentialsPromise(): Promise<CognitoIdentityCredentials>|undefined {
    if (_AWSCredentials) {
      return _AWSCredentials();
    }
    return undefined; // FIXME: ugly
  }

  static state(state?: string) {
    if (state !== undefined) {
      localStorage.setItem(cognitoState, state);
    }
    if (localStorage.getItem(cognitoState) === null) {
      localStorage.setItem(cognitoState, Math.random().toString(36).substring(2));
    }
    return localStorage.getItem(cognitoState);
  }

  static getUser(): AuthUser {
    const value = localStorage.getItem(cognitoUser) as string;
    return JSON.parse(value);
  }

  /**
   * @return {string[]}
   */
  static getGroups() {
    const user = this.getUser();
    return user ? user['cognito:groups'] : [];
  }

  static setUser(user: String|number) {
    const value = JSON.stringify(user);
    localStorage.setItem(cognitoUser, value);
  }

  static logout() {
    localStorage.removeItem(cognitoUser);
    localStorage.removeItem(cognitoState);
    localStorage.removeItem(cognitoAccessToken);
    localStorage.removeItem('rawCognitoResponse');
    _AWSCredentials = null;
  }

  static getAccessToken() {
    return localStorage.getItem(cognitoAccessToken);
  }

  static setAccessToken(token: string) {
    localStorage.setItem(cognitoAccessToken, token);
  }

  static async waitForAuthenticate() {
    while (localStorage.getItem(cognitoUser) === null) {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 20);
      });
    }
  }

}
