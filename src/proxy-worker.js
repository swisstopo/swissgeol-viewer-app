

// need to use another xml parser because domparser is not available in SW
// see https://github.com/TobiasNickel/tXml
importScripts('/src/tXml.min.js');

// modified version to use fetch API instead of XmlHttpRequest
// see: https://github.com/aws/aws-sdk-js/issues/1902
importScripts('/src/aws-sdk-2.727.1.js');


//importScripts('/src/aws-sdk-2.716.0.min.js');
//importScripts('/src/amazon-cognito-identity.min.js');



const VERSION = 'v61';

// for debug use aws builtin logger
AWS.config.logger = console;

// custom log function so that we know which version of SW is installed
function log(message) {
  console.log(VERSION, message);
}

function normalizeUrl(url) {
  if (url.startsWith('http')) {
    const idx = url.substr(9).indexOf('/');
    url = url.substr(9 + idx);
  }
  let i = url.indexOf('?');
  if (i !== -1) {
    url = url.substr(0, i);
  }
  j = url.indexOf('#');
  if (i !== -1) {
    url = url.substr(0, i);
  }

  if (!url) {
    url = '/';
  }
  return url;
}



if (typeof self === 'object') {
  log('In the sw');
  /**
   * Get an object from a s3 bucket
   *
   * @param  {string} key - Object location in the bucket
   * @return {object}     - A promise containing the response
   */
  function getObject( key ) {
    return new Promise((resolve, reject) => {
        self.s3.getObject({
            Key: key
        }, (err, data) => {
            if ( err ) reject(err)
            else resolve(data)
        })
    })
  }
  function updateAwsCredentialsWithToken(idToken){
    AWS.config.region = 'eu-central-1'; // Region
    if (!self.s3) {
      self.s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        params: {Bucket: 'ngm-dev-authenticated-resources'}
      });
    }
    if (AWS.config.credentials) {
      delete AWS.config.credentials;
    }
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: 'eu-central-1:21355ebf-703b-44dd-8900-f8bc391b4bde',
      Logins: {
          'cognito-idp.eu-central-1.amazonaws.com/eu-central-1_5wXXpcDt8': idToken
      }
    });
    // AWS.config.credentials.get();
    AWS.config.credentials.get((err) => {
      if (err) {
          console.error(err);
      } else {
          console.log(AWS.config.credentials.accessKeyId)
          console.log(AWS.config.credentials.secretAccessKey)
          console.log(AWS.config.credentials.sessionToken)
      }
    });
    log(`idToken = ${idToken}`);
    log(`AWS.config.credentials = ${AWS.config.credentials}`);
    log(`AWS.config.region = ${AWS.config.region}`);
    log(`AWS.config.credentials.accessKeyId = ${AWS.config.credentials.accessKeyId}`);
    log(`AWS.config.credentials.identityId = ${AWS.config.credentials.identityId}`);
  }

  self.addEventListener('install', event => {
      log("INSTALLING ");
      const installCompleted = Promise.resolve()
                          .then(() => log("INSTALLED"));
      //self.skipWaiting();
      event.waitUntil(installCompleted);
  });

  // Immediately claim the clients so that they can go offline without reloading the page.
  self.addEventListener('activate', event => {
    const activationCompleted = Promise.resolve()
      .then((activationCompleted) => log("ACTIVATED"));
    event.waitUntil(activationCompleted);
    log('SW activating and claiming clients');
    event.waitUntil(clients.claim());
    log('clients are claimed');
    //clients.claim();
  });

  self.addEventListener('message', event => {
    if  (event.data.idToken) {
      log(`token received : ${event.data.idToken}`);
      //list(event.data.idToken);
      updateAwsCredentialsWithToken(event.data.idToken);
      log("aws config should be updated...")
      log(AWS.config.credentials);
    } else {
      //updateAwsCredentials(event.data.idToken)
      const messageReceived = Promise.resolve()
                          .then(() => log(`The client sent me a message: ${event.data}`));
      event.waitUntil(messageReceived);
    }
  });

  // Intercept the network queries from the main thread and the workers
  // This is necessary:
  // - to serve authenticated resources directly from S3 transparently for cesium
  self.addEventListener('fetch', function(event) {
    if (event.request.url.includes('/tiles/')){
      log(`try to fetch this resource with service worker: ${normalizeUrl(event.request.url).substring(1)}`);
      if (self.s3){
        //const url = 'https://s3-eu-central-1.amazonaws.com/ngm-dev-authenticated-resources' + normalizeUrl(event.request.url);
        const s3Key = normalizeUrl(event.request.url).substring(1);
        log('get this s3Key: ' + s3Key);
        event.respondWith(getObject(s3Key));
        //log(AWS.CognitoIdentityCredentials);
        // var params = {
        //   Key: s3Key
        // };
        // self.s3.getObject(params, function(err, data) {
        //   if (err) log(err, err.stack); // an error occurred
        //   else {
        //       log(data);           // successful response
        //       event.respondWith(data);
        //   }
        // });
      }
    } else {
      event.respondWith(fetch(event.request));
    }

  });

}
