import * as Sentry from '@sentry/browser';
import {environment} from './environments/environment.js';

export function initSentry() {
  Sentry.init({dsn: 'https://273d49ea5057418c89b8160c68e9058d@sentry.io/3818111', release: environment.branch}); // TODO replace test dsn
}
