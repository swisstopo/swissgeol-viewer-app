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
