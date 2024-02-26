import {
    Cartesian2,
    Cartesian3, Color, ConstantProperty,
    CustomDataSource, Entity,
    HeightReference, PolylineOutlineMaterialProperty,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Viewer
} from 'cesium';
import {CesiumDraw, DrawEndDetails} from '../draw/CesiumDraw';
import {getDimensionLabel} from '../draw/helpers';

export type MeasureOptions = {
    pointSize: number;
    pointOutlineWidth: number;
    highlightedPointSize: number;
    lineWidth: number;
    lineHighlightOutlineWidth: number
    lineColor: Color,
    pointColor: Color,
    pointOutlineColor: Color,
    highlightColor: Color,
}

export default class MeasureTool {
    readonly draw: CesiumDraw;
    private readonly viewer: Viewer;
    private readonly measureDataSource = new CustomDataSource('measure');
    private readonly measureOptions: MeasureOptions;
    private measureToolActive = false;
    private screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;
    private measurePositions: Cartesian3[] = [];
    private highlightEntity: Entity | undefined;
    private points: Entity[] = [];
    constructor(viewer: Viewer, options?: Partial<MeasureOptions>) {
        this.viewer = viewer;
        this.measureOptions = {
            pointSize: typeof options?.pointSize === 'number' ? options.pointSize : 9,
            pointOutlineWidth: typeof options?.pointOutlineWidth === 'number' ? options.pointOutlineWidth : 1,
            highlightedPointSize: typeof options?.highlightedPointSize === 'number' ? options.highlightedPointSize : 14,
            lineWidth: typeof options?.lineWidth === 'number' ? options.lineWidth : 4,
            lineHighlightOutlineWidth: typeof options?.lineHighlightOutlineWidth === 'number' ? options.lineHighlightOutlineWidth : 4,
            lineColor: options?.lineColor instanceof Color ? options.lineColor : Color.BLUE.withAlpha(0.8),
            pointColor: options?.pointColor instanceof Color ? options.pointColor : Color.WHITE,
            pointOutlineColor: options?.pointOutlineColor instanceof Color ? options.pointOutlineColor : Color.BLACK,
            highlightColor: options?.highlightColor instanceof Color ? options.highlightColor : Color.YELLOW,
        };
        this.draw = new CesiumDraw(viewer, {
            pointOptions: {
                pixelSizeDefault: this.measureOptions.pointSize,
                heightReference: HeightReference.NONE
            },
            lineClampToGround: false,
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

    highlightSegment(segmentIndex: number) {
        if (this.draw.active) return;
        const indexes = [segmentIndex, segmentIndex + 1];
        this.highlightEntity = this.measureDataSource.entities.add({
            show: true,
            polyline: {
                positions: indexes.map(i => this.measurePositions[i]),
                clampToGround: false,
                width: this.measureOptions.lineWidth + this.measureOptions.lineHighlightOutlineWidth,
                material: new PolylineOutlineMaterialProperty({
                    color: Color.TRANSPARENT,
                    outlineColor: this.measureOptions.highlightColor,
                    outlineWidth: this.measureOptions.lineHighlightOutlineWidth
                })
            }
        });
        indexes.forEach(i => {
            this.points[i].point!.color = new ConstantProperty(this.measureOptions.highlightColor);
            this.points[i].point!.pixelSize = new ConstantProperty(this.measureOptions.highlightedPointSize);
        });
        this.viewer.scene.requestRender();
    }

    removeSegmentHighlight() {
        if (!this.highlightEntity) return;
        this.measureDataSource.entities.remove(this.highlightEntity);
        this.highlightEntity = undefined;

        this.points.forEach(e => {
            e.point!.color = new ConstantProperty(this.measureOptions.pointColor);
            e.point!.pixelSize = new ConstantProperty(this.measureOptions.pointSize);
        });

        this.viewer.scene.requestRender();
    }

    addMeasureGeometry(positions: Cartesian3[]) {
        this.measurePositions = positions;
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
                width: this.measureOptions.lineWidth,
                material: this.measureOptions.lineColor,
            }
        });
        positions.forEach((pos, indx) => {
            const entity: Entity.ConstructorOptions = {
                position: pos,
                point: {
                    color: this.measureOptions.pointColor,
                    outlineWidth: this.measureOptions.pointOutlineWidth,
                    outlineColor: this.measureOptions.pointOutlineColor,
                    pixelSize: this.measureOptions.pointSize,
                    heightReference: HeightReference.NONE,
                }
            };
            if (indx === positions.length - 1) {
                entity.label = getDimensionLabel('line', distances);
            }
            this.points.push(this.measureDataSource.entities.add(entity));
        });
    }

    endMeasuring(info: DrawEndDetails) {
        this.draw.active = false;
        this.draw.clear();
        this.addMeasureGeometry(info.positions);
    }
    clearMeasureGeometry() {
        if (this.draw && this.draw.active) {
            this.draw.active = false;
            this.draw.clear();
        }
        this.measurePositions = [];
        this.points = [];
        this.measureDataSource.entities.removeAll();
        this.viewer?.scene.render();
    }
}