import {
  CustomDataSource,
  GeoJsonDataSource,
  ImageryLayer,
  VoxelPrimitive,
} from 'cesium';
import { PickableCesium3DTileset } from './layers/helpers';
import EarthquakeVisualizer from './earthquakeVisualization/earthquakeVisualizer';

export interface LayerTreeNode {
  type?: LayerType;
  layer?: string;
  label: string;
  assetId?: number;
  ionToken?: string;
  propsOrder?: string[];
  url?: string;
  detailsUrl?: string;
  downloadUrl?: string;
  downloadDataType?: string;
  downloadDataPath?: string;
  geocatId?: string;
  // A "displayed" layer appears in the list of active layers.
  displayed?: boolean;
  // A "visible" layer is actually shown on the globe.
  // Normally, visible => displayed
  visible?: boolean;
  pickable?: boolean;
  opacity?: number;
  opacityDisabled?: boolean;
  style?: any;
  legend?: string;
  backgroundId?: string;
  maximumLevel?: number;
  queryType?: string;
  noQuery?: boolean;
  restricted?: string[];
  aws_s3_bucket?: string;
  aws_s3_key?: string;
  previewColor?: string;
  children?: LayerTreeNode[];
  voxelDataName?: string;
  voxelColors?: VoxelColors;
  voxelFilter?: any;
  customAsset?: boolean;
  wmtsTimes?: string[];
  wmtsCurrentTime?: string;
}

type LayerInstances =
  | GeoJsonDataSource
  | PickableCesium3DTileset
  | VoxelPrimitive
  | ImageryLayer
  | CustomDataSource
  | EarthquakeVisualizer;
export type LayerPromise =
  | Promise<GeoJsonDataSource>
  | Promise<PickableCesium3DTileset>
  | Promise<VoxelPrimitive>
  | Promise<ImageryLayer>
  | Promise<CustomDataSource>
  | Promise<EarthquakeVisualizer>
  | Promise<LayerInstances>;

export interface LayerConfig extends LayerTreeNode {
  add?: (value: number) => void;
  remove?: () => void;
  setTime?: (time: string) => void;
  heightOffset?: number;
  load?: () => LayerPromise;
  setVisibility?: (value: boolean) => void;
  setOpacity?: (value: number) => void;
  promise?: LayerPromise;
  notSaveToPermalink?: boolean;
  ownKml?: boolean;
  topicKml?: boolean;
  origin?: string;
}

export interface VoxelColors {
  label?: string;
  range: number[];
  noData: number;
  undefinedData: number;
  colors: string[];
}

export type VoxelFilter = {
  conductivityRange: [number, number];
  lithologyDataName: string;
  conductivityDataName: string;
};

export type IndexVoxelFilter = VoxelFilter & {
  lithology: { index: number; label: string }[];
};

export enum LayerType {
  swisstopoWMTS = 'swisstopoWMTS',
  tiles3d = '3dtiles',
  voxels3dtiles = 'voxels3dtiles',
  ionGeoJSON = 'ionGeoJSON',
  earthquakes = 'earthquakes',
}

export const DEFAULT_LAYER_OPACITY = 1;

const t = (a: string) => a;

const SWISSTOPO_LABEL_STYLE = {
  labelStyle: 0, //LabelStyle.FILL,
  labelText: '${DISPLAY_TEXT}',
  disableDepthTestDistance: Infinity,
  anchorLineEnabled: false,
  heightOffset: 200,
  pointSize: 0,
  labelColor: {
    conditions: [
      ['${OBJEKTART} === "See"', 'color("blue")'],
      ['true', 'color("black")'],
    ],
  },
  labelOutlineColor: 'color("white", 1)',
  labelOutlineWidth: 5,
  font: {
    conditions: [
      ['${OBJEKTART} === "See"', '"bold 32px arial"'],
      ['true', '"32px arial"'],
    ],
  },
  scaleByDistance: {
    conditions: [
      ['${LOD} === "7"', 'vec4(1000, 1, 5000, 0.4)'],
      ['${LOD} === "6"', 'vec4(1000, 1, 5000, 0.4)'],
      ['${LOD} === "5"', 'vec4(1000, 1, 8000, 0.4)'],
      ['${LOD} === "4"', 'vec4(1000, 1, 10000, 0.4)'],
      ['${LOD} === "3"', 'vec4(1000, 1, 20000, 0.4)'],
      ['${LOD} === "2"', 'vec4(1000, 1, 30000, 0.4)'],
      ['${LOD} === "1"', 'vec4(1000, 1, 50000, 0.4)'],
      ['${LOD} === "0"', 'vec4(1000, 1, 500000, 0.4)'],
      ['true', 'vec4(1000, 1, 10000, 0.4)'],
    ],
  },
  distanceDisplayCondition: {
    conditions: [
      ['${LOD} === "7"', 'vec2(0, 5000)'],
      ['${LOD} === "6"', 'vec2(0, 5000)'],
      ['${LOD} === "5"', 'vec2(0, 8000)'],
      ['${LOD} === "4"', 'vec2(0, 10000)'],
      ['${LOD} === "3"', 'vec2(0, 20000)'],
      ['${LOD} === "2"', 'vec2(0, 30000)'],
      ['${LOD} === "1"', 'vec2(0, 50000)'],
      ['${LOD} === "0"', 'vec2(0, 500000)'],
    ],
  },
};

