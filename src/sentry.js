import * as Sentry from '@sentry/browser';

export function initSentry() {
  let release = location.host;
  release = release.include('review') ? `${release}/${location.pathname.split('/')[1]}` : release; // TODO improve
  Sentry.init({dsn: 'https://273d49ea5057418c89b8160c68e9058d@sentry.io/3818111', release: release}); // TODO replace test dsn
}
