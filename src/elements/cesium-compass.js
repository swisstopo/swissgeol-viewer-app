// Original code from TerriaJS
// https://github.com/TerriaJS/terriajs/blob/master/lib/ReactViews/Map/Navigation/Compass.jsx

// SVG images from https://cesium.com/ion/stories/ (with permission from Cesium)

import {LitElement, css, svg, html} from 'lit-element';
import {styleMap} from 'lit-html/directives/style-map';

import Cartesian2 from 'cesium/Core/Cartesian2';
import Cartesian3 from 'cesium/Core/Cartesian3';
import Matrix4 from 'cesium/Core/Matrix4';
import Transforms from 'cesium/Core/Transforms';
import Ellipsoid from 'cesium/Core/Ellipsoid';
import Ray from 'cesium/Core/Ray';
import CesiumMath from 'cesium/Core/Math';
import getTimestamp from 'cesium/Core/getTimestamp';

const vectorScratch = new Cartesian2();
const windowPositionScratch = new Cartesian2();
const centerScratch = new Cartesian3();
const oldTransformScratch = new Matrix4();
const newTransformScratch = new Matrix4();

const pickRayScratch = new Ray();

const nominalTotalRadius = 145;
const norminalGyroRadius = 50;


const outerRingSvg = svg`<svg height="145" width="145" viewBox="0 0 145 145"><path d="M66.563 0v15.156h3.718V4.75l5.5 10.406h4.375V0h-3.719v10.406L70.938 0h-4.374zM72.5 20.219c-28.867 0-52.281 23.407-52.281 52.281s23.414 52.313 52.281 52.313c28.867 0 52.281-23.44 52.281-52.313 0-28.874-23.414-52.281-52.281-52.281zm0 1.75c13.843 0 26.369 5.558 35.5 14.562l-11.031 11 .625.625 11.031-11c8.92 9.109 14.438 21.58 14.438 35.344 0 13.765-5.518 26.227-14.438 35.344l-11.031-11-.625.625 11.031 11c-9.13 9.01-21.659 14.594-35.5 14.594-13.802 0-26.321-5.535-35.438-14.5l11.126-11.094c6.277 6.122 14.857 9.906 24.312 9.906 19.242 0 34.875-15.63 34.875-34.875 0-19.246-15.633-34.844-34.875-34.844a34.736 34.736 0 00-24.313 9.875L37.063 36.438c9.116-8.96 21.634-14.47 35.437-14.47zm-.875.843V36.75h1.75V22.812h-1.75zm-35.156 14.25l11.093 11.094A34.73 34.73 0 0037.657 72.5c0 9.472 3.774 18.056 9.907 24.344l-11.094 11.094c-8.967-9.125-14.5-21.625-14.5-35.438 0-13.813 5.533-26.32 14.5-35.438zM72.5 39.407c18.298 0 33.125 14.792 33.125 33.094S90.798 105.625 72.5 105.625c-18.298 0-33.094-14.823-33.094-33.125S54.202 39.406 72.5 39.406zM22.844 71.625v1.75h13.968v-1.75H22.845zm85.562 0v1.75h14v-1.75h-14zM71.75 108.25v13.938h1.719V108.25H71.75z"/></svg>`;
const innerRingSvg = svg`<svg height="145" width="145" viewBox="0 0 145 145"><path d="M72.719 54.375c-.477 0-.908.245-1.219.563-.31.317-.551.701-.781 1.187-.172.363-.32.792-.469 1.25-6.916 1.076-12.313 6.657-13 13.625-.328.117-.662.245-.938.375-.485.23-.901.471-1.218.781-.317.31-.563.742-.563 1.219h.032c0 .477.245.877.562 1.188.317.31.702.582 1.188.812.355.168.771.322 1.218.469 1.371 6.1 6.421 10.834 12.719 11.812.147.447.3.863.469 1.219.23.486.47.87.781 1.188.31.317.742.562 1.219.562.476 0 .877-.245 1.187-.563.31-.317.583-.701.813-1.187.172-.363.319-.792.469-1.25 6.249-1.017 11.256-5.718 12.624-11.781.448-.147.864-.3 1.22-.469.485-.23.9-.502 1.218-.813.317-.31.563-.71.563-1.187h-.032c0-.477-.245-.909-.562-1.219-.317-.31-.702-.551-1.188-.781a9.68 9.68 0 00-.906-.375c-.685-6.922-6.052-12.496-12.906-13.625-.15-.462-.327-.885-.5-1.25a4.292 4.292 0 00-.813-1.188c-.31-.317-.71-.562-1.187-.562zm-.063 1.406c.036-.013.06 0 .063 0 .005 0 .043-.022.187.125.145.148.344.447.531.844.064.135.124.31.188.469-.32-.02-.644-.063-.969-.063-.289 0-.558.047-.844.063.064-.16.124-.334.188-.469.188-.397.356-.696.5-.844a.508.508 0 01.156-.125zm0 2.407c.448 0 .906.054 1.344.093.177.593.348 1.271.5 2.032.475 2.37.808 5.463.938 8.937-.907-.029-1.835-.063-2.782-.063-.923 0-1.802.036-2.687.063.138-3.474.493-6.567.969-8.938.154-.771.32-1.463.5-2.062a14.53 14.53 0 011.218-.063zm-2.719.28c-.13.5-.26.988-.374 1.563-.499 2.488-.839 5.694-.97 9.25-3.213.152-6.119.48-8.406.938-.682.136-1.275.28-1.843.437.799-6.135 5.504-11.036 11.593-12.187zm5.563.032c6.043 1.184 10.705 6.053 11.5 12.156-.57-.156-1.2-.302-1.875-.437-2.263-.453-5.109-.784-8.281-.938-.13-3.556-.47-6.762-.969-9.25-.113-.564-.248-1.04-.375-1.531zm-2.844 12.094c.96 0 1.896.033 2.813.062.013.612.031 1.215.031 1.844 0 1.229-.014 2.438-.063 3.594-.897.028-1.811.062-2.75.062-.927 0-1.83-.034-2.718-.062a82.244 82.244 0 01-.063-3.594c0-.629.018-1.232.031-1.844.896-.028 1.784-.062 2.72-.062zm-4.094.094c-.012.606-.03 1.19-.03 1.812 0 1.224.015 2.408.062 3.563-3.125-.15-5.921-.472-8.094-.907-.785-.157-1.511-.316-2.125-.5a14.206 14.206 0 01-.188-2.156c0-.116.029-.229.032-.344.643-.203 1.39-.39 2.25-.562 2.167-.434 4.979-.756 8.093-.906zm8.313.03c3.075.153 5.824.447 7.969.876.857.171 1.63.36 2.281.562.003.115 0 .229 0 .344 0 .736-.08 1.45-.188 2.156-.598.18-1.29.346-2.062.5-2.158.432-4.932.755-8.031.906.047-1.154.062-2.338.062-3.562 0-.612-.019-1.185-.031-1.781zm-19.719 1.844c.003.573.061 1.132.125 1.688-.125-.051-.266-.105-.375-.156-.396-.188-.665-.388-.812-.531-.147-.144-.157-.183-.157-.188 0-.005-.022-.075.126-.219.147-.144.447-.312.843-.5.071-.033.172-.06.25-.094zm31.032 0c.082.036.175.06.25.094.396.188.665.356.812.5.147.144.156.214.156.219 0 .005-.009.044-.156.188-.147.143-.416.343-.813.53-.097.047-.233.08-.343.126.062-.547.091-1.094.094-1.656zm-29.5 3.626c.479.123.983.234 1.53.343 2.303.46 5.23.787 8.47.938.167 2.843.46 5.433.874 7.5.116.575.246 1.063.376 1.562-5.464-1.028-9.834-5.092-11.25-10.344zm27.968 0C85.248 81.407 80.92 85.442 75.5 86.5c.127-.49.262-.967.375-1.531.414-2.067.708-4.657.875-7.5 3.204-.152 6.088-.48 8.375-.938.548-.11 1.052-.22 1.531-.344zM70.062 77.53c.866.026 1.724.031 2.626.031.912 0 1.782-.004 2.656-.03-.165 2.736-.454 5.207-.844 7.156-.152.76-.323 1.438-.5 2.03-.437.04-.896.063-1.344.063-.415 0-.812-.029-1.219-.062a22.698 22.698 0 01-.5-2.031c-.39-1.95-.7-4.42-.874-7.157zm1.75 10.281c.285.016.555.032.844.032.325 0 .649-.012.969-.031-.06.148-.127.31-.188.437-.187.397-.386.696-.53.844-.145.147-.183.125-.188.125-.006 0-.075.022-.219-.125-.144-.148-.312-.447-.5-.844a8.629 8.629 0 01-.188-.438z"/></svg>`;
const rotationMarkerSvg = svg`<svg height="145" width="145" viewBox="0 0 145 145"><path d="M72.469 22.031c-12.963.02-25.947 4.973-35.781 14.844l11.156 11.094c13.678-13.729 35.599-13.742 49.281-.063l11.125-11.125c-9.848-9.846-22.818-14.769-35.781-14.75z"/></svg>`;