// Property orders
const DOWNLOAD_PROP_ORDER = [
  'Download Move',
  'Download GoCad',
  'Download DXF',
  'Download ASCII',
  'Download All data',
];
const DOWNLOAD_ROOT_GEOMOL = 'https://download.swissgeol.ch/geomol/';
const DOWNLOAD_ROOT_VOXEL = 'https://download.swissgeol.ch/voxel/';
const CENOZOIC_BEDROCK_ORDER = ['Name', 'Horizon', ...DOWNLOAD_PROP_ORDER];
CENOZOIC_BEDROCK_ORDER.splice(6, 0, 'Download ESRI-GRID');
const CONSOLIDATED_ORDER = [
  'Name',
  'Horizon',
  'HARMOS-ORIGINAL',
  ...DOWNLOAD_PROP_ORDER,
];
const FAULTS_ORDER = [
  'Name',
  'Source',
  'Status',
  'Type',
  'Version',
  ...DOWNLOAD_PROP_ORDER,
];
const TEMPERATURE_HORIZON_ORDER = ['name', 'temp_c'];
const TEMPERATURE_HORIZON_BGL_ORDER = ['name', 'temp_c', 'depth_bgl'];
const EARTHQUAKES_PROP_ORDER = [
  'Time',
  'Magnitude',
  'Depthkm',
  'EventLocationName',
  'Details',
];

const voxelNoData = -99999;
const voxelUndefinedData = -9999;

const voxelFilter: VoxelFilter = {
  conductivityRange: [-9, -1],
  lithologyDataName: 'Index',
  conductivityDataName: 'logk',
};

const temperaturVoxelColors: VoxelColors = {
  label: t('Temperature'),
  range: [10, 300],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(10, 0, 121)',
    'rgb(40, 0, 150)',
    'rgb(20, 5, 175)',
    'rgb(0, 10, 200)',
    'rgb(0, 25, 212)',
    'rgb(0, 40, 224)',
    'rgb(26, 102, 240)',
    'rgb(13, 129, 248)',
    'rgb(25, 175, 255)',
    'rgb(50, 190, 255)',
    'rgb(68, 202, 255)',
    'rgb(97, 225, 240)',
    'rgb(106, 235, 225)',
    'rgb(124, 235, 200)',
    'rgb(138, 236, 174)',
    'rgb(172, 245, 168)',
    'rgb(205, 255, 162)',
    'rgb(223, 245, 141)',
    'rgb(240, 236, 121)',
    'rgb(247, 215, 104)',
    'rgb(255, 189, 87)',
    'rgb(255, 160, 69)',
    'rgb(244, 117, 75)',
    'rgb(238, 80, 78)',
    'rgb(255, 90, 90)',
    'rgb(255, 124, 124)',
    'rgb(255, 158, 158)',
    'rgb(245, 179, 174)',
    'rgb(255, 196, 196)',
    'rgb(255, 215, 215)',
    'rgb(255, 235, 235)',
    'rgb(255, 255, 255)',
  ],
};

const logkVoxelColors: VoxelColors = {
  range: [-9, -1],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: ['rgb(0, 102, 255)', 'rgb(255, 204, 0)', 'rgb(204, 0, 0)'],
};

const birrIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 67],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)', // undefined
    'rgb(225, 81, 194)', // 22
    'rgb(137, 255, 147)', // 46
    'rgb(121, 255, 132)', // 53
    'rgb(0, 255, 234)', // 3
    'rgb(173, 173, 173)', // 16
    'rgb(105, 255, 117)', // 40
    'rgb(143, 143, 143)', // 17
    'rgb(112, 112, 112)', // 38
    'rgb(170, 0, 255)', // 24
    'rgb(89, 255, 102)', // 42
    'rgb(255, 255, 255)', // 61
    'rgb(208, 224, 161)', // 31
    'rgb(72, 255, 88)', // 44
    'rgb(56, 255, 73)', // 26
    'rgb(199, 218, 143)', // 27
    'rgb(255, 255, 255)', // 62
    'rgb(255, 255, 255)', // 60
    'rgb(140, 217, 255)', // 14
    'rgb(128, 212, 255)', // 1
    'rgb(115, 208, 255)', // 34
    'rgb(102, 204, 255)', // 23
    'rgb(77, 195, 255)', // 51
    'rgb(64, 191, 255)', // 8
    'rgb(190, 212, 126)', // 29
    'rgb(181, 206, 108)', // 30
    'rgb(255, 255, 255)', // 13
    'rgb(38, 183, 255)', // 5
    'rgb(40, 255, 58)', // 36
    'rgb(173, 200, 90)', // 2
    'rgb(26, 178, 255)', // 47
    'rgb(13, 175, 255)', // 28
    'rgb(255, 255, 255)', // 21
    'rgb(24, 255, 43)', // 10
    'rgb(0, 170, 255)', // 41
    'rgb(8, 255, 29)', // 11
    'rgb(255, 255, 255)', // 18
    'rgb(0, 153, 230)', // 25
    'rgb(255, 255, 0)', // 48
    'rgb(0, 247, 21)', // 33
    'rgb(0, 231, 19)', // 56
    'rgb(0, 144, 217)', // 12
    'rgb(164, 194, 73)', // 9
    'rgb(108, 129, 43)', // 35
    'rgb(0, 93, 140)', // 49
    'rgb(255, 255, 255)', // 50
    'rgb(0, 215, 18)', // 19
    'rgb(255, 255, 255)', // 39
    'rgb(255, 255, 255)', // 63
    'rgb(0, 127, 191)', // 32
    'rgb(0, 127, 191)', // 64
    'rgb(152, 182, 61)', // 20
    'rgb(0, 199, 17)', // 4
    'rgb(0, 183, 15)', // 45
    'rgb(0, 134, 11)', // 52
    'rgb(0, 166, 14)', // 54
    'rgb(137, 165, 55)', // 37
    'rgb(255, 255, 255)', // 43
    'rgb(0, 110, 166)', // 57
    'rgb(0, 102, 153)', // 15
    'rgb(51, 51, 51)', // 6
    'rgb(0, 150, 13)', // 55
    'rgb(123, 147, 49)', // 7
    'rgb(255, 255, 255)', // 65
    'rgb(255, 255, 255)', // 66
    'rgb(255, 255, 255)', // 67
  ],
};

