import {fromCognitoIdentityPool} from '@aws-sdk/credential-provider-cognito-identity';
import {CognitoIdentityClient} from '@aws-sdk/client-cognito-identity';
const cognitoState = 'cognito_state';
const cognitoUser = 'cognito_user';
const cognitoAccessToken = 'cognito_access_token';

// example: #access_token=header.eyJuYW1lIjoiSm9obiBEb2UifQ.signature&token_type=Bearer&state=1234
const isResponse = /^#[\w]+=[\w.=-]+(&[\w]+=[\w.=-]+)*$/;

// example: header.eyJuYW1lIjoiSm9obiBEb2UifQ.signature
const isToken = /^[\w=-]+.[\w=-]+.[\w=-]+$/;

let _AWSCredentials = null;

export default class Auth {

  static initialize() {
    // try parse and store the cognito response
    // and fail silently otherwise
    try {
      const response = this.parseResponse(window.location.hash);
      if (response.token_type === 'Bearer' && response.state === this.state()) {
        this.setUser(this.parseToken(response.access_token));
        this.setAccessToken(response.id_token);
      }
    } catch (e) {
      // do nothing
    }

    const accessToken = this.getAccessToken();
    if (accessToken) {
      _AWSCredentials = fromCognitoIdentityPool({
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

  static parseResponse(response) {
    if (!isResponse.test(response)) {
      throw new Error('Malformed response');
    }
    const entries = response.substring(1).split('&')
      .filter(entry => entry !== '')
      .map(entry => entry.split('='));
    return Object.fromEntries(entries);
  }

  static parseToken(token) {
    if (!isToken.test(token)) {
      throw new Error('Malformed token');
    }
    try {
      const arr = token.split('.');
      const payload = atob(arr[1]);
      return JSON.parse(payload);
    } catch (e) {
      throw new Error('Malformed token');
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
