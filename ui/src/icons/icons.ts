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

export const icons = {
  checkmark: checkmarkIcon,
  close: closeIcon,
  config: configIcon,
  layer: layerIcon,
  projects: projectsIcon,
  search: searchIcon,
  share: shareIcon,
  tools: toolsIcon,
  user: userIcon,
  viewAll: viewAllIcon,
  viewLess: viewLessIcon,
};

export type IconKey = keyof typeof icons;