const birrIndexVoxelFilter: IndexVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { index: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    { index: 22, label: 'künstliche Aufschüttung' },
    { index: 46, label: 'Überschwemmungssedimente' },
    { index: 53, label: 'Verlandungssedimente' },
    { index: 3, label: 'Bachschutt' },
    { index: 16, label: 'Hanglehm' },
    { index: 40, label: 'Schwemmlehm' },
    { index: 17, label: 'Hangschutt' },
    { index: 38, label: 'Rutschungsschutt' },
    { index: 24, label: 'Löss' },
    { index: 42, label: 'Stetten-Lehm' },
    { index: 61, label: 'Eiszeitliche Seesedimente' },
    { index: 31, label: 'Pulveren-Moräne' },
    { index: 44, label: 'Tanklager-Formation' },
    { index: 26, label: 'Mellingen-Lehm' },
    { index: 27, label: 'Mellingen-Moräne' },
    { index: 62, label: 'Mellingen-Schotter' },
    { index: 60, label: 'Birmenstorf-Glazigene Sed.' },
    { index: 14, label: 'Gruemet-Schotter' },
    { index: 1, label: 'Aaretal-Schotter' },
    { index: 34, label: 'Reusstal-Schotter' },
    { index: 23, label: 'Limmattal-Schotter' },
    { index: 51, label: 'Dättwil-Schotter' },
    { index: 8, label: 'Bünztalschotter' },
    { index: 29, label: 'Oberhard-Moräne' },
    { index: 30, label: 'Othmarsingen-Moräne' },
    { index: 13, label: 'Flüefeld-Schotter' },
    { index: 5, label: 'Birr-Schotter' },
    { index: 36, label: 'Rüsshalde-Formation' },
    { index: 2, label: 'Ämmert-Moräne' },
    { index: 47, label: 'Aemmert-Schotter' },
    { index: 28, label: 'Mülligen-Schotter' },
    { index: 21, label: 'Hinterbänkler-Formation' },
    { index: 10, label: 'Dättwil-Lehm' },
    { index: 41, label: 'Seebli-Formation' },
    { index: 11, label: 'Fahracher-Formation' },
    { index: 18, label: 'Hard-Schotter' },
    { index: 25, label: 'Lupfig-Schotter' },
    { index: 48, label: 'Reusstal-Sand' },
    { index: 33, label: 'Reusstal-Lehm' },
    { index: 56, label: 'Vogelsang-Formation' },
    { index: 12, label: 'Fislisbach-Schotter' },
    { index: 9, label: 'Burghalden-Moräne' },
    { index: 35, label: 'Rüfenach-Moräne' },
    { index: 49, label: 'Rüfenach-Schotter' },
    { index: 50, label: 'Ruckfeld-Schotter' },
    { index: 19, label: 'Hausen-Lehm' },
    { index: 39, label: 'Schlattboden-Schotter' },
    { index: 63, label: 'Remigen-Moräne' },
    { index: 32, label: 'Remigen-Schotter' },
    { index: 64, label: 'Remigen-Sediment' },
    { index: 20, label: 'Hausen-Moräne' },
    { index: 4, label: 'Birr-Lehm' },
    { index: 45, label: 'Tannholz-Formation' },
    { index: 52, label: 'Buenztal-Lehm' },
    { index: 54, label: 'Birch-Formation' },
    { index: 37, label: 'Rütenen-Moräne' },
    { index: 43, label: 'Strick-Schotter' },
    { index: 57, label: 'Oetlisberg-Schotter' },
    { index: 15, label: 'Habsburg-Schotter' },
    { index: 6, label: 'Brand-Formation' },
    { index: 55, label: 'Moos-Lehm' },
    { index: 7, label: 'Brand-Moräne' },
    { index: 65, label: 'Riniken-Moräne' },
    { index: 66, label: 'Riniken-Seesedimente' },
    { index: 67, label: 'Bruggerberg-Schotter' },
  ],
};

const aaretalIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 23],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)',
    'rgb(92, 255, 105)',
    'rgb(122, 211, 255)',
    'rgb(128, 128, 128)',
    'rgb(0, 255, 234)',
    'rgb(92, 201, 255)',
    'rgb(31, 255, 49)',
    'rgb(179, 204, 102)',
    'rgb(61, 190, 255)',
    'rgb(31, 180, 255)',
    'rgb(0, 170, 255)',
    'rgb(128, 153, 51)',
    'rgb(0, 150, 224)',
    'rgb(0, 224, 19)',
    'rgb(0, 129, 194)',
    'rgb(64, 77, 25)',
    'rgb(0, 163, 14)',
    'rgb(0, 109, 163)',
    'rgb(0, 88, 133)',
    'rgb(255, 255, 0)',
    'rgb(0, 68, 102)',
    'rgb(0, 102, 9)',
  ],
};

const aaretalVoxelFilter: IndexVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { index: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    { index: 3, label: 'Verlandungssedimente, Sumpf, Ried' },
    {
      index: 4,
      label:
        'Subrezente bis rezente Alluvionen (Fluss- und Bachschotter, Überschwemmungssediment, undifferenziert)',
    },
    { index: 5, label: 'Hangschutt / Hanglehm (undifferenziert)' },
    { index: 6, label: 'Bachschutt / Bachschuttkegel (undifferenziert)' },
    { index: 7, label: 'Spät- bis postglaziale Schotter' },
    {
      index: 8,
      label:
        'Spät- bis postglaziale Stausedimente und Seeablagerungen (undifferenziert)',
    },
    { index: 9, label: 'Spätglaziale Moräne (undifferenziert)' },
    {
      index: 10,
      label:
        'Rückzugsschotter der Letzten Vergletscherung ("Felderschotter" und Äquivalente)',
    },
    { index: 11, label: 'Stauschotter (undifferenziert)' },
    { index: 12, label: 'Rinnenschotter' },
    { index: 13, label: 'Moräne der Letzten Vergletscherung' },
    {
      index: 14,
      label:
        'Vorstossschotter der Letzten Vergletscherung (vorwiegend Münsingen- u. Karlsruhe-Schotter)',
    },
    { index: 15, label: 'Interglaziale Seetone (Eemzeitliche Seetone)' },
    {
      index: 16,
      label:
        'Rückzugsschotter der Vorletzten Vergletscherung, Kies-Sand-Komplex von Kleinhöchstetten',
    },
    { index: 17, label: 'Moräne der Vorletzten Vergletscherung ("Altmoräne")' },
    {
      index: 18,
      label:
        'Vorletzteiszeitliche glaziolakustrische Ablagerungen und Schlammmoräne',
    },
    { index: 19, label: 'Alte Deltaschotter im Belpmoos' },
    { index: 20, label: 'Uttigen-Bümberg-Steghalde-Schotter' },
    { index: 21, label: 'Oppligen-Sand' },
    { index: 22, label: 'Raintal-Deltaschotter, Hani-Deltaschotter' },
    { index: 23, label: 'Alte Seetone' },
  ],
};

const genevaIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 12000],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)',
    'rgb(55, 169, 0)',
    'rgb(115, 223, 254)',
    'rgb(167, 111, 0)',
    'rgb(0, 94, 230)',
    'rgb(253, 169, 0)',
    'rgb(254, 190, 232)',
    'rgb(150, 120, 255)',
    'rgb(255, 255, 0)',
    'rgb(168, 168, 0)',
    'rgb(255, 235, 191)',
  ],
};

const genevaIndexVoxelFilter: IndexVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { index: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    {
      index: 3000,
      label:
        'Eboulis, Formations de pente, Colluvions, Limons de ruissellement',
    },
    { index: 4000, label: 'Alluvions de terrasses' },
    { index: 5000, label: 'Dépôts ou vases lacustres, tourbe, craie lacustre' },
    { index: 6000, label: 'Formations supraglaciaires de retrait würmiens' },
    { index: 7000, label: 'Moraine würmienne à cailloux et blocs alpins' },
    {
      index: 8000,
      label: 'Dépôts intramorainiques ou intraformationnels würmiens',
    },
    {
      index: 9000,
      label: 'Cailloutis morainiques profonds ou « Alluvion Ancienne »',
    },
    { index: 10000, label: 'Interglaciaire Riss-Würm' },
    { index: 11000, label: 'Formations de retrait rissiens' },
    { index: 12000, label: 'Moraines à cailloux et blocs alpins rissiens' },
  ],
};

const vispIndexVoxelColors: VoxelColors = {
  range: [voxelUndefinedData, 60],
  noData: voxelNoData,
  undefinedData: voxelUndefinedData,
  colors: [
    'rgb(204, 204, 204)', // undefined
    'rgb(255, 0, 150)', // 54
    'rgb(217, 191, 191)', // 14
    'rgb(179, 128, 128)', // 16
    'rgb(128, 77, 77)', // 31
    'rgb(64, 38, 38)', // 30
    'rgb(0, 255, 234)', // 40
    'rgb(0, 255, 234)', // 41
    'rgb(0, 255, 234)', // 44
    'rgb(0, 255, 234)', // 42
    'rgb(0, 255, 234)', // 43
    'rgb(0, 255, 234)', // 45
    'rgb(0, 255, 234)', // 46
    'rgb(0, 255, 234)', // 47
    'rgb(0, 159, 238)', // 48
    'rgb(119, 210, 255)', // 9
    'rgb(216, 255, 197)', // 7
    'rgb(23, 246, 39)', // 8
    'rgb(100, 255, 22)', // 1
    'rgb(73, 219, 0)', // 2
    'rgb(53, 160, 0)', // 3
    'rgb(34, 102, 0)', // 4
    'rgb(199, 207, 175)', // 6
  ],
};

const vispIndexVoxelFilter: IndexVoxelFilter = {
  ...voxelFilter,
  lithology: [
    { index: voxelUndefinedData, label: t('vox_filter_undefined_lithology') },
    { index: 54, label: 'Künstliche Ablagerung Lonzadeponie' },
    { index: 14, label: 'Gehängeschutt' },
    { index: 16, label: 'Bergsturzmaterial' },
    { index: 31, label: 'Felssackung' },
    { index: 30, label: 'Sackungsmasse Riedberg' },
    { index: 40, label: 'Bachschuttablagerung' },
    { index: 41, label: 'Bachschuttablagerung Baltschiederbach' },
    { index: 44, label: 'Bachschuttablagerung Gamsa' },
    { index: 42, label: 'Bachschuttablagerung Bietschbach' },
    { index: 43, label: 'Bachschuttablagerung Chelchbach' },
    { index: 45, label: 'Bachschuttablagerung Jolibach' },
    { index: 46, label: 'Bachschuttablagerung Lonza' },
    { index: 47, label: 'Bachschuttablagerung Saltina' },
    { index: 48, label: 'Bachschuttablagerung Vispa' },
    { index: 9, label: 'Rhoneschotter und Rhonesande' },
    { index: 7, label: 'Obere Limnische Ablagerungen oli' },
    { index: 8, label: 'Untere Limnische Ablagerungen uli' },
    { index: 1, label: 'Limnische Ablagerungen' },
    { index: 2, label: 'Limnische Ablagerungen 2' },
    { index: 3, label: 'Limnische Ablagerungen 4' },
    { index: 4, label: 'Limnische Ablagerungen 5' },
    { index: 6, label: 'Moränenmaterial' },
  ],
};

export const voxelLayerToFilter: Record<string, IndexVoxelFilter> = {
  voxel_birrfeld_litho: birrIndexVoxelFilter,
  voxel_birrfeld_logk: birrIndexVoxelFilter,
  voxel_aaretal_litho: aaretalVoxelFilter,
  voxel_aaretal_logk: aaretalVoxelFilter,
  voxel_geneva_litho: genevaIndexVoxelFilter,
  voxel_geneva_logk: genevaIndexVoxelFilter,
  voxel_visp_litho: vispIndexVoxelFilter,
  voxel_visp_logk: vispIndexVoxelFilter,
};

