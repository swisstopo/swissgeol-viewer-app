import { BaseService } from 'src/services/base.service';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { CesiumService } from 'src/services/cesium.service';
import { Control2dController } from 'src/features/controls/control-2d.controller';
import { CameraControllerService } from 'src/features/controls/camera-controller.service';

export class ControlsService extends BaseService {
  private readonly is2DActiveSubject = new BehaviorSubject(false);

  constructor() {
    super();

    BaseService.onReady(() => void this.setup());
  }

  private async setup(): Promise<void> {
    const [viewer, cameraControllerService] = await Promise.all([
      CesiumService.inject().then((s) => firstValueFrom(s.viewer$)),
      CameraControllerService.inject(),
    ]);
    const control2d = new Control2dController(viewer, cameraControllerService);
    this.is2DActive$.subscribe(control2d.toggle);
  }

  get is2DActive$(): Observable<boolean> {
    return this.is2DActiveSubject.asObservable();
  }

  get is2DActive(): boolean {
    return this.is2DActiveSubject.value;
  }

  set2DActive(isActive: boolean): void {
    this.is2DActiveSubject.next(isActive);
  }
}
