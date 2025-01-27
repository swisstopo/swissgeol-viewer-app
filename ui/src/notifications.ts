import $ from 'jquery';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/toast.js';
import i18next from 'i18next';

export function showSnackbarInfo(message: string, optionsParam?): HTMLElement {
  const options = { ...optionsParam, showIcon: 'close' };
  return showSnackbarMessage(message, 'snackbar info', options);
}

export function showSnackbarSuccess(message: string): HTMLElement {
  return showSnackbarMessage(message, 'snackbar success');
}

export function showSnackbarError(message: string): HTMLElement {
  return showSnackbarMessage(message, 'snackbar error');
}

export function showBannerError(
  element: HTMLElement,
  message: string,
): HTMLElement {
  return showBanner(element, {
    showImage: '/images/i_error.svg',
    closeIcon: true,
    className: { toast: 'snackbar error' },
    message: message,
  });
}

export function showBannerWarning(
  element: HTMLElement,
  message: string,
): HTMLElement {
  return showBanner(element, {
    showImage: '/images/I_warning.svg',
    closeIcon: true,
    className: { toast: 'snackbar warning' },
    message: message,
  });
}

export function showBannerSuccess(
  element: HTMLElement,
  message: string,
): HTMLElement {
  return showBanner(element, {
    showImage: '/images/i_success.svg',
    closeIcon: true,
    className: { toast: 'snackbar success' },
    message: message,
  });
}

export function showSnackbarConfirmation(
  message: string,
  callbacks: { onApprove?: () => void; onDeny?: () => void },
): HTMLElement {
  return showSnackbarMessage(message, 'snackbar info actions', {
    displayTime: 0,
    closeOnClick: false,
    closeIcon: false,
    onApprove: callbacks.onApprove,
    onDeny: callbacks.onDeny,
    actions: [
      {
        class: 'approve ngm-action-btn',
        text: 'OK',
      },
      {
        class: 'deny ngm-action-btn ngm-cancel-btn',
        text: i18next.t('app_cancel_btn_label'),
      },
    ],
  });
}

function showSnackbarMessage(
  message: string,
  className: string,
  options = {},
): HTMLElement {
  return showMessage(message, {
    position: 'bottom center',
    className: {
      toast: className,
    },
    ...options,
  });
}

function showMessage(message: string, options: any = {}): HTMLElement {
  // hide same toasts
  if (options.class)
    (<HTMLElement>(
      document.querySelector(`.${options.class}`)
    ))?.parentElement?.remove();
  return $('body').toast({
    ...options,
    message: message,
  })[0];
}

export function showBanner(element: HTMLElement, options) {
  return $(element).toast({
    position: 'attached',
    context: $(element),
    displayTime: 20000,
    ...options,
  })[0];
}

export function isBannerShown(element: HTMLElement): boolean {
  return element.firstChild?.hasChildNodes() ?? false;
}
