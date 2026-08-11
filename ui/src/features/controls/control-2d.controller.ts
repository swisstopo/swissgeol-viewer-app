import {
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  Math as CesiumMath,
  sampleTerrainMostDetailed,
  Viewer,
} from 'cesium';
import { DEFAULT_VIEW } from 'src/constants';
import { PickService } from 'src/services/pick.service';
import { CameraControllerService } from 'src/features/controls/camera-controller.service';

/**
 * `Control2D` contains the ability to toggle the viewer in and out of the 2D mode.
 *
 * In 2D mode, the map can only be looked at top-down,
 * with any gestures that would rotate the camera into a 3D view being disabled.
 */
export class Control2dController {
  private isActive = false;

  constructor(
    private readonly viewer: Viewer,
    private readonly cameraControllerService: CameraControllerService,
  ) {}

  readonly toggle = (isActive: boolean): void => {
    if (this.isActive === isActive) {
      return;
    }
    if (isActive) {
      this.activate();
    } else {
      this.deactivate();
    }
    this.isActive = isActive;
  };

  private activate(): void {
    this.rotateCameraTo2D().then();
    this.disableTiltGestures();
  }

  private deactivate(): void {
    this.enableTiltGestures();
  }

  private async rotateCameraTo2D(): Promise<void> {
    // Find the position that the camera is looking at.
    // We want to adjust the camera to look down at that position.
    const center = new Cartesian2(
      this.viewer.canvas.clientWidth / 2,
      this.viewer.canvas.clientHeight / 2,
    );
    const position = PickService.get().pick(center);

    // If we can't find the center position, then the camera is looking at the sky.
    // In that case, we simply switch to the default 2d view.
    if (position === null) {
      this.viewer.camera.flyTo({
        duration: 2,
        ...DEFAULT_VIEW,
      });
      return;
    }

    // Check if the camera is below the terrain.
    const cameraPosition = this.viewer.scene.camera.positionCartographic;
    const [terrainPosition] = await sampleTerrainMostDetailed(
      this.viewer.terrainProvider,
      [cameraPosition.clone()],
    );

    const heightDifference = cameraPosition.height - terrainPosition.height;
    const targetHeight =
      heightDifference < 0
        ? // If the camera is below the terrain, we adjust the height so we end up as far above the terrain as we were below it.
          terrainPosition.height - heightDifference
        : // If the camera is above the terrain, we simply keep the current height.
          cameraPosition.height;

    // Find the position that we want to rotate to by combining the position that the camera is looking at
    // with the height adjusted to be above the terrain.
    const targetCartographic =
      Ellipsoid.WGS84.cartesianToCartographic(position);
    const destination = Cartesian3.fromRadians(
      targetCartographic.longitude,
      targetCartographic.latitude,
      targetHeight,
    );

    // Adjust the camera, ensuring that we are looking down at the map.
    this.viewer.camera.flyTo({
      duration: 2,
      destination,
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
    });
  }

  private enableTiltGestures(): void {
    this.cameraControllerService.addController(
      this.cameraControllerService.tiltController,
    );
  }

  private disableTiltGestures(): void {
    this.cameraControllerService.removeController(
      this.cameraControllerService.tiltController,
    );
  }
}
