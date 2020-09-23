import Resource from 'cesium/Source/Core/Resource';


export default class CognitoResource extends Resource {

  constructor(options) {
    super(options);

    this._token = options.token;
  }

  clone(result) {
    if (!result) {
      result = new CognitoResource({
        url: this._url,
        token: this._token,
      });
    }
    return result;
  }

  _makeRequest(options) {
     if (!options.headers) {
      options.headers = {};
    }
    // FIXME
    options.headers.Authorization = this._token;
    return super._makeRequest(options);
  }
}
