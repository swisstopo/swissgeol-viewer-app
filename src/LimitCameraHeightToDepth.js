import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Cartographic from 'cesium/Core/Cartographic.js';


export default class LimitCameraHeightToDepth {
  /**
   * @param {import("cesium/Widgets/Viewer/Viewer/Scene").default} Scene
   * @param float depth
   */
  constructor(scene, depth) {
    this.scene_ = scene;
    this.depth_ = depth
    const onTick = this.onTick_.bind(this);
    this.scene_.postRender.addEventListener(onTick);
  }


  onTick_() {
    const camera = this.scene_.camera;
	  if (camera.positionCartographic.height <= -this.depth_){
		  camera.position = Cartesian3.fromRadians(camera.positionCartographic.longitude, camera.positionCartographic.latitude, -this.depth_)
	  }
  }
}
