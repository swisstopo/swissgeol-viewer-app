import $ from './jquery.js';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/toast.js';

export function showWarning(message) {
  showMessage(message, {
    class: 'warning',
    showIcon: 'exclamation triangle'
  });
}

export function showError(message) {
  showMessage(message, {
    class: 'error',
    showIcon: 'exclamation triangle'
  });
}

export function showMessage(message, options = {}) {
  $('body').toast(Object.assign({
    message: message
  }, options));
}

export function showConfirmationMessage(message, buttonText, clickCallback = undefined) {
  $('body')
    .toast({
      message: message,
      displayTime: 0,
      classActions: 'basic left',
      actions: [{
        text: buttonText,
        click: clickCallback
      }]
    });
}
