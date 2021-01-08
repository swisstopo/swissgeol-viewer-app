import {initSentry} from './sentry.js';
import {setupI18n} from './i18n.js';
import './jquery.js';

import './style/index.css';

import Auth from './auth.js';

import './ngm-main.js';

Auth.initialize();

initSentry();
setupI18n();