// Layers
const geo_map_series: LayerTreeNode = {
  label: t('lyr_geological_map_series_label'),
  children: [
    {
      label: t('lyr_geological_maps_label'),
      children: [
        {
          type: LayerType.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_geocover_label'),
          layer: 'ch.swisstopo.geologie-geocover',
          maximumLevel: 16,
          visible: false,
          displayed: false,
          opacity: 0.7,
          queryType: 'geoadmin',
          geocatId: '2467ab13-e794-4c13-8c55-59fe276398c5',
          legend: 'ch.swisstopo.geologie-geocover',
        },
        {
          type: LayerType.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_geology_500_label'),
          layer: 'ch.swisstopo.geologie-geologische_karte',
          maximumLevel: 18,
          visible: false,
          displayed: false,
          opacity: 0.7,
          queryType: 'geoadmin',
          geocatId: 'a4cdef47-505e-41ab-b6a7-ad5b92d80e41',
          legend: 'ch.swisstopo.geologie-geologische_karte',
        },
        {
          type: LayerType.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_tectonics_500_label'),
          layer: 'ch.swisstopo.geologie-tektonische_karte',
          maximumLevel: 18,
          visible: false,
          displayed: false,
          opacity: 0.7,
          queryType: 'geoadmin',
          geocatId: 'ca917a71-dcc9-44b6-8804-823c694be516',
          legend: 'ch.swisstopo.geologie-tektonische_karte',
        },
        {
          type: LayerType.swisstopoWMTS,
          label: t('lyr_swisstopo_geologie_last_iceage_max_map500_label'),
          layer: 'ch.swisstopo.geologie-eiszeit-lgm-raster',
          maximumLevel: 18,
          visible: false,
          displayed: false,
          opacity: 0.7,
          noQuery: true,
          geocatId: 'f1455593-7571-48b0-8603-307ec59a6702',
          legend: 'ch.swisstopo.geologie-eiszeit-lgm-raster',
        },
      ],
    },
  ],
};

const geo_base: LayerTreeNode = {
  label: t('lyr_geological_bases_label'),
  children: [
    {
      label: t('lyr_boreholes_label'),
      children: [
        {
          type: LayerType.tiles3d,
          assetId: 287568,
          label: t('lyr_boreholes_public_label'),
          layer: 'boreholes',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          visible: false,
          displayed: false, // private until they have been re-integrated
          restricted: [
            'ngm-dev-privileged',
            'ngm-int-privileged',
            'ngm-prod-privileged',
          ], // private until they have been re-integrated
          // Temporarily disable the boreholes download, see https://jira.camptocamp.com/browse/GSNGM-936
          // downloadDataType: 'csv',
          // downloadDataPath: 'https://download.swissgeol.ch/boreholes/bh_open_20210201_00.csv',
          propsOrder: [
            'bh_pub_XCOORD',
            'bh_pub_YCOORD',
            'bh_pub_ZCOORDB',
            'bh_pub_ORIGNAME',
            'bh_pub_NAMEPUB',
            'bh_pub_SHORTNAME',
            'bh_pub_BOHREDAT',
            'bh_pub_BOHRTYP',
            'bh_pub_GRUND',
            'bh_pub_RESTRICTIO',
            'bh_pub_TIEFEMD',
            'bh_pub_DEPTHFROM',
            'bh_pub_DEPTHTO',
            'bh_pub_LAYERDESC',
            'bh_pub_ORIGGEOL',
            'bh_pub_LITHOLOGY',
            'bh_pub_LITHOSTRAT',
            'bh_pub_CHRONOSTR',
            'bh_pub_TECTO',
            'bh_pub_USCS1',
            'bh_pub_USCS2',
            'bh_pub_USCS3',
          ],
          geocatId: '3996dfad-69dd-418f-a4e6-5f32b96c760a',
        },
        {
          type: LayerType.tiles3d,
          label: t('lyr_boreholes_private_label'),
          layer: 'boreholes_authenticated',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          visible: false,
          displayed: false,
          restricted: [
            'ngm-dev-privileged',
            'ngm-int-privileged',
            'ngm-prod-privileged',
          ], // the group required to see this layer
          aws_s3_bucket: 'ngm-protected-prod',
          aws_s3_key: 'tiles/bh_private_20210201_00/tileset.json',
        },
      ],
    },
    {
      label: t('lyr_cross_section_label'),
      children: [
        {
          type: LayerType.tiles3d,
          assetId: 376868,
          label: t('lyr_cross_section_ga25_pixel_label'),
          layer: 'cross_section_ga25_pixel',
          opacity: DEFAULT_LAYER_OPACITY,
          backgroundId: 'lakes_rivers_map',
          visible: false,
          displayed: false,
          pickable: true,
          propsOrder: [
            'CSGA25Px_No',
            'CSGA25Px_Name',
            'CSGA25Px_Pub',
            'CSGA25Px_Author',
            'CSGA25Px_Plate_No',
            'CSGA25Px_Section_No',
            'CSGA25Px_Sec_Type',
            'CSGA25Px_Scale',
            'CSGA25Px_Vert_Exag',
            'CSGA25Px_Link_Orig',
            'CSGA25Px_Link_Shp',
          ],
          geocatId: '97197401-6019-49b0-91d6-eaf35d57529c',
        },
        {
          type: LayerType.tiles3d,
          assetId: 68881,
          label: t('lyr_cross_section_ga25_label'),
          layer: 'cross_section',
          opacity: DEFAULT_LAYER_OPACITY,
          visible: false,
          displayed: false,
          pickable: true,
          geocatId: '2924c78a-8f1e-4eb4-b6f6-0fb2405fa7df',
        },
        {
          type: LayerType.tiles3d,
          assetId: 452436,
          label: t('lyr_cross_section_geomol_label'),
          layer: 'cross_section_geomol',
          opacity: DEFAULT_LAYER_OPACITY,
          visible: false,
          displayed: false,
          pickable: true,
          geocatId: '2cec200c-a47b-4934-8dc1-62c19c39a3dd',
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Cross-Sections.zip',
        },
        {
          type: LayerType.tiles3d,
          assetId: 472446,
          label: t('lyr_cross_section_geoquat_label'),
          layer: 'cross_section_geoquat',
          opacity: DEFAULT_LAYER_OPACITY,
          visible: false,
          displayed: false,
          pickable: true,
          propsOrder: [
            'CS-AAT-Cross-section',
            'CS-AAT-Lithostratigraphy',
            'CS-AAT-Type',
            'CS-AAT-Legend',
            'CS-AAT-Report',
          ],
          geocatId: 'ab34eb52-30c4-4b69-840b-ef41f47f9e9a',
        },
      ],
    },
  ],
};

