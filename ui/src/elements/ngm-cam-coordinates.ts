import $ from 'jquery';
import i18next from 'i18next';
import { LitElementI18n } from '../i18n';
import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/dropdown.js';
import { showSnackbarError } from '../notifications';
import {
  SWITZERLAND_BOUNDS_LV95,
  SWITZERLAND_BOUNDS_WGS84,
} from '../constants';

type CoordinateRange = {
  minValue: number;
  maxValue: number;
};
type ValidCrs = 'lv95' | 'wgs84';
type MinMaxCoordinateValues = {
  [key in ValidCrs]: {
    long: CoordinateRange;
    lat: CoordinateRange;
  };
};

const MIN_MAX_COORDINATE_VALUES: MinMaxCoordinateValues = {
  lv95: {
    long: {
      minValue: SWITZERLAND_BOUNDS_LV95[0],
      maxValue: SWITZERLAND_BOUNDS_LV95[2],
    },
    lat: {
      minValue: SWITZERLAND_BOUNDS_LV95[1],
      maxValue: SWITZERLAND_BOUNDS_LV95[3],
    },
  },
  wgs84: {
    long: {
      minValue: SWITZERLAND_BOUNDS_WGS84[0],
      maxValue: SWITZERLAND_BOUNDS_WGS84[2],
    },
    lat: {
      minValue: SWITZERLAND_BOUNDS_WGS84[1],
      maxValue: SWITZERLAND_BOUNDS_WGS84[3],
    },
  },
};

export interface CoordinateWithCrs {
  long: number;
  lat: number;
  crs: ValidCrs;
}
@customElement('ngm-cam-coordinates')
export class NgmCamCoordinates extends LitElementI18n {
  @property({ type: Object })
  accessor coordinates = {};

  @state()
  accessor key: ValidCrs = 'lv95';

  @query('.dropdown')
  accessor dropdown;

  @query('.ngm-coords-input')
  accessor coordsInput;

  createRenderRoot() {
    return this;
  }

  updated(changedProperties: PropertyValues) {
    ($(this.dropdown) as any).dropdown();
    super.updated(changedProperties);
  }

  updateCoordinates() {
    const coords = this.coordsInput.value
      .replace(/['`’´]/g, '')
      .split(', ')
      .map((c) => parseFloat(c));
    const text = i18next.t('camera_position_coordinates_input_error');
    if (isNaN(coords[0]) || isNaN(coords[1])) {
      showSnackbarError(text);
      return;
    }
    if (
      coords[0] < MIN_MAX_COORDINATE_VALUES[this.key].long.minValue ||
      coords[0] > MIN_MAX_COORDINATE_VALUES[this.key].long.maxValue
    ) {
      showSnackbarError(text);
      return;
    }
    if (
      coords[1] < MIN_MAX_COORDINATE_VALUES[this.key].lat.minValue ||
      coords[1] > MIN_MAX_COORDINATE_VALUES[this.key].lat.maxValue
    ) {
      showSnackbarError(text);
      return;
    }
    this.dispatchEvent(
      new CustomEvent<CoordinateWithCrs>('coordinates-changed', {
        detail: {
          long: coords[0],
          lat: coords[1],
          crs: this.key,
        },
      }),
    );
  }

  render() {
    if (!this.coordinates || !this.coordinates[this.key]) {
      return '';
    }
    const c = this.coordinates[this.key];
    return html`
      <div class="ngm-cam-coord">
        ${i18next.t('camera_position_coordinates_system_label')}
        <div class="ui item">
          <div class="ui fluid dropdown label">
            <div class="ngm-coords text">LV95</div>
            <i class="dropdown icon"></i>
            <div class="menu">
              <div class="item" @click=${() => (this.key = 'lv95')}>LV95</div>
              <div class="item" @click=${() => (this.key = 'wgs84')}>WGS84</div>
            </div>
          </div>
        </div>
        ${i18next.t('camera_position_coordinates_label')}
        <input
          class="ngm-coords ngm-coords-input"
          type="text"
          .value=${c[0] + ', ' + c[1]}
          @blur="${this.updateCoordinates}"
          @keydown="${(e) => e.key === 'Enter' && this.updateCoordinates()}"
        />
      </div>
    `;
  }
}
