import $ from './jquery.js';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/toast.js';

/**
 * @param {string} message
 */
export function showWarning(message) {
  showMessage(message, {
    class: 'warning',
    showIcon: 'exclamation triangle'
  });
}

/**
 * @param {string} message
 */
export function showError(message) {
  showMessage(message, {
    class: 'error',
    showIcon: 'exclamation triangle'
  });
}

/**
 * @param {string} message
 * @param {Object} [options={}]
 */
export function showMessage(message, options = {}) {
  $('body').toast(Object.assign({
    message: message
  }, options));
}