const geo_energy: LayerTreeNode = {
  label: t('lyr_geo_energy_label'),
  children: [
    {
      label: t('lyr_geothermal_energy_label'),
      children: [
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240617/Voxel-Temperaturmodell-GeoMol15/tileset.json',
          voxelDataName: 'Temp_C',
          voxelColors: temperaturVoxelColors,
          label: t('lyr_temperature_model_label'),
          layer: 'temperature_model',
          opacityDisabled: true,
          pickable: true,
          geocatId: '63ed59b1-d9fb-4c6e-a629-550c8f6b9bf2',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251747,
          label: t('lyr_temperature_horizon_tomm_label'),
          layer: 'temperature_horizon_tomm',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '4f9e3f59-891e-434b-bba5-40db1b9495e0',
          legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omm',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251782,
          label: t('lyr_temperature_horizon_tuma_label'),
          layer: 'temperature_horizon_tuma',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '613cdc6f-0237-416d-af16-ae5d2f1934ff',
          legend: 'ch.swisstopo.geologie-geomol-temperatur_top_omalm',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251781,
          label: t('lyr_temperature_horizon_tmus_label'),
          layer: 'temperature_horizon_tmus',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: 'e0be0de5-4ed0-488a-a952-5eb385fd5595',
          legend: 'ch.swisstopo.geologie-geomol-temperatur_top_muschelkalk',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251756,
          label: t('lyr_temperature_500_bgl_label'),
          layer: 'temperature_500_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '08e66941-4ebb-4017-8018-b39caa8fd107',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_500',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251788,
          label: t('lyr_temperature_1000_bgl_label'),
          layer: 'temperature_1000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '5e32ea72-a356-4250-b40a-a441165fd936',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1000',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251790,
          label: t('lyr_temperature_1500_bgl_label'),
          layer: 'temperature_1500_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '162989d7-5c1c-48fb-8d16-2ccf5be339b9',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_1500',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251786,
          label: t('lyr_temperature_2000_bgl_label'),
          layer: 'temperature_2000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: 'ac604460-7a7a-44c5-bc5a-41062fbd21ff',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_2000',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251785,
          label: t('lyr_temperature_3000_bgl_label'),
          layer: 'temperature_3000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '47f79661-212e-4297-b048-2606db7affa8',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_3000',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251789,
          label: t('lyr_temperature_4000_bgl_label'),
          layer: 'temperature_4000_bgl',
          propsOrder: TEMPERATURE_HORIZON_BGL_ORDER,
          pickable: true,
          geocatId: '739e9095-77f6-462d-9a1e-438898cf0c9c',
          legend: 'ch.swisstopo.geologie-geomol-temperaturverteilung_4000',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251755,
          label: t('lyr_temperature_isotherm_60c_label'),
          layer: 'temperature_isotherm_60c',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '6edca35d-0f08-43b9-9faf-4c7b207888a1',
          legend: 'ch.swisstopo.geologie-geomol-isotherme_60',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251787,
          label: t('lyr_temperature_isotherm_100c_label'),
          layer: 'temperature_isotherm_100c',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '8681fb45-6220-41ef-825a-86210d8a72fc',
          legend: 'ch.swisstopo.geologie-geomol-isotherme_100',
        },
        {
          type: LayerType.tiles3d,
          assetId: 251783,
          label: t('lyr_temperature_isotherm_150c_label'),
          layer: 'temperature_isotherm_150c',
          propsOrder: TEMPERATURE_HORIZON_ORDER,
          pickable: true,
          geocatId: '31dc428e-a62b-4f6b-a263-e5eca9d9a074',
          legend: 'ch.swisstopo.geologie-geomol-isotherme_150',
        },
      ],
    },
  ],
};

const natural_hazard: LayerTreeNode = {
  label: t('lyr_natural_hazard_label'),
  children: [
    {
      type: LayerType.earthquakes,
      label: t('lyr_earthquakes_label'),
      layer: 'earthquakes',
      visible: false,
      displayed: false,
      opacity: DEFAULT_LAYER_OPACITY,
      propsOrder: EARTHQUAKES_PROP_ORDER,
      downloadUrl:
        'https://download.swissgeol.ch/earthquakes/earthquakes_last_90d.txt',
      detailsUrl:
        'http://www.seismo.ethz.ch/en/earthquakes/switzerland/last-90-days',
      geocatId: 'f44ee7fc-efd0-47ad-8a8c-db74dcc20610',
    },
    {
      type: LayerType.earthquakes,
      label: t('lyr_historical_earthquakes_label'),
      layer: 'historical_earthquakes',
      visible: false,
      displayed: false,
      opacity: DEFAULT_LAYER_OPACITY,
      propsOrder: EARTHQUAKES_PROP_ORDER,
      downloadUrl:
        'https://download.swissgeol.ch/earthquakes/earthquakes_magnitude_gt_3.txt',
      detailsUrl: 'http://www.seismo.ethz.ch',
      geocatId: 'fab0e70e-6e33-4ba9-8c42-2b8ac1578384',
    },
  ],
};