class CesiumCompass extends LitElement {

  static get properties() {
    return {
      scene: {type: Object},
      clock: {type: Object},
      ready: {type: Boolean},
      heading: {type: Number},
      orbitCursorAngle: {type: Number},
      orbitCursorOpacity: {type: Number}
    };
  }

  static get styles() {
    return css`
      :host * {
        box-sizing: content-box;
      }
      .compass {
        position: absolute;
        right: 0;
        top: 0;
        width: 95px;
        height: 95px;
        cursor: pointer;
      }
      .outer-ring-background {
        position: absolute;
        top: 14px;
        left: 14px;
        width: 44px;
        height: 44px;
        border-radius: 100%;
        border: 12px solid var(--cesium-compass-stroke-color);
      }
      .inner-ring-background {
        position: absolute;
        top: 30px;
        left: 30px;
        width: 33px;
        height: 33px;
        border-radius: 100%;
        background-color: var(--cesium-compass-stroke-color);
        border: 1px solid var(--cesium-compass-fill-color);
      }
      .rotation-marker, .outer-ring, .inner-ring {
        position: absolute;
        top: 0;
        width: 95px;
        height: 95px;
        fill: var(--cesium-compass-fill-color);
      }
      .rotation-marker svg, .outer-ring svg, .inner-ring svg {
        width: 100%;
        height: 100%;
      }
    `;
  }

