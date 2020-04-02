import * as Sentry from '@sentry/browser';
import {environment} from './environment.js';

export function initSentry() {
  Sentry.init({
    dsn: 'https://dc2f101d00734a4b95a459f46f17cbb0@sentry.io/3820326',
    environment: location.host,
    release: environment.branch,
    enabled: !location.host.includes('localhost'),
    beforeSend: function (event) {
      if (event.user) {
        // Remove user info
        delete event.user;
      }
      return event;
    }
  });
}
