import NavToolsStore from './store/navTools';
import type {Scene} from 'cesium';


export default class LimitCameraHeightToDepth {
  private scene: Scene;
  private depth: number;

  constructor(scene: Scene, depth: number) {
    this.scene = scene;
    this.depth = depth;
    const onTick = this.onTick_.bind(this);
    this.scene.postRender.addEventListener(onTick);
  }

  onTick_() {
    const camera = this.scene.camera;
    if (camera.positionCartographic.height <= -this.depth) {
      NavToolsStore.setCameraHeight(-this.depth);
    }
  }
}
