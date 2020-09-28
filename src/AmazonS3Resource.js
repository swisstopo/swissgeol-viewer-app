import AWS from 'aws-sdk';
import Resource from 'cesium/Source/Core/Resource';
import Auth from './auth.js';


function keyFromUrl(val) {
  try {
    const url = new URL(val);
    // remove the first '/' from the path
    return url.pathname.slice(1);
  } catch {
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

  _makeRequest(options) {
    Auth.updateAwsCredentialsWithToken(Auth.getIdToken());
    return new Promise((resolve, reject) => {
      AWS.config.credentials.get(err => {
        return this.getObject(AWS.config.credentials)
          .catch(err => reject(err))
          .then(data => {
            if (options.responseType === 'text') {
              resolve(data.Body.toString());
            } else if (options.responseType === 'arraybuffer') {
              resolve(data.Body.buffer);
            } else {
              reject('Unknown responseType')
            }
          });
        // const s3 = new AWS.S3({
        //   credentials: AWS.config.credentials
        // });
        // // var url = s3.getSignedUrl('getObject', options);
        // s3.getObject(options, (err, data) => {
        //   if (err) {
        //     reject(err);
        //   } else {
        //     console.log(this.url);
        //     console.log(data.ContentType);
        //     resolve(data.Body.toString());
        //   }
        // });

      });

    });
  }
}