const subsurface: LayerTreeNode = {
  label: t('lyr_subsurface_label'),
  children: [
    {
      label: t('lyr_unconsolidated_rocks_label'),
      children: [
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-Aaretal-Combined/tileset.json',
          voxelDataName: 'Index',
          voxelColors: aaretalIndexVoxelColors,
          voxelFilter: aaretalVoxelFilter,
          label: t('lyr_voxel_aaretal_litho_label'),
          layer: 'voxel_aaretal_litho',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Aaretal-Legende.pdf',
          geocatId: 'b1a36f66-638a-4cfb-88d3-b0df6c7a7502',
        },
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-Aaretal-Combined/tileset.json',
          voxelDataName: 'logk',
          voxelColors: logkVoxelColors,
          voxelFilter: aaretalVoxelFilter,
          label: t('lyr_voxel_aaretal_logk_label'),
          layer: 'voxel_aaretal_logk',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Aaretal-Legende.pdf',
          geocatId: '9471ee1b-5811-489d-b050-612c011f9d57',
        },
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-BIRR-Combined/tileset.json',
          voxelDataName: 'Index',
          voxelColors: birrIndexVoxelColors,
          voxelFilter: birrIndexVoxelFilter,
          label: t('lyr_voxel_birrfeld_litho_label'),
          layer: 'voxel_birrfeld_litho',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Birrfeld-Legende.pdf',
          geocatId: 'f56c9c6c-ff59-463d-ba66-477fd2d92f39',
        },
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-BIRR-Combined/tileset.json',
          voxelDataName: 'logk',
          voxelColors: logkVoxelColors,
          voxelFilter: birrIndexVoxelFilter,
          label: t('lyr_voxel_birrfeld_logk_label'),
          layer: 'voxel_birrfeld_logk',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Birrfeld-Legende.pdf',
          geocatId: '96f923d6-a747-481b-a0d8-2cfec321170e',
        },
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-GENF-Combined/tileset.json',
          voxelDataName: 'Index',
          voxelColors: genevaIndexVoxelColors,
          voxelFilter: genevaIndexVoxelFilter,
          label: t('lyr_voxel_geneva_litho_label'),
          layer: 'voxel_geneva_litho',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-GVA-Legende.pdf',
          geocatId: '697f4c99-ed1b-4901-bc87-3710fcce1352',
        },
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-GENF-Combined/tileset.json',
          voxelDataName: 'logk',
          voxelColors: logkVoxelColors,
          voxelFilter: genevaIndexVoxelFilter,
          label: t('lyr_voxel_geneva_logk_label'),
          layer: 'voxel_geneva_logk',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-GVA-Legende.pdf',
          geocatId: '4a4a530f-6a2a-423d-834e-2831d70fde20',
        },
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-VISP-Combined/tileset.json',
          voxelDataName: 'Index',
          voxelColors: vispIndexVoxelColors,
          voxelFilter: vispIndexVoxelFilter,
          label: t('lyr_voxel_visp_litho_label'),
          layer: 'voxel_visp_litho',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Visp-Legende.pdf',
          geocatId: 'b621de46-2553-4fb2-88b4-f770e0243299',
        },
        {
          type: LayerType.voxels3dtiles,
          url: 'https://download.swissgeol.ch/testvoxel/20240415/Voxel-VISP-Combined/tileset.json',
          voxelDataName: 'logk',
          voxelColors: logkVoxelColors,
          voxelFilter: vispIndexVoxelFilter,
          label: t('lyr_voxel_visp_logk_label'),
          layer: 'voxel_visp_logk',
          opacityDisabled: true,
          pickable: true,
          downloadUrl: DOWNLOAD_ROOT_VOXEL + 'legends/Vox-Visp-Legende.pdf',
          geocatId: 'f7847c2c-bd3a-4dda-99c7-d50453b24c3d',
        },
      ],
    },
    {
      label: t('lyr_top_bedrock_surface_label'),
      children: [
        {
          type: LayerType.tiles3d,
          assetId: 267898,
          label: t('lyr_top_bedrock_label'),
          layer: 'top_bedrock',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Bedrock.zip',
          geocatId: '133b54a9-60d1-481c-85e8-e1a222d6ac3f',
          previewColor: '#dbdb22',
        },
      ],
    },
    {
      label: t('lyr_consolidated_rocks_label'),
      children: [
        {
          type: LayerType.tiles3d,
          assetId: 267959,
          label: t('lyr_top_omm_label'),
          layer: 'top_omm',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl:
            DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-UpperMarineMolasse.zip',
          geocatId: 'ea190c99-635c-4cf8-9e17-0bcfa938fbdf',
          previewColor: '#cad0c3',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267961,
          label: t('lyr_top_usm_label'),
          layer: 'top_usm',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl:
            DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerFreshwaterMolasse.zip',
          geocatId: '2d7a0729-dd29-40fa-ad4f-b09f94b7fb00',
          previewColor: '#cdd0d0',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267966,
          label: t('lyr_top_umm_label'),
          layer: 'top_umm',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl:
            DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerMarineMolasse.zip',
          geocatId: 'fedb8d24-a000-4b78-9e6e-fb90305ad3ea',
          previewColor: '#d3cfc0',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267954,
          label: t('lyr_base_cenozoic_label'),
          layer: 'base_cenozoic',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Base-Cenozoic.zip',
          geocatId: '0e780e6c-18e2-4014-ad16-b35124706580',
          previewColor: '#d6d91a',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267958,
          label: t('lyr_top_cretaceous_label'),
          layer: 'top_cretaceous',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Cretaceous.zip',
          geocatId: '09334747-14e7-40d6-881b-00e552b71f61',
          previewColor: '#b8d0c6',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267962,
          label: t('lyr_top_upper_malm_label'),
          layer: 'top_upper_malm',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-UpperMalm.zip',
          geocatId: '2378cab1-4673-4837-b12e-a35aefab389a',
          previewColor: '#bdd1de',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267963,
          label: t('lyr_top_lower_malm_label'),
          layer: 'top_lower_malm',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-LowerMalm.zip',
          geocatId: 'af51f4eb-1430-4e4e-a679-3c0eefb4a6b3',
          previewColor: '#c3d1da',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267957,
          label: t('lyr_top_dogger_label'),
          layer: 'top_dogger',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Dogger.zip',
          geocatId: '0dea083d-23b0-4c5b-b82d-1cd7bda3d583',
          previewColor: '#c6c7c5',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267899,
          label: t('lyr_top_lias_label'),
          layer: 'top_lias',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Lias.zip',
          geocatId: '793a40d6-ab83-4e1e-80d7-d7c49bf00f3c',
          previewColor: '#c6c5d9',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267960,
          label: t('lyr_top_keuper_label'),
          layer: 'top_keuper',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Keuper.zip',
          geocatId: 'e2344c21-2139-4494-8679-36fe30d034f9',
          previewColor: '#d8cecc',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267953,
          label: t('lyr_top_muschelkalk_label'),
          layer: 'top_muschelkalk',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Muschelkalk.zip',
          geocatId: 'dae3dd91-a04c-46c5-aa49-de6235c0478a',
          previewColor: '#d2c493',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267952,
          label: t('lyr_base_mesozoic_label'),
          layer: 'base_mesozoic',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CENOZOIC_BEDROCK_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Base-Mesozoic.zip',
          geocatId: 'ec67a58d-531e-4dae-98da-85c49525b4d2',
          previewColor: '#c4e0e0',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267965,
          label: t('lyr_base_permocarboniferous'),
          layer: 'base_permocarboniferous',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl:
            DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Permocarboniferous.zip',
          geocatId: 'faa96a07-1877-4fa6-b2aa-536761d7c012',
          previewColor: '#bb9f8a',
        },
        {
          type: LayerType.tiles3d,
          assetId: 267964,
          label: t('lyr_base_permocarboniferous_supposed'),
          layer: 'base_permocarboniferous_supposed',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: CONSOLIDATED_ORDER,
          downloadUrl:
            DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Top-Permocarboniferous-inferred.zip',
          geocatId: '0f1acc23-bdfc-40bf-94b7-7be10f0f78ed',
          previewColor: '#c9b19e',
        },
      ],
    },
    {
      label: t('lyr_fault_zones_label'),
      children: [
        {
          type: LayerType.tiles3d,
          assetId: 267872,
          label: t('lyr_faults_geomol_label'),
          layer: 'faults_geomol',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: FAULTS_ORDER,
          downloadUrl: DOWNLOAD_ROOT_GEOMOL + 'GeoMol-Faults.zip',
          downloadDataType: 'indexed_download',
          downloadDataPath:
            'https://download.swissgeol.ch/Faults/footprints_boxed.geojson',
          geocatId: 'f5661c1b-49e5-41e9-baf1-dee4811eb907',
          previewColor: '#c40001',
        },
      ],
    },
    {
      label: t('lyr_3d_model_label'),
      children: [
        {
          type: LayerType.tiles3d,
          assetId: 493224,
          label: t('lyr_3d_model_berne_label'),
          layer: '3d_model_berne',
          opacity: DEFAULT_LAYER_OPACITY,
          pickable: true,
          propsOrder: [
            '3DBern-Unit',
            '3DBern-Link',
            '3DBern-Lithology',
            '3DBern-TectonicUnit',
            '3DBern-ChronoB-T',
            '3DBern-OrigDesc',
            '3DBern-Version',
            '3DBern-Aothor',
            '3DBern-Purpose',
            '3DBern-Download',
          ],
          geocatId: '372c25ac-fb8a-44ee-8f81-6427939f6353',
        },
      ],
    },
  ],
};

