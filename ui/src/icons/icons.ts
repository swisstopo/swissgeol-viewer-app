import { layerIcon } from './i_layer';
import { toolsIcon } from './i_tools';
import { shareIcon } from './i_share';
import { projectsIcon } from './i_projects';
import { configIcon } from './i_config';
import { viewAllIcon } from './i_view_all';
import { viewLessIcon } from './i_view_less';
import { userIcon } from './i_user';
import { checkmarkIcon } from './i_checkmark';
import { searchIcon } from './i_search';
import { closeIcon } from './i_close';
import { dropdownIcon } from './i_dropdown';
import { uploadIcon } from './i_upload';
import { cesiumIcon } from './i_cesium';
import { visibleIcon } from './i_visible';
import { invisibleIcon } from './i_invisible';

export const icons = {
  cesium: cesiumIcon,
  checkmark: checkmarkIcon,
  close: closeIcon,
  config: configIcon,
  upload: uploadIcon,
  dropdown: dropdownIcon,
  layer: layerIcon,
  projects: projectsIcon,
  search: searchIcon,
  share: shareIcon,
  tools: toolsIcon,
  user: userIcon,
  viewAll: viewAllIcon,
  viewLess: viewLessIcon,
  visible: visibleIcon,
  invisible: invisibleIcon,
};

export type IconKey = keyof typeof icons;
