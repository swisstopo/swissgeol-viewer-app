import {
    Cartesian2,
    Cartesian3, Color,
    CustomDataSource, Entity,
    HeightReference,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Viewer
} from 'cesium';
import {CesiumDraw} from '../draw/CesiumDraw';
import {DEFAULT_AOI_COLOR, GEOMETRY_LINE_ALPHA} from '../constants';
import {getDimensionLabel} from '../draw/helpers';

export default class MeasureTool {
    readonly draw: CesiumDraw;
    private readonly viewer: Viewer;
    private readonly measureDataSource = new CustomDataSource('measure');
    private measureToolActive = false;
    private screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;
    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.draw = new CesiumDraw(viewer, {
            pointOptions: {
                pixelSizeDefault: 9,
                heightReference: HeightReference.NONE
            },
            lineClampToGround: false
        });
        this.draw.type = 'line';
        this.draw.addEventListener('drawend', (evt) => this.endMeasuring((<CustomEvent>evt).detail));
        viewer.dataSources.add(this.measureDataSource);
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer!.canvas);
        this.screenSpaceEventHandler.setInputAction((click: {position: Cartesian2}) => {
            if (this.draw.active || !this.measureToolActive) return;
            const position = Cartesian3.clone(this.viewer!.scene.pickPosition(click.position));
            if (position) {
                this.clearMeasureGeometry();
                this.draw.active = true;
                this.draw.onLeftClick(click);
            }
        }, ScreenSpaceEventType.LEFT_CLICK);
    }

    set active(value: boolean) {
        this.measureToolActive = value;
        if (!value) {
            this.clearMeasureGeometry();
        }
    }

    get active() {
        return this.measureToolActive;
    }

    addMeasureGeometry(positions: Cartesian3[]) {
        const distances = positions.map((position, key) => {
            if (key === positions.length - 1) return 0;
            return Cartesian3.distance(position, positions[key + 1]) / 1000;
        }, 0);
        this.measureDataSource.entities.add({
            show: true,
            polyline: {
                show: true,
                positions: positions,
                clampToGround: false,
                width: 4,
                material: DEFAULT_AOI_COLOR.withAlpha(GEOMETRY_LINE_ALPHA),
            }
        });
        positions.forEach((pos, indx) => {
            const entity: Entity.ConstructorOptions = {
                position: pos,
                point: {
                    color: Color.WHITE,
                    outlineWidth: 1,
                    outlineColor: Color.BLACK,
                    pixelSize: 9,
                    heightReference: HeightReference.NONE,
                }
            };
            if (indx === positions.length - 1) {
                entity.label = getDimensionLabel('line', distances);
            }
            this.measureDataSource.entities.add(entity);
        });
    }

    // todo type
    endMeasuring(info) {
        this.draw.active = false;
        this.draw.clear();
        this.addMeasureGeometry(info.positions);
    }
    clearMeasureGeometry() {
        if (this.draw && this.draw.active) {
            this.draw.active = false;
            this.draw.clear();
        }
        this.measureDataSource.entities.removeAll();
        this.viewer?.scene.render();
    }
}