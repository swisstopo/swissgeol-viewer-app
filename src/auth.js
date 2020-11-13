import {fromCognitoIdentityPool} from '@aws-sdk/credential-provider-cognito-identity';
import {CognitoIdentityClient} from '@aws-sdk/client-cognito-identity';
const cognitoState = 'cognito_state';
const cognitoUser = 'cognito_user';
const cognitoAccessToken = 'cognito_access_token';

let _AWSCredentials = null;

export default class Auth {

  static initialize() {
    if (window.location.hash.startsWith('#')) {
      // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
      const response = window.location.hash.substring(1);
      const params = new URLSearchParams(response);
      if (params.has('access_token') && params.has('id_token') &&
          params.get('token_type') === 'Bearer' && params.get('state') === this.state()) {
        localStorage.setItem('rawCognitoResponse', response);
        const token = params.get('access_token');
        const payload = atob(token.split('.')[1]);
        const claims = JSON.parse(payload);
        this.setUser(claims);
        this.setAccessToken(params.get('id_token'));
      }
    }

    const accessToken = this.getAccessToken();
    if (accessToken) {
      window['AWSCred'] = _AWSCredentials = fromCognitoIdentityPool({
        client: new CognitoIdentityClient({
          region: 'eu-central-1'
        }),
        identityPoolId: 'eu-central-1:21355ebf-703b-44dd-8900-f8bc391b4bde',
        logins: {
          'cognito-idp.eu-central-1.amazonaws.com/eu-central-1_5wXXpcDt8': accessToken
        }
      });
    }
  }

  static getCredentialsPromise() {
    if (_AWSCredentials) {
      return _AWSCredentials();
    }
  }

  static state(state) {
    if (state !== undefined) {
      localStorage.setItem(cognitoState, state);
    }
    if (localStorage.getItem(cognitoState) === null) {
      localStorage.setItem(cognitoState, Math.random().toString(36).substring(2));
    }
    return localStorage.getItem(cognitoState);
  }

  static getUser() {
    const value = localStorage.getItem(cognitoUser);
    return JSON.parse(value);
  }

  static setUser(user) {
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

  static setAccessToken(token) {
    localStorage.setItem(cognitoAccessToken, token);
  }

  static async waitForAuthenticate() {
    while (localStorage.getItem(cognitoUser) === null) {
      await new Promise((resolve) => {
        setTimeout(() => resolve(), 100);
      });
    }
  }

}
