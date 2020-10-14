import AWS from 'aws-sdk';
import Resource from 'cesium/Source/Core/Resource';
import when from 'cesium/Source/ThirdParty/when';


function keyFromUrl(val) {
  try {
    const url = new URL(val);
    // remove the first '/' from the path
    return url.pathname.slice(1);
  } catch (err) {
    return val;
  }
}


export default class AmazonS3Resource extends Resource {

  constructor(options) {
    super(options);

    this.bucket = options.bucket;
  }

  clone(result) {
    if (!result) {
      result = new AmazonS3Resource({
        url: this.url,
        bucket: this.bucket,
      });
    }
    return result;
  }

  getSignedUrl(credentials) {
    const options = {
      Bucket: this.bucket,
      Key: keyFromUrl(this.url),
    };
    const s3 = new AWS.S3({
      credentials: credentials
    });
    return s3.getSignedUrl('getObject', options);
  }

  _makeRequest(options) {
    if (AWS.config.credentials) {
      const defer = when.defer();
      AWS.config.credentials.get(err => {
        if (err) {
          defer.reject(err);
        } else {
          this.url = this.getSignedUrl(AWS.config.credentials);
          const request = super._makeRequest(options);
          if (request) {
            request.then(value => defer.resolve(value));
          }
        }
      });
      return defer.promise;
    }
  }
}
