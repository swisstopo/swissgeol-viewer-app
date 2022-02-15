import './style/index.css';
import {ReactiveElement} from 'lit';

// Detect issues following lit2 migration
ReactiveElement.enableWarning?.('migration');

import Auth from './auth';

import './ngm-app';

Auth.initialize();