  constructor() {
    super();
    this.ready = false;

    this.unlistenFromPostRender = null;
    this.unlistenFromClockTick = null;

    this.orbitCursorOpacity = 0;

    this.handleRotatePointerMoveFunction = this.handleRotatePointerMove.bind(this);
    this.handleRotatePointerUpFunction = this.handleRotatePointerUp.bind(this);

    this.handleOrbitPointerMoveFunction = this.handleOrbitPointerMove.bind(this);
    this.handleOrbitPointerUpFunction = this.handleOrbitPointerUp.bind(this);
    this.handleOrbitTickFunction = this.handleOrbitTick.bind(this);

    this.context = {};
  }

  updated() {
    if (this.scene && this.clock && !this.unlistenFromPostRender) {
      this.unlistenFromPostRender = this.scene.postRender.addEventListener(() => {
        this.heading = this.scene.camera.heading;
      });
      this.ready = true;
    }
  }

  get outerRingStyle() {
    return {
      transform: `rotate(-${this.heading}rad)`
    };
  }

  get rotationMarkerStyle() {
    return {
      transform: `rotate(-${this.orbitCursorAngle}rad)`,
      opacity: this.orbitCursorOpacity
    };
  }

  disconnectedCallback() {
    if (this.unlistenFromPostRender) {
      this.unlistenFromPostRender();
    }
    super.disconnectedCallback();
  }

  handlePointerDown(event) {
    const camera = this.scene.camera;
    const compassElement = event.currentTarget;
    this.context.compassRectangle = compassElement.getBoundingClientRect();
    this.context.compassCenter = new Cartesian2(
      (this.context.compassRectangle.right - this.context.compassRectangle.left) / 2,
      (this.context.compassRectangle.bottom - this.context.compassRectangle.top) / 2
    );
    const clickLocation = new Cartesian2(
      event.clientX - this.context.compassRectangle.left,
      event.clientY - this.context.compassRectangle.top
    );
    const vector = Cartesian2.subtract(clickLocation, this.context.compassCenter, vectorScratch);
    const distanceFromCenter = Cartesian2.magnitude(vector);

    windowPositionScratch.x = this.scene.canvas.clientWidth / 2;
    windowPositionScratch.y = this.scene.canvas.clientHeight / 2;
    const ray = camera.getPickRay(windowPositionScratch, pickRayScratch);
    this.context.viewCenter = this.scene.globe.pick(ray, this.scene, centerScratch);

    this.context.frame = Transforms.eastNorthUpToFixedFrame(
      this.context.viewCenter ? this.context.viewCenter : camera.positionWC,
      Ellipsoid.WGS84,
      newTransformScratch
    );

    const maxDistance = this.context.compassRectangle.width / 2;
    const distanceFraction = distanceFromCenter / maxDistance;

    if (distanceFraction < norminalGyroRadius / nominalTotalRadius) {
      this.orbit(vector);
    } else if (distanceFraction < 1) {
      this.rotate(vector);
    }
    event.stopPropagation();
    event.preventDefault();
  }

  rotate(cursorVector) {
    const camera = this.scene.camera;

    this.context.rotateInitialCursorAngle = Math.atan2(-cursorVector.y, cursorVector.x);

    const oldTransform = Matrix4.clone(camera.transform, oldTransformScratch);

    camera.lookAtTransform(this.context.frame);
    this.context.rotateInitialCameraAngle = Math.atan2(camera.position.y, camera.position.x);
    camera.lookAtTransform(oldTransform);

    document.addEventListener('pointermove', this.handleRotatePointerMoveFunction, false);
    document.addEventListener('pointerup', this.handleRotatePointerUpFunction, false);
  }

