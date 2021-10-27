const LOCALSTORAGE_AOI_KEY = 'aoi';

export default class LocalStorageController {

  static getStoredAoi() {
    const storedAoi = localStorage.getItem(LOCALSTORAGE_AOI_KEY);
    if (storedAoi) {
      return JSON.parse(storedAoi);
    }
    return [];
  }

  static setAoiInStorage(areas) {
    localStorage.setItem(LOCALSTORAGE_AOI_KEY, JSON.stringify(areas));
  }
}
