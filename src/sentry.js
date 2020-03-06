import * as Sentry from '@sentry/browser';

export function initSentry() {
  Sentry.init({dsn: 'https://273d49ea5057418c89b8160c68e9058d@sentry.io/3818111', release: 'test-app'}); // TODO replace test dsn
}