  handleRotatePointerMove(event) {
    const camera = this.scene.camera;
    const clickLocation = new Cartesian2(
      event.clientX - this.context.compassRectangle.left,
      event.clientY - this.context.compassRectangle.top
    );
    const vector = Cartesian2.subtract(clickLocation, this.context.compassCenter, vectorScratch);
    const angle = Math.atan2(-vector.y, vector.x);

    const angleDifference = angle - this.context.rotateInitialCursorAngle;
    const newCameraAngle = CesiumMath.zeroToTwoPi(
      this.context.rotateInitialCameraAngle - angleDifference
    );

    const oldTransform = Matrix4.clone(camera.transform, oldTransformScratch);
    camera.lookAtTransform(this.context.frame);
    const currentCameraAngle = Math.atan2(camera.position.y, camera.position.x);
    camera.rotateRight(newCameraAngle - currentCameraAngle);
    camera.lookAtTransform(oldTransform);
  }

  handleRotatePointerUp(event) {
    document.removeEventListener('pointermove', this.handleRotatePointerMoveFunction, false);
    document.removeEventListener('pointerup', this.handleRotatePointerUpFunction, false);
  }

  orbit(cursorVector) {
    this.context.orbitIsLook = !this.context.viewCenter;
    this.context.orbitLastTimestamp = getTimestamp();

    document.addEventListener('pointermove', this.handleOrbitPointerMoveFunction, false);
    document.addEventListener('pointerup', this.handleOrbitPointerUpFunction, false);

    this.unlistenFromClockTick = this.clock.onTick.addEventListener(this.handleOrbitTickFunction);

    this.updateAngleAndOpacity(cursorVector, this.context.compassRectangle.width);
  }

  handleOrbitTick() {
    const camera = this.scene.camera;
    const timestamp = getTimestamp();

    const deltaT = timestamp - this.context.orbitLastTimestamp;
    const rate = ((this.orbitCursorOpacity - 0.5) * 2.5) / 1000;
    const distance = deltaT * rate;

    const angle = this.orbitCursorAngle + CesiumMath.PI_OVER_TWO;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    const oldTransform = Matrix4.clone(camera.transform, oldTransformScratch);
    camera.lookAtTransform(this.context.frame);
    if (this.context.orbitIsLook) {
      camera.look(Cartesian3.UNIT_Z, -x);
      camera.look(camera.right, -y);
    } else {
      camera.rotateLeft(x);
      camera.rotateUp(y);
    }
    camera.lookAtTransform(oldTransform);

    this.context.orbitLastTimestamp = timestamp;
  }

  updateAngleAndOpacity(vector, compassWidth) {
    const angle = Math.atan2(-vector.y, vector.x);
    this.orbitCursorAngle = CesiumMath.zeroToTwoPi(angle - CesiumMath.PI_OVER_TWO);

    const distance = Cartesian2.magnitude(vector);
    const maxDistance = compassWidth / 2.0;
    const distanceFraction = Math.min(distance / maxDistance, 1.0);
    this.orbitCursorOpacity = 0.5 * distanceFraction * distanceFraction + 0.5;
  }

  handleOrbitPointerMove(event) {
    const clickLocation = new Cartesian2(
      event.clientX - this.context.compassRectangle.left,
      event.clientY - this.context.compassRectangle.top
    );
    const cursorVector = Cartesian2.subtract(clickLocation, this.context.compassCenter, vectorScratch);
    this.updateAngleAndOpacity(cursorVector, this.context.compassRectangle.width);

  }

  handleOrbitPointerUp(event) {
    document.removeEventListener('pointermove', this.handleOrbitPointerMoveFunction, false);
    document.removeEventListener('pointerup', this.handleOrbitPointerUpFunction, false);
    this.unlistenFromClockTick();
    this.orbitCursorOpacity = 0;
  }

  render() {
    if (this.ready) {
      return html`
        <div class="compass" @pointerdown=${this.handlePointerDown}>
          <div class="outer-ring-background"></div>
          <div class="outer-ring" style=${styleMap(this.outerRingStyle)}>${outerRingSvg}</div>
          <div class="inner-ring-background"></div>
          <div class="inner-ring">${innerRingSvg}</div>
          <div class="rotation-marker" style=${styleMap(this.rotationMarkerStyle)}>${rotationMarkerSvg}</div>
        </div>
      `;
    } else {
      return html``;
    }
  }
}

customElements.define('cesium-compass', CesiumCompass);
