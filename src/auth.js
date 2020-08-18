import AWS from 'aws-sdk';

const cognitoState = 'cognito_state';
const cognitoAccessToken = 'cognito_access_token';
const cognitoIdToken = 'cognito_id_token';
const awsBasicAuth = 'aws_basic_auth'

// example: #access_token=header.eyJuYW1lIjoiSm9obiBEb2UifQ.signature&token_type=Bearer&state=1234
const isResponse = /^#[\w]+=[\w.=-]+(&[\w]+=[\w.=-]+)*$/;

// example: header.eyJuYW1lIjoiSm9obiBEb2UifQ.signature
const isToken = /^[\w=-]+.[\w=-]+.[\w=-]+$/;


export default class Auth {

  static initialize() {
    // try parse and store the cognito response
    // and fail silently otherwise
    try {
      const response = this.parseResponse(window.location.hash);
      if (response.token_type === 'Bearer' && response.state === this.state()) {
        this.parseToken(response.access_token);
        this.parseToken(response.id_token)
        this.setAccessToken(response.access_token);
        this.setIdToken(response.id_token);
      }
    } catch (e) {
      // do nothing
      console.log('token not found');
    }
  }

  static parseResponse(response) {
    if (response === undefined || !isResponse.test(response)) {
      throw new Error('Malformed response');
    }
    const entries = response.substring(1).split('&')
      .filter(entry => entry !== '')
      .map(entry => entry.split('='));
    return Object.fromEntries(entries);
  }

  static parseToken(token) {
    if (token === undefined || !isToken.test(token)) {
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

  // static refreshToken(token) {
  //   fetch("https://cognito-idp.eu-central-1.amazonaws.com/", {
  //       headers: {
  //           "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
  //           "Content-Type": "application/x-amz-json-1.1",
  //       },
  //       mode: 'cors',
  //       cache: 'no-cache',
  //       method: 'POST',
  //       body: JSON.stringify({
  //           ClientId: "eu-central-1_5wXXpcDt8",
  //           AuthFlow: 'REFRESH_TOKEN_AUTH',
  //           AuthParameters: {
  //               REFRESH_TOKEN: "<cognito-refresh-toke>",
  //               //SECRET_HASH: "your_secret", // In case you have configured client secret
  //           }
  //       }),
  //   }).then((res) => {
  //       return res.json(); // this will give jwt id and access tokens
  //   });
  // }

  static state(state) {
    if (state !== undefined) {
      localStorage.setItem(cognitoState, state);
    }
    if (localStorage.getItem(cognitoState) === null) {
      localStorage.setItem(cognitoState, Math.random().toString(36).substring(2));
    }
    return localStorage.getItem(cognitoState);
  }

  static getAccessToken() {
    return localStorage.getItem(cognitoAccessToken);
  }

  static setAccessToken(token) {
    localStorage.setItem(cognitoAccessToken, token);
  }

  static getIdToken() {
    return localStorage.getItem(cognitoIdToken);
  }

  static setIdToken(token) {
    localStorage.setItem(cognitoIdToken, token);
  }

  static getBasicAuth(){
    return localStorage.getItem(awsBasicAuth);
  }

  static clear() {
    localStorage.removeItem(cognitoState);
    localStorage.removeItem(cognitoAccessToken);
    localStorage.removeItem(cognitoIdToken);
    localStorage.removeItem(awsBasicAuth);
  }

  static getUser() {
    try {
      const token = this.getAccessToken();
      return this.parseToken(token);
    } catch (e) {
        return null;
    }
  }

  static async waitForAuthenticate() {
    while (this.getUser() === null) {
      await new Promise((resolve) => {
          setTimeout(() => resolve(), 100);
      });
    }
  }

  static getAwsBasicAuthHash() {
    return localStorage.getItem(awsBasicAuth);
  }

  static updateAwsCredentialsWithToken(idToken){
    AWS.config.region = 'eu-central-1';
    if (AWS.config.credentials) {
      delete AWS.config.credentials;
    }
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: 'eu-central-1:21355ebf-703b-44dd-8900-f8bc391b4bde',
      Logins: {
          'cognito-idp.eu-central-1.amazonaws.com/eu-central-1_5wXXpcDt8': idToken
      }
    });
    AWS.config.credentials.get((err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(AWS.config.credentials.accessKeyId);
        console.log(AWS.config.credentials.secretAccessKey);
        console.log(AWS.config.credentials.sessionToken);
        // we build a 'fake' http basic-auth header, we use accessKeyId:secretAccessKey.sessionToken
        // the backend will extract these 3 infos to construct the AWS request
        // only accessKeyId is in username placeholder, so any webserver in the middle might log it
        localStorage.setItem(awsBasicAuth, btoa(`${AWS.config.credentials.accessKeyId}:${AWS.config.credentials.secretAccessKey}.${AWS.config.credentials.sessionToken}`));
      }
    });
  }
}