const man_made_objects: LayerTreeNode = {
  label: t('lyr_man_made_objects_label'),
  children: [
    {
      type: LayerType.tiles3d,
      assetId: 244982,
      label: t('lyr_road_tunnel_label'),
      layer: 'road_tunnel',
      pickable: true,
      opacityDisabled: true,
      geocatId: '752146b4-7fd4-4621-8cf8-fdb19f5335a5',
    },
    {
      type: LayerType.tiles3d,
      assetId: 244984,
      label: t('lyr_rail_tunnel_label'),
      layer: 'rail_tunnel',
      pickable: true,
      opacityDisabled: true,
      geocatId: '4897848c-3777-4636-9c7e-16ef91c723f6',
    },
    {
      type: LayerType.tiles3d,
      assetId: 244985,
      label: t('lyr_water_tunnel_label'),
      layer: 'water_tunnel',
      pickable: true,
      opacityDisabled: true,
      geocatId: '71ee97cb-91f8-427d-b217-f293a0a9760a',
    },
    {
      type: LayerType.tiles3d,
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20201020/tileset.json',
      label: t('lyr_swiss_buildings_label'),
      layer: 'ch.swisstopo.swisstlm3d.3d',
      pickable: false,
      opacity: DEFAULT_LAYER_OPACITY,
      geocatId: '21c98c73-48da-408b-ab73-8f1ab9d5fbe4',
    },
  ],
};

const background: LayerTreeNode = {
  label: t('lyr_background_label'),
  children: [
    {
      type: LayerType.tiles3d,
      url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json',
      label: t('lyr_swissnames_label'),
      style: SWISSTOPO_LABEL_STYLE,
      layer: 'ch.swisstopo.swissnames3d.3d',
      opacityDisabled: true, // opacity not work with color conditions
    },
    man_made_objects,
  ],
};

const defaultLayerTree: LayerTreeNode[] = [
  geo_map_series,
  geo_base,
  geo_energy,
  natural_hazard,
  subsurface,
  background,
];

export default defaultLayerTree;
