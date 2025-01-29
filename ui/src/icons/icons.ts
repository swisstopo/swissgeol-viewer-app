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

export const icons = {
  cesium: cesiumIcon,
  checkmark: checkmarkIcon,
  close: closeIcon,
  config: configIcon,
  upload: uploadIcon,
  dropdown: dropdownIcon,
  hidden: hiddenIcon,
  layer: layerIcon,
  menu: menuIcon,
  projects: projectsIcon,
  search: searchIcon,
  share: shareIcon,
  tools: toolsIcon,
  user: userIcon,
  viewAll: viewAllIcon,
  viewLess: viewLessIcon,
  visible: visibleIcon,
};

export type IconKey = keyof typeof icons;
