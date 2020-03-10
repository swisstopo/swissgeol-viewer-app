import * as Sentry from '@sentry/browser';
import {environment} from './environments/environment.js';

export function initSentry() {
  Sentry.init({dsn: 'https://dc2f101d00734a4b95a459f46f17cbb0@sentry.io/3820326', release: environment.branch}); // TODO replace test dsn
}
