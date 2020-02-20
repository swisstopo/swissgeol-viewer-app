import Rectangle from 'cesium/Core/Rectangle.js';
import Color from 'cesium/Core/Color.js';


export const SWITZERLAND_BOUNDS = [5.140242, 45.398181, 11.47757, 48.230651];

export const SWITZERLAND_RECTANGLE = Rectangle.fromDegrees(...SWITZERLAND_BOUNDS);

export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en', 'rm'];
export const DRILL_PICK_LIMIT = 1;

export const BELOW_SURFACE_CONFIGURATION = {
  colorToAlpha: Color.DARKGRAY,
  colorToAlphaThreshold: 0,
  brightness: 0.5,
  gamma: 0.7
};

export const ABOVE_SURFACE_CONFIGURATION = {
  colorToAlpha: undefined,
  colorToAlphaThreshold: 0.004,
  brightness: 1,
  gamma: 1
};

export const LAYERS_URL_PARAM = 'layers';
export const LAYERS_OPACITY_URL_PARAM = 'layers_opacity';

export const DEFAULT_AOI_COLOR = Color.BLACK.withAlpha(0.3);
export const HIGHLIGHTED_AOI_COLOR = Color.YELLOW.withAlpha(0.3);
