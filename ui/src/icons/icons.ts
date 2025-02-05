import {layerIcon} from './i_layer';
import {toolsIcon} from './i_tools';
import {shareIcon} from './i_share';
import {projectsIcon} from './i_projects';
import {configIcon} from './i_config';
import {viewAllIcon} from './i_view_all';
import {viewLessIcon} from './i_view_less';
import {userIcon} from './i_user';
import {checkmarkIcon} from './i_checkmark';
import {searchIcon} from './i_search';
import {closeIcon} from './i_close';
import {dropdownIcon} from './i_dropdown';
import {uploadIcon} from './i_upload';
import {cesiumIcon} from './i_cesium';
import {visibleIcon} from './i_visible';
import {hiddenIcon} from './i_hidden';
import {menuIcon} from 'src/icons/i_menu';
import {grabIcon} from 'src/icons/i_grab';
import {zoomPlusIcon} from 'src/icons/i_zoom_plus';
import {trashIcon} from 'src/icons/i_trash';
import {geocatIcon} from 'src/icons/i_geocat';
import {legendIcon} from 'src/icons/i_legend';
import {downloadIcon} from 'src/icons/i_download';
import {filterIcon} from 'src/icons/i_filter';
import {turnPageIcon} from 'src/icons/i_turnPage';

export const icons = {
  cesium: cesiumIcon,
  checkmark: checkmarkIcon,
  close: closeIcon,
  config: configIcon,
  download: downloadIcon,
  dropdown: dropdownIcon,
  filter: filterIcon,
  geocat: geocatIcon,
  grab: grabIcon,
  hidden: hiddenIcon,
  layer: layerIcon,
  legend: legendIcon,
  menu: menuIcon,
  projects: projectsIcon,
  search: searchIcon,
  share: shareIcon,
  tools: toolsIcon,
  trash: trashIcon,
  turnPage: turnPageIcon,
  upload: uploadIcon,
  user: userIcon,
  viewAll: viewAllIcon,
  viewLess: viewLessIcon,
  visible: visibleIcon,
  zoomPlus: zoomPlusIcon,
};

export type IconKey = keyof typeof icons;
