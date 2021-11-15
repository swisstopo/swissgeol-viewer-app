import $ from './jquery.js';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/toast.js';
import i18next from 'i18next';


export function showSnackbarInfo(message: string) {
  showSnackbarMessage(message, 'snackbar info');
}

export function showSnackbarSuccess(message: string) {
  showSnackbarMessage(message, 'snackbar success');
}

export function showSnackbarError(message: string) {
  showSnackbarMessage(message, 'snackbar error');
}

export function showSnackbarConfirmation(message: string, callbacks: {onApprove?: () => void, onDeny?: () => void}) {
  showSnackbarMessage(message, 'snackbar info actions', {
    displayTime: 0,
    actions: [
      {
        class: 'approve ngm-action-btn',
        text: 'OK',
        click: callbacks.onApprove
      },
      {
        class: 'deny ngm-action-btn ngm-cancel-btn',
        text: i18next.t('tbx_cancel_area_btn_label'),
        click: callbacks.onDeny
      }]
  });
}

function showSnackbarMessage(message: string, className: string, options = {}) {
  showMessage(message, {
    position: 'bottom center',
    className: {
      toast: className
    },
    ...options
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
