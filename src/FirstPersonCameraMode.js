
export default class FirstPersonCameraMode {

  /**
   * @param {import('cesium/Scene/Scene').default} scene
   * @param {number} [movementFactor=0.003]
   */
  constructor(scene, movementFactor = 0.003) {
    this.scene_ = scene;

    this.movementFactor_ = movementFactor;

    this.movementX_ = 0;

    this.movementY_ = 0;

    const onMouseMoveCallback = this.onMouseMove_.bind(this);
    const onPostRenderCallback = this.onPostRender_.bind(this);

    document.addEventListener('pointerlockchange', event => {
      if (this.active) {
        // enter
        document.addEventListener('mousemove', onMouseMoveCallback);
        this.scene_.postRender.addEventListener(onPostRenderCallback);
      } else {
        // leave
        document.removeEventListener('mousemove', onMouseMoveCallback);
        this.scene_.postRender.removeEventListener(onPostRenderCallback);
      }
    });

    document.addEventListener('pointerlockerror', event => {
      console.error(event);
    });
  }

  get active() {
    return document.pointerLockElement !== null;
  }

  set active(active) {
    if (active) {
      this.scene_.canvas.requestPointerLock();
    }
  }

  onMouseMove_(event) {
    if (event.movementX && event.movementY) {
      // the condition workarounds https://bugzilla.mozilla.org/show_bug.cgi?id=1417702
      // in Firefox, event.movementX is -2 even though there is no movement
      this.movementX_ += event.movementX;
      this.movementY_ += event.movementY;
      this.scene_.requestRender();
    }
  }

  onPostRender_() {
    const camera = this.scene_.camera;

    // update camera orientation
    const heading = camera.heading + (this.movementX_ * this.movementFactor_);
    this.movementX_ = 0;

    const pitch = camera.pitch - (this.movementY_ * this.movementFactor_);
    this.movementY_ = 0;

    camera.setView({
      orientation: {
        heading: heading,
        pitch: pitch
      }
    });
  }
}
