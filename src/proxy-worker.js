console.log('coucou');

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

const VERSION = 'v9';

function log(message) {
  console.log(VERSION, message);
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ngmdb", 1);
    request.onsuccess = event => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
    request.onupgradeneeded = () => {
      reject('Error, the indexedDB should exist');
    };
  });
}

function readFromIndexedDB(db, key) {
  return new Promise((resolve, reject) => {
    const dbRequest = db.transaction("responses").objectStore("auth").get(key);
    dbRequest.onsuccess = function(dbEvent) {
      const init = {"status" : 200 , "statusText" : "OK"};
      const result = dbEvent.target.result;
      if (result && result.content) {
        let d = result.content
        if (d.startsWith('data')) {
          d = dataURItoBlob(d);
        }
        resolve(new Response(d, init));
      } else {
        console.log('no content!');
        reject('Could not find url ' + url + ' in indexedDB');
      }
    };
    dbRequest.onerror = function(dbEvent) {
      console.error('sw db error', dbEvent.target.errorCode);
      reject();
    };
  });
}



if (typeof self === 'object') {
  log('In the sw');


  self.addEventListener('install', event => {
      log("INSTALLING ");
      const installCompleted = Promise.resolve()
                          .then(() => log("INSTALLED"));

      event.waitUntil(installCompleted);
  });

  // self.addEventListener('activate', event => {
  //     log("ACTIVATING");
  //     const activationCompleted = Promise.resolve()
  //         .then((activationCompleted) => log("ACTIVATED"));
  //     event.waitUntil(activationCompleted);
  // });

  // // Install the service worker (download website files)
  // self.addEventListener('install', e => {
  //   console.log('SW installation');
  //   //e.waitUntil(downloadAndCacheWebsiteFiles());
  // });

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

  // Intercept the network queries from the main thread and the workers
  // This is necessary:
  // - to serve the website without network connectivity;
  // - to inject offline MVT data into MapBox without modifying MapBox.
  self.addEventListener('fetch', function(event) {
    if (event.request.url.includes('/tiles/')){
      const url = 'https://s3-eu-central-1.amazonaws.com/ngm-dev-authenticated-resources' + normalizeUrl(event.request.url);
      log('get this url: ' + url);
      event.respondWith(fetch(url));
    } else {
      event.respondWith(fetch(event.request));
    }

  });

}
