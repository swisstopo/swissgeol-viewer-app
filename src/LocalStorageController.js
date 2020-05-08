const LOCALSTORAGE_AOI_KEY = 'aoi';
const LOCALSTORAGE_WELCOME_KEY = 'hideWelcome';
const LOCALSTORAGE_SENTRY_KEY = 'sentryConfirmed';
const LOCALSTORAGE_REVIEW_KEY = 'hideReviewWindow';

export class LocalStorageController {
  get isSentryConfirmed() {
    return localStorage.getItem(LOCALSTORAGE_SENTRY_KEY) === 'true';
  }

  get hideWelcomeValue() {
    return localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) === 'true';
  }

  get hideReviewWindowValue() {
    return localStorage.getItem(LOCALSTORAGE_REVIEW_KEY) === 'true';
  }

  saveSentryConfirmation() {
    localStorage.setItem(LOCALSTORAGE_SENTRY_KEY, 'true');
  }

  updateWelcomePanelState() {
    const newValue = !(localStorage.getItem(LOCALSTORAGE_WELCOME_KEY) === 'true');
    localStorage.setItem(LOCALSTORAGE_WELCOME_KEY, newValue);
  }

  getStoredAoi() {
    const storedAoi = localStorage.getItem(LOCALSTORAGE_AOI_KEY);
    if (storedAoi) {
      return JSON.parse(storedAoi);
    }
    return [];
  }

  setAoiInStorage(areas) {
    localStorage.setItem(LOCALSTORAGE_AOI_KEY, JSON.stringify(areas));
  }

  updateReviewWindowState() {
    const newValue = !(localStorage.getItem(LOCALSTORAGE_REVIEW_KEY) === 'true');
    localStorage.setItem(LOCALSTORAGE_REVIEW_KEY, newValue);
  }
}
