import Auth from './auth';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {S3Client, GetObjectCommand} from '@aws-sdk/client-s3';
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
    this.region = options.region || 'eu-west-1';
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
    const client = new S3Client({
      region: this.region,
      credentials: credentials,
    });
    const options = {
      Bucket: this.bucket,
      Key: keyFromUrl(this.url),
    };
    const command = new GetObjectCommand(options);
    return getSignedUrl(client, command);
  }

  _makeRequest(options) {
    const credentialsPromise = Auth.getCredentialsPromise();
    if (credentialsPromise) {
      const defer = when.defer();
      credentialsPromise.then(credentials => {
        this.getSignedUrl(credentials).then(url => {
          this.url = url;
          const request = super._makeRequest(options);
          if (request) {
            request.then(value => defer.resolve(value));
          }
        });
      });
      return defer.promise;
    }
  }
}
