import $ from './jquery.js';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/toast.js';


export function showSnackbarInfo(message: string) {
  showSnackbarMessage(message, 'snackbar info');
}

export function showSnackbarSuccess(message: string) {
  showSnackbarMessage(message, 'snackbar success');
}

export function showSnackbarError(message: string) {
  showSnackbarMessage(message, 'snackbar error');
}

function showSnackbarMessage(message: string, className: string) {
  showMessage(message, {
    position: 'bottom center',
    className: {
      toast: className
    }
  });
}

export function showWarning(message: string) {
  showMessage(message, {
    class: 'warning',
    showIcon: 'exclamation triangle'
  });
}

export function showError(message: string) {
  showMessage(message, {
    class: 'error',
    showIcon: 'exclamation triangle'
  });
}

export function showMessage(message: string, options = {}) {
  $('body').toast(Object.assign({
    message: message
  }, options));
}
