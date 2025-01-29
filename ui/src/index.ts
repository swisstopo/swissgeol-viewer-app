import './jquery.polyfill';
import './style/index.css';
import { ReactiveElement } from 'lit';

// Detect issues following lit2 migration
ReactiveElement.enableWarning?.('migration');

import './ngm-app-boot';
