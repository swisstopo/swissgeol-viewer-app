import AWS from 'aws-sdk';
import Resource from 'cesium/Source/Core/Resource';

import Auth from './auth.js';


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

  getObject(credentials) {
    const options = {
      Bucket: this.bucket,
      Key: keyFromUrl(this.url),
    };
    const s3 = new AWS.S3({
      credentials: credentials
    });
    return s3.getObject(options).promise();
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
    Auth.updateAwsCredentialsWithToken(Auth.getIdToken());
    return new Promise((resolve, reject) => {
      AWS.config.credentials.get(err => {
        if (err) {
          reject(err);
        } else {
          this.url = this.getSignedUrl(AWS.config.credentials);
          super._makeRequest(options).then((value) => {
            resolve(value);
          });
          // resolve()
          // return super._makeRequest(options);
          // return this.getObject(AWS.config.credentials)
          // .catch(err => reject(err))
          // .then(data => {
          //   const array = data.Body;
          //   if (options.responseType === 'text') {
          //     resolve(array.toString());
          //   } else if (options.responseType === 'arraybuffer') {
          //     resolve(array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset));
          //   } else {
          //     reject('Unknown responseType')
          //   }
          // });
        }
      });
    });
  }
}
